// Hierarchical rule resolution pipeline
// 3 LLM calls total (or 2 if short-circuit): category match → rule lookup → triage → evaluation

import { styleGuide, categoryRegistry, buildCategoryIndex } from './state.js';
import { callLLM } from './llm.js';
import {
  buildCategoryMatchPrompt, buildRuleTriagePrompt, buildRuleEvaluationPrompt,
  parseCategoryMatch as parseCategoryMatchRaw, parseTriageResponse, parseEvaluation
} from './resolution-prompts.js';

const TRIAGE_THRESHOLD = 15;

export async function resolveRules(text, options = {}) {
  const { onStageComplete } = options;

  // Stage 1: Category matching (1 LLM call)
  console.log('[Resolution] Stage 1: Category matching');
  const categoryMatchPrompt = buildCategoryMatchPrompt(text, categoryRegistry);
  const categoryResponse = await callLLM(categoryMatchPrompt);
  const matchedCategories = parseCategoryMatch(categoryResponse);
  console.log('[Resolution] Matched categories:', matchedCategories);
  onStageComplete?.('categories', matchedCategories);

  if (matchedCategories.length === 0) {
    onStageComplete?.('evaluated', []);
    return { matchedCategories, candidateRules: [], triagedRules: [], evaluations: [] };
  }

  // Stage 2: Rule lookup (free — in-memory filter)
  console.log('[Resolution] Stage 2: Rule lookup');
  const categoryIndex = buildCategoryIndex();
  const candidateRuleIds = new Set();
  for (const cat of matchedCategories) {
    for (const id of (categoryIndex.get(cat) || [])) {
      candidateRuleIds.add(id);
    }
  }
  const candidateRules = styleGuide.filter(r => candidateRuleIds.has(r.id));
  console.log(`[Resolution] ${candidateRules.length} candidate rules from ${matchedCategories.length} categories`);
  onStageComplete?.('candidates', candidateRules);

  if (candidateRules.length === 0) {
    onStageComplete?.('evaluated', []);
    return { matchedCategories, candidateRules, triagedRules: [], evaluations: [] };
  }

  // Short-circuit: if few enough candidates, skip triage
  let triagedRules;
  if (candidateRules.length <= TRIAGE_THRESHOLD) {
    console.log(`[Resolution] Short-circuit: ${candidateRules.length} candidates ≤ ${TRIAGE_THRESHOLD}, skipping triage`);
    triagedRules = candidateRules;
  } else {
    // Stage 3: Triage (1 LLM call)
    console.log('[Resolution] Stage 3: Triage');
    const triagePrompt = buildRuleTriagePrompt(text, candidateRules);
    const triageResponse = await callLLM(triagePrompt);
    const triagedIds = parseTriageResponse(triageResponse);
    triagedRules = candidateRules.filter(r => triagedIds.includes(r.id));
    console.log(`[Resolution] Triaged to ${triagedRules.length} rules`);
    onStageComplete?.('triaged', triagedRules);
  }

  if (triagedRules.length === 0) {
    onStageComplete?.('evaluated', []);
    return { matchedCategories, candidateRules, triagedRules, evaluations: [] };
  }

  // Stage 4: Deep evaluation (1 LLM call)
  console.log('[Resolution] Stage 4: Deep evaluation');
  const evalPrompt = buildRuleEvaluationPrompt(text, triagedRules);
  const evalResponse = await callLLM(evalPrompt);
  const evaluations = parseEvaluation(evalResponse);
  console.log(`[Resolution] ${evaluations.length} evaluations returned`);
  onStageComplete?.('evaluated', evaluations);

  return { matchedCategories, candidateRules, triagedRules, evaluations };
}

// Wrap parseCategoryMatch to inject known categories from state
function parseCategoryMatch(response) {
  const knownCategories = Object.keys(categoryRegistry);
  return parseCategoryMatchRaw(response, knownCategories);
}

// Re-export for any code that imports from here
export { parseCategoryMatch, parseTriageResponse, parseEvaluation };
