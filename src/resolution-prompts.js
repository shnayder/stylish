// Pure prompt builders and parsers for the resolution pipeline.
// No browser dependencies — importable from Node.js for eval scripts.

// --- Prompt builders ---

export function buildCategoryMatchPrompt(text, categoryRegistry) {
  const categoryLines = Object.entries(categoryRegistry)
    .map(([name, info]) => `- ${name}: ${info.description}`)
    .join('\n');

  return `Analyze this creative writing text and determine which style categories are relevant.

Categories:
${categoryLines}

Text:
"${text}"

Which categories does this text exercise? Return ONLY a JSON array of category names.
Only include categories where the text actually uses that aspect of writing.`;
}

export function buildRuleTriagePrompt(text, candidateRules) {
  const ruleLines = candidateRules
    .map(r => `- ${r.id}: ${r.principle}`)
    .join('\n');

  return `Given this text, which style rules could potentially apply (either followed or violated)?

Text:
"${text}"

Rules:
${ruleLines}

Return ONLY a JSON array of rule IDs that are relevant to this text.`;
}

export function buildRuleEvaluationPrompt(text, rules) {
  const ruleDetails = rules.map(r => {
    let detail = `Rule ${r.id}: ${r.principle}`;
    if (r.avoid && r.avoid.length > 0) {
      detail += `\n  Avoid: ${r.avoid.join('; ')}`;
    }
    if (r.prefer && r.prefer.length > 0) {
      detail += `\n  Prefer: ${r.prefer.join('; ')}`;
    }
    if (r.originalExample) {
      detail += `\n  Example (bad): "${r.originalExample}"`;
    }
    if (r.betterVersion) {
      detail += `\n  Example (better): "${r.betterVersion}"`;
    }
    return detail;
  }).join('\n\n');

  return `Evaluate this text against each style rule.

Text:
"${text}"

Rules:
${ruleDetails}

For each rule, return a JSON array:
[{"ruleId": "...", "assessment": "follows|violates|partial", "note": "brief explanation"}]`;
}

// --- Parse helpers ---

export function extractJSONArray(text) {
  // Try to find a JSON array in the response, handling markdown code blocks, preamble text, etc.
  // Strip markdown code blocks
  let stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```/g, '');

  // Strip thinking tags that local LLMs may emit (e.g. [THINK]...[/THINK], <think>...</think>)
  stripped = stripped.replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, '');
  stripped = stripped.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Find candidate JSON arrays by looking for valid array openings: [" or [{
  // This avoids greedy matching from stray brackets in preamble text.
  const tryParse = (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      // Try cleaning trailing commas
      const cleaned = str.replace(/,\s*([\]}])/g, '$1');
      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        return null;
      }
    }
  };

  // Search for array openings and try to parse from each
  const candidatePattern = /\[(?=\s*["{[\d])/g;
  let candidateMatch;
  while ((candidateMatch = candidatePattern.exec(stripped)) !== null) {
    const startIdx = candidateMatch.index;
    // Find matching closing bracket by tracking nesting depth
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = startIdx; i < stripped.length; i++) {
      const ch = stripped[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\' && inString) { escape = true; continue; }
      if (ch === '"' && !escape) { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '[') depth++;
      if (ch === ']') { depth--; if (depth === 0) {
        const candidate = stripped.slice(startIdx, i + 1);
        const result = tryParse(candidate);
        if (Array.isArray(result)) return result;
        break; // This candidate failed, try next opening bracket
      }}
    }
  }

  // Fallback: greedy match (preserves old behavior for edge cases)
  const match = stripped.match(/\[[\s\S]*\]/);
  if (match) {
    const result = tryParse(match[0]);
    if (Array.isArray(result)) return result;
    console.warn('[Resolution] Failed to parse JSON array:', match[0].slice(0, 200));
  }
  return null;
}

export function parseCategoryMatch(response, knownCategories) {
  const arr = extractJSONArray(response);
  if (!Array.isArray(arr)) {
    console.warn('[Resolution] Could not parse category match response:', response);
    return [];
  }
  return arr.filter(c => typeof c === 'string' && knownCategories.includes(c));
}

export function parseTriageResponse(response) {
  const arr = extractJSONArray(response);
  if (!Array.isArray(arr)) {
    console.warn('[Resolution] Could not parse triage response:', response);
    return [];
  }
  return arr.filter(id => typeof id === 'string');
}

export function parseEvaluation(response) {
  const arr = extractJSONArray(response);
  if (!Array.isArray(arr)) {
    console.warn('[Resolution] Could not parse evaluation response:', response);
    return [];
  }

  const validAssessments = ['follows', 'violates', 'partial'];

  return arr.map(item => {
    if (!item || typeof item !== 'object') return null;
    const ruleId = item.ruleId || item.rule_id || item.id || '';
    let assessment = (item.assessment || item.status || 'partial').toLowerCase();
    if (!validAssessments.includes(assessment)) {
      assessment = 'partial';
    }
    const note = item.note || item.explanation || item.comment || '';
    return { ruleId, assessment, note };
  }).filter(Boolean);
}

// --- Category index builder (pure function, same logic as state.buildCategoryIndex) ---

export function buildCategoryIndex(styleGuide) {
  const index = new Map();
  for (const rule of styleGuide) {
    if (!Array.isArray(rule.categories)) continue;
    for (const cat of rule.categories) {
      if (!index.has(cat)) {
        index.set(cat, []);
      }
      index.get(cat).push(rule.id);
    }
  }
  return index;
}
