// Writing area UI — editable text with selection-based actions

import { styleGuide } from '../state.js';
import { escapeHtml } from '../utils.js';
import { openRewriteView } from './rewriteView.js';
import { openDrillDown } from './drillDown.js';
import { resolveRules } from '../resolution.js';
import { renderStats } from './stats.js';

const STORAGE_KEY = 'writing-text';

export function initWritingArea() {
  const textarea = document.getElementById('writing-text');
  const rewriteBtn = document.getElementById('writing-rewrite');
  const drillDownBtn = document.getElementById('writing-drill-down');
  const analyzeBtn = document.getElementById('writing-analyze');

  // Restore saved text
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    textarea.value = saved;
  }

  // Persist on change
  textarea.addEventListener('input', () => {
    localStorage.setItem(STORAGE_KEY, textarea.value);
  });

  // Selection tracking
  textarea.addEventListener('mouseup', updateToolbarState);
  textarea.addEventListener('keyup', updateToolbarState);
  textarea.addEventListener('select', updateToolbarState);

  // Button handlers
  rewriteBtn.addEventListener('click', handleRewrite);
  drillDownBtn.addEventListener('click', handleDrillDown);
  analyzeBtn.addEventListener('click', handleAnalyze);
}

function getSelection() {
  const textarea = document.getElementById('writing-text');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === end) return null;
  return {
    text: textarea.value.substring(start, end),
    start,
    end,
    fullText: textarea.value
  };
}

function updateToolbarState() {
  const sel = getSelection();
  const hasSelection = sel !== null;
  document.getElementById('writing-rewrite').disabled = !hasSelection;
  document.getElementById('writing-drill-down').disabled = !hasSelection;
  document.getElementById('writing-analyze').disabled = !hasSelection;
}

function handleRewrite() {
  const sel = getSelection();
  if (!sel) return;
  openRewriteView(null, sel.fullText, sel.text, sel.start, sel.end);
}

function handleDrillDown() {
  const sel = getSelection();
  if (!sel) return;
  openDrillDown(sel.text, '', null);
}

async function handleAnalyze() {
  const sel = getSelection();
  if (!sel) return;

  const resultsEl = document.getElementById('writing-analysis-results');
  const analyzeBtn = document.getElementById('writing-analyze');

  // Set up results container with stage placeholders
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = `
    <div class="analysis-stage" id="wa-stage-categories">
      <h4>Matched Categories</h4>
      <div class="stage-content" id="wa-categories-content">
        <span class="loading-indicator"></span> Matching categories...
      </div>
    </div>
    <div class="analysis-stage" id="wa-stage-candidates">
      <h4>Candidate Rules <span class="stage-count" id="wa-candidates-count"></span></h4>
      <div class="stage-content" id="wa-candidates-content"></div>
    </div>
    <div class="analysis-stage" id="wa-stage-evaluated">
      <h4>Evaluation</h4>
      <div class="stage-content" id="wa-evaluated-content"></div>
    </div>
  `;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';

  try {
    await resolveRules(sel.text, {
      onStageComplete: (stage, data) => renderStageResult(stage, data)
    });
  } catch (err) {
    console.error('[WritingArea] Analysis error:', err);
    document.getElementById('wa-evaluated-content').innerHTML =
      `<div class="analyzer-error">Analysis failed: ${escapeHtml(err.message)}</div>`;
  }

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = 'Analyze Style';
  updateToolbarState();
  renderStats();
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
  const el = document.getElementById('wa-categories-content');
  if (categories.length === 0) {
    el.innerHTML = '<span class="analyzer-empty">No matching categories found</span>';
    return;
  }
  el.innerHTML = categories
    .map(c => `<span class="category-tag">${escapeHtml(c)}</span>`)
    .join(' ');
}

function renderCandidates(rules) {
  const countEl = document.getElementById('wa-candidates-count');
  const contentEl = document.getElementById('wa-candidates-content');
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
  document.getElementById('wa-evaluated-content').innerHTML =
    '<span class="loading-indicator"></span> Evaluating rules...';
}

function renderTriaged(rules) {
  const evalEl = document.getElementById('wa-evaluated-content');
  evalEl.innerHTML = `<span class="loading-indicator"></span> Evaluating ${rules.length} triaged rules...`;
}

function renderEvaluations(evaluations) {
  const el = document.getElementById('wa-evaluated-content');

  if (evaluations.length === 0) {
    el.innerHTML = '<span class="analyzer-empty">No evaluations returned</span>';
    return;
  }

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
