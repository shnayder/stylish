#!/usr/bin/env node

// Resolution pipeline eval script.
// Runs test sentences through the pipeline and compares to hand-authored expectations.
//
// Usage:
//   node test/resolution-eval.js [options]
//     --provider local|anthropic   (default: local)
//     --url <url>                  (default: http://localhost:1234)
//     --key <key>                  (for anthropic provider)
//     --log <path>                 (log file path, default: test/resolution-eval.log)
//     --case <id>                  (run single test case)
//     --verbose                    (print detailed results to console too)

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import {
  buildCategoryMatchPrompt,
  buildRuleTriagePrompt,
  buildRuleEvaluationPrompt,
  parseCategoryMatch,
  parseTriageResponse,
  parseEvaluation,
  buildCategoryIndex
} from '../src/resolution-prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// --- CLI args ---

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    provider: 'local',
    url: 'http://localhost:1234',
    key: '',
    log: resolve(__dirname, 'resolution-eval.log'),
    caseId: null,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--provider': opts.provider = args[++i]; break;
      case '--url': opts.url = args[++i]; break;
      case '--key': opts.key = args[++i]; break;
      case '--log': opts.log = args[++i]; break;
      case '--case': opts.caseId = args[++i]; break;
      case '--verbose': opts.verbose = true; break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  return opts;
}

// --- LLM call ---

async function callLLM(prompt, opts) {
  if (opts.provider === 'anthropic') {
    return callAnthropic(prompt, opts);
  }
  return callLocal(prompt, opts);
}

async function callLocal(prompt, opts) {
  const body = {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 3000,
    stream: false
  };

  const response = await fetch(`${opts.url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    text: data.choices[0].message.content,
    model: data.model || 'local',
    usage: data.usage || {}
  };
}

async function callAnthropic(prompt, opts) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': opts.key,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API request failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    text: data.content[0].text,
    model: data.model || 'claude-3-haiku',
    usage: data.usage || {}
  };
}

// --- Pipeline runner ---

const TRIAGE_THRESHOLD = 15;

async function runPipeline(testCase, styleGuide, categoryRegistry, opts) {
  const { sentence } = testCase;
  const knownCategories = Object.keys(categoryRegistry);
  const categoryIndex = buildCategoryIndex(styleGuide);
  const log = [];
  const timings = {};

  function logEntry(stage, data) {
    log.push({ stage, ...data });
  }

  // Stage 1: Category matching
  let t0 = Date.now();
  const catPrompt = buildCategoryMatchPrompt(sentence, categoryRegistry);
  logEntry('category-match-prompt', { prompt: catPrompt });

  const catResponse = await callLLM(catPrompt, opts);
  timings.categoryMatch = Date.now() - t0;
  logEntry('category-match-response', { raw: catResponse.text, model: catResponse.model });

  const matchedCategories = parseCategoryMatch(catResponse.text, knownCategories);
  logEntry('category-match-parsed', { matchedCategories });

  if (matchedCategories.length === 0) {
    return { matchedCategories, candidateRules: [], triagedRules: [], evaluations: [], log, timings };
  }

  // Stage 2: Rule lookup (in-memory)
  const candidateRuleIds = new Set();
  for (const cat of matchedCategories) {
    for (const id of (categoryIndex.get(cat) || [])) {
      candidateRuleIds.add(id);
    }
  }
  const candidateRules = styleGuide.filter(r => candidateRuleIds.has(r.id));
  logEntry('rule-lookup', { candidateCount: candidateRules.length, candidateIds: candidateRules.map(r => r.id) });

  if (candidateRules.length === 0) {
    return { matchedCategories, candidateRules, triagedRules: [], evaluations: [], log, timings };
  }

  // Stage 3: Triage (or short-circuit)
  let triagedRules;
  if (candidateRules.length <= TRIAGE_THRESHOLD) {
    triagedRules = candidateRules;
    logEntry('triage-skipped', { reason: `${candidateRules.length} candidates <= ${TRIAGE_THRESHOLD}` });
  } else {
    t0 = Date.now();
    const triagePrompt = buildRuleTriagePrompt(sentence, candidateRules);
    logEntry('triage-prompt', { prompt: triagePrompt });

    const triageResponse = await callLLM(triagePrompt, opts);
    timings.triage = Date.now() - t0;
    logEntry('triage-response', { raw: triageResponse.text, model: triageResponse.model });

    const triagedIds = parseTriageResponse(triageResponse.text);
    triagedRules = candidateRules.filter(r => triagedIds.includes(r.id));
    logEntry('triage-parsed', { triagedIds, triagedCount: triagedRules.length });
  }

  if (triagedRules.length === 0) {
    return { matchedCategories, candidateRules, triagedRules, evaluations: [], log, timings };
  }

  // Stage 4: Deep evaluation
  t0 = Date.now();
  const evalPrompt = buildRuleEvaluationPrompt(sentence, triagedRules);
  logEntry('eval-prompt', { prompt: evalPrompt });

  const evalResponse = await callLLM(evalPrompt, opts);
  timings.evaluation = Date.now() - t0;
  logEntry('eval-response', { raw: evalResponse.text, model: evalResponse.model });

  const evaluations = parseEvaluation(evalResponse.text);
  logEntry('eval-parsed', { evaluations });

  return { matchedCategories, candidateRules, triagedRules, evaluations, log, timings };
}

// --- Comparison logic ---

function compareResult(testCase, result) {
  const failures = [];
  const details = {};

  // Check expected categories
  details.categoryMatch = { expected: testCase.expectCategories || [], got: result.matchedCategories };
  if (testCase.expectCategories) {
    for (const cat of testCase.expectCategories) {
      if (!result.matchedCategories.includes(cat)) {
        failures.push(`expected category "${cat}" not matched`);
      }
    }
  }

  // Check dontExpect categories
  if (testCase.dontExpectCategories) {
    for (const cat of testCase.dontExpectCategories) {
      if (result.matchedCategories.includes(cat)) {
        failures.push(`unexpected category "${cat}" was matched`);
      }
    }
  }

  // Build evaluation map for easy lookup
  const evalMap = {};
  for (const ev of result.evaluations) {
    evalMap[ev.ruleId] = ev;
  }
  details.evaluations = evalMap;

  // Check expected rules
  const selectedRuleIds = result.evaluations.map(e => e.ruleId);
  if (testCase.expectRules) {
    for (const [ruleId, expectedAssessment] of Object.entries(testCase.expectRules)) {
      if (!selectedRuleIds.includes(ruleId)) {
        failures.push(`expected rule "${ruleId}" not selected (wanted: ${expectedAssessment})`);
      } else if (evalMap[ruleId].assessment !== expectedAssessment) {
        failures.push(`rule "${ruleId}": expected ${expectedAssessment}, got ${evalMap[ruleId].assessment}`);
      }
    }
  }

  // Check dontExpect rules
  if (testCase.dontExpectRules) {
    for (const ruleId of testCase.dontExpectRules) {
      if (selectedRuleIds.includes(ruleId)) {
        failures.push(`unexpected rule "${ruleId}" was selected`);
      }
    }
  }

  return { pass: failures.length === 0, failures, details };
}

// --- Summary stats ---

function computeStats(results) {
  let totalCases = results.length;
  let passed = 0;
  let categoryCorrect = 0;
  let ruleSelectionCorrect = 0;
  let assessmentCorrect = 0;
  let assessmentTotal = 0;

  for (const r of results) {
    if (r.comparison.pass) passed++;

    // Category accuracy: all expected present and no unexpected present
    const catFailures = r.comparison.failures.filter(f => f.includes('category'));
    if (catFailures.length === 0) categoryCorrect++;

    // Rule selection: all expected rules selected, no unexpected
    const tc = r.testCase;
    const selectedIds = r.result.evaluations.map(e => e.ruleId);
    let allExpectedSelected = true;
    if (tc.expectRules) {
      for (const ruleId of Object.keys(tc.expectRules)) {
        if (!selectedIds.includes(ruleId)) {
          allExpectedSelected = false;
          break;
        }
      }
    }
    let noUnexpected = true;
    if (tc.dontExpectRules) {
      for (const ruleId of tc.dontExpectRules) {
        if (selectedIds.includes(ruleId)) {
          noUnexpected = false;
          break;
        }
      }
    }
    if (allExpectedSelected && noUnexpected) ruleSelectionCorrect++;

    // Assessment accuracy: of selected expected rules, how many got the right assessment?
    if (tc.expectRules) {
      for (const [ruleId, expectedAssessment] of Object.entries(tc.expectRules)) {
        if (selectedIds.includes(ruleId)) {
          assessmentTotal++;
          const evalMap = {};
          for (const ev of r.result.evaluations) evalMap[ev.ruleId] = ev;
          if (evalMap[ruleId]?.assessment === expectedAssessment) {
            assessmentCorrect++;
          }
        }
      }
    }
  }

  return {
    totalCases,
    passed,
    passRate: totalCases > 0 ? (passed / totalCases * 100).toFixed(0) : 0,
    categoryCorrect,
    ruleSelectionCorrect,
    assessmentCorrect,
    assessmentTotal
  };
}

// --- Main ---

async function main() {
  const opts = parseArgs();

  // Load data files
  const styleGuide = JSON.parse(readFileSync(resolve(projectRoot, 'style-guide.json'), 'utf-8'));
  const categoryRegistry = JSON.parse(readFileSync(resolve(projectRoot, 'category-registry.json'), 'utf-8'));
  const allCases = JSON.parse(readFileSync(resolve(__dirname, 'resolution-cases.json'), 'utf-8'));

  // Filter to single case if requested
  let cases = allCases;
  if (opts.caseId) {
    cases = allCases.filter(c => c.id === opts.caseId);
    if (cases.length === 0) {
      console.error(`No test case with id "${opts.caseId}"`);
      process.exit(1);
    }
  }

  console.log(`Resolution Pipeline Eval — ${cases.length} cases, provider: ${opts.provider}\n`);

  const logLines = [];
  logLines.push(`Resolution Pipeline Eval`);
  logLines.push(`Date: ${new Date().toISOString()}`);
  logLines.push(`Provider: ${opts.provider}`);
  logLines.push(`URL: ${opts.provider === 'local' ? opts.url : 'api.anthropic.com'}`);
  logLines.push(`Cases: ${cases.length}`);
  logLines.push('='.repeat(80));
  logLines.push('');

  const results = [];

  for (const tc of cases) {
    process.stdout.write(`  Running ${tc.id}...`);
    const t0 = Date.now();

    let result;
    try {
      result = await runPipeline(tc, styleGuide, categoryRegistry, opts);
    } catch (err) {
      console.log(` ERROR: ${err.message}`);
      logLines.push(`--- ${tc.id}: ${tc.description} ---`);
      logLines.push(`ERROR: ${err.message}`);
      logLines.push('');
      results.push({
        testCase: tc,
        result: { matchedCategories: [], candidateRules: [], triagedRules: [], evaluations: [], log: [], timings: {} },
        comparison: { pass: false, failures: [`ERROR: ${err.message}`], details: {} },
        elapsed: Date.now() - t0
      });
      continue;
    }

    const elapsed = Date.now() - t0;
    const comparison = compareResult(tc, result);

    results.push({ testCase: tc, result, comparison, elapsed });

    const status = comparison.pass ? 'PASS' : 'FAIL';
    const statusColor = comparison.pass ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    // Clear the "Running..." and print result
    process.stdout.clearLine?.(0);
    process.stdout.cursorTo?.(0);
    console.log(`${statusColor}${status}${reset}  ${tc.id}: ${tc.description}`);

    if (!comparison.pass) {
      for (const f of comparison.failures) {
        console.log(`       ${f}`);
      }
    }

    if (opts.verbose) {
      console.log(`       Categories: ${result.matchedCategories.join(', ') || '(none)'}`);
      console.log(`       Candidates: ${result.candidateRules.length}, Triaged: ${result.triagedRules.length}`);
      for (const ev of result.evaluations) {
        console.log(`       ${ev.ruleId}: ${ev.assessment} — ${ev.note}`);
      }
      console.log(`       Elapsed: ${elapsed}ms`);
      console.log();
    }

    // Build log entry
    logLines.push(`--- ${tc.id}: ${tc.description} ---`);
    logLines.push(`Sentence: "${tc.sentence}"`);
    logLines.push(`Status: ${status}`);
    if (!comparison.pass) {
      logLines.push(`Failures: ${comparison.failures.join('; ')}`);
    }
    logLines.push(`Elapsed: ${elapsed}ms`);
    logLines.push(`Timings: ${JSON.stringify(result.timings)}`);
    logLines.push('');
    for (const entry of result.log) {
      logLines.push(`[${entry.stage}]`);
      const { stage, ...data } = entry;
      logLines.push(JSON.stringify(data, null, 2));
      logLines.push('');
    }
    logLines.push('='.repeat(80));
    logLines.push('');
  }

  // Summary
  const stats = computeStats(results);

  console.log();
  console.log(`Results: ${stats.passed}/${stats.totalCases} passed (${stats.passRate}%)`);
  console.log(`  Category match:  ${stats.categoryCorrect}/${stats.totalCases} correct`);
  console.log(`  Rule selection:  ${stats.ruleSelectionCorrect}/${stats.totalCases} correct`);
  console.log(`  Assessment:      ${stats.assessmentCorrect}/${stats.assessmentTotal} correct (of selected)`);

  // Write log file
  logLines.push('SUMMARY');
  logLines.push(`Results: ${stats.passed}/${stats.totalCases} passed (${stats.passRate}%)`);
  logLines.push(`Category match: ${stats.categoryCorrect}/${stats.totalCases}`);
  logLines.push(`Rule selection: ${stats.ruleSelectionCorrect}/${stats.totalCases}`);
  logLines.push(`Assessment: ${stats.assessmentCorrect}/${stats.assessmentTotal}`);

  writeFileSync(opts.log, logLines.join('\n'), 'utf-8');
  console.log(`\nLog written to: ${opts.log}`);

  // Write results snapshot
  const resultsPath = resolve(__dirname, 'resolution-eval-results.json');
  const snapshot = {
    metadata: {
      timestamp: new Date().toISOString(),
      provider: opts.provider,
      url: opts.provider === 'local' ? opts.url : 'api.anthropic.com',
      totalCases: stats.totalCases,
      passed: stats.passed,
      passRate: `${stats.passRate}%`
    },
    summary: stats,
    cases: results.map(r => ({
      id: r.testCase.id,
      description: r.testCase.description,
      sentence: r.testCase.sentence,
      pass: r.comparison.pass,
      failures: r.comparison.failures,
      matchedCategories: r.result.matchedCategories,
      evaluations: r.result.evaluations,
      elapsed: r.elapsed
    }))
  };
  writeFileSync(resultsPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
  console.log(`Results snapshot written to: ${resultsPath}`);

  // Exit with non-zero if any failures
  if (stats.passed < stats.totalCases) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(2);
});
