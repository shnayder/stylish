// Analyzer UI — text analysis against style guide rules

import { resolveRules } from '../resolution.js';
import { styleGuide } from '../state.js';

export function initAnalyzer() {
  const analyzeBtn = document.getElementById('analyze-btn');
  analyzeBtn.addEventListener('click', runAnalysis);
}

async function runAnalysis() {
  const textEl = document.getElementById('analyzer-text');
  const text = textEl.value.trim();

  if (!text) {
    textEl.focus();
    return;
  }

  const resultsEl = document.getElementById('analyzer-results');
  const analyzeBtn = document.getElementById('analyze-btn');

  // Reset previous results
  resultsEl.style.display = 'block';
  document.getElementById('stage-categories-content').innerHTML = '<span class="loading-indicator"></span> Matching categories...';
  document.getElementById('stage-candidates-content').innerHTML = '';
  document.getElementById('stage-candidates-count').textContent = '';
  document.getElementById('stage-evaluated-content').innerHTML = '';

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';

  try {
    await resolveRules(text, {
      onStageComplete: (stage, data) => renderStageResult(stage, data)
    });
  } catch (err) {
    console.error('[Analyzer] Error:', err);
    document.getElementById('stage-evaluated-content').innerHTML =
      `<div class="analyzer-error">Analysis failed: ${err.message}</div>`;
  }

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = 'Analyze';
}

function renderStageResult(stage, data) {
  switch (stage) {
    case 'categories':
      renderCategories(data);
      break;
    case 'candidates':
      renderCandidates(data);
      break;
    case 'triaged':
      renderTriaged(data);
      break;
    case 'evaluated':
      renderEvaluations(data);
      break;
  }
}

function renderCategories(categories) {
  const el = document.getElementById('stage-categories-content');
  if (categories.length === 0) {
    el.innerHTML = '<span class="analyzer-empty">No matching categories found</span>';
    return;
  }
  el.innerHTML = categories
    .map(c => `<span class="category-tag">${escapeHtml(c)}</span>`)
    .join(' ');
}

function renderCandidates(rules) {
  const countEl = document.getElementById('stage-candidates-count');
  const contentEl = document.getElementById('stage-candidates-content');
  countEl.textContent = `(${rules.length})`;

  if (rules.length === 0) {
    contentEl.innerHTML = '<span class="analyzer-empty">No candidate rules found</span>';
    return;
  }

  const list = rules.map(r =>
    `<div class="candidate-rule"><span class="candidate-id">${escapeHtml(r.id)}</span> ${escapeHtml(r.principle)}</div>`
  ).join('');

  contentEl.innerHTML = `<details class="candidates-details">
    <summary>${rules.length} rules from matched categories</summary>
    ${list}
  </details>`;

  // Show loading for next stage
  document.getElementById('stage-evaluated-content').innerHTML =
    '<span class="loading-indicator"></span> Evaluating rules...';
}

function renderTriaged(rules) {
  // Update candidates section to show triage result
  const evalEl = document.getElementById('stage-evaluated-content');
  evalEl.innerHTML = `<span class="loading-indicator"></span> Evaluating ${rules.length} triaged rules...`;
}

function renderEvaluations(evaluations) {
  const el = document.getElementById('stage-evaluated-content');

  if (evaluations.length === 0) {
    el.innerHTML = '<span class="analyzer-empty">No evaluations returned</span>';
    return;
  }

  // Look up rule principles for display
  const ruleMap = new Map(styleGuide.map(r => [r.id, r]));

  const items = evaluations.map(ev => {
    const rule = ruleMap.get(ev.ruleId);
    const principle = rule ? escapeHtml(rule.principle) : escapeHtml(ev.ruleId);
    const badgeClass = `assessment-badge ${ev.assessment}`;
    const badgeLabel = ev.assessment.charAt(0).toUpperCase() + ev.assessment.slice(1);

    return `<div class="evaluation-item">
      <div class="evaluation-header">
        <span class="${badgeClass}">${badgeLabel}</span>
        <span class="evaluation-principle">${principle}</span>
      </div>
      ${ev.note ? `<div class="evaluation-note">${escapeHtml(ev.note)}</div>` : ''}
    </div>`;
  }).join('');

  el.innerHTML = items;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
