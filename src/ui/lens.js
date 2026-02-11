// Lens flow — system evaluation of text against style guide

import { styleGuide } from '../state.js';
import { resolveRules } from '../resolution.js';
import { escapeHtml } from '../utils.js';
import { renderStats } from './stats.js';

let evaluations = [];
let evaluationLoading = false;

export function initLens() {
  // No static DOM setup needed
}

export async function runEvaluation(text) {
  if (evaluationLoading) return;
  if (!text || !text.trim()) {
    alert('No text to evaluate. Write or generate some text first.');
    return;
  }

  if (styleGuide.length === 0) {
    alert('No style rules yet. Add some rules to the Style Guide first, then evaluate.');
    return;
  }

  evaluationLoading = true;
  evaluations = [];
  renderLensResults(); // Show loading state

  const btn = document.getElementById('evaluate-btn');
  const origText = btn.textContent;
  btn.textContent = 'Evaluating...';
  btn.disabled = true;

  try {
    await resolveRules(text, {
      onStageComplete: (stage, data) => {
        if (stage === 'evaluated') {
          evaluations = data;
        }
      }
    });
  } catch (err) {
    console.error('[Lens] Evaluation error:', err);
    evaluations = [{ error: err.message }];
  }

  evaluationLoading = false;
  btn.textContent = origText;
  btn.disabled = false;
  renderLensResults();
  renderStats();
}

export async function runEvaluationOnSelection(selectionData) {
  return runEvaluation(selectionData.text);
}

function renderLensResults() {
  const area = document.getElementById('annotations-area');

  // Remove any existing lens card
  const existing = area.querySelector('.lens-results');
  if (existing) existing.remove();

  if (evaluationLoading) {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'annotation-card lens-results';
    loadingEl.innerHTML = `
      <div class="annotation-card-header">
        <span class="annotation-type lens">Evaluate</span>
        <span class="quote-text">Analyzing text against style guide...</span>
      </div>
      <div class="annotation-card-body">
        <div class="annotation-loading">
          <span class="loading-indicator"></span> Running evaluation pipeline...
        </div>
      </div>
    `;
    area.appendChild(loadingEl);
    return;
  }

  if (evaluations.length === 0) return;

  // Check for error
  if (evaluations.length === 1 && evaluations[0].error) {
    const errorEl = document.createElement('div');
    errorEl.className = 'annotation-card lens-results';
    errorEl.innerHTML = `
      <div class="annotation-card-header">
        <span class="annotation-type lens">Evaluate</span>
        <span class="quote-text">Evaluation failed</span>
        <button class="close-annotation" id="close-lens">&times;</button>
      </div>
      <div class="annotation-card-body">
        <div class="lens-summary" style="color: #a55;">Error: ${escapeHtml(evaluations[0].error)}</div>
      </div>
    `;
    area.appendChild(errorEl);
    errorEl.querySelector('#close-lens').addEventListener('click', () => {
      evaluations = [];
      errorEl.remove();
    });
    return;
  }

  const ruleMap = new Map(styleGuide.map(r => [r.id, r]));

  // Count by assessment
  const counts = { follows: 0, violates: 0, partial: 0 };
  evaluations.forEach(ev => {
    if (counts[ev.assessment] !== undefined) counts[ev.assessment]++;
  });

  const summaryParts = [];
  if (counts.follows) summaryParts.push(`${counts.follows} followed`);
  if (counts.violates) summaryParts.push(`${counts.violates} violated`);
  if (counts.partial) summaryParts.push(`${counts.partial} partially met`);
  const summaryText = summaryParts.join(', ') || 'No evaluations';

  const annotationsHtml = evaluations.map((ev, i) => {
    const rule = ruleMap.get(ev.ruleId);
    const principle = rule ? escapeHtml(rule.principle) : escapeHtml(ev.ruleId);
    const assessment = ev.assessment || 'partial';
    const badgeLabel = assessment.charAt(0).toUpperCase() + assessment.slice(1);

    return `
      <div class="lens-annotation ${assessment}" data-index="${i}">
        <div class="lens-annotation-header">
          <span class="assessment-badge ${assessment}">${badgeLabel}</span>
          <span class="evaluation-principle">${principle}</span>
        </div>
        ${ev.note ? `<div class="lens-annotation-note">${escapeHtml(ev.note)}</div>` : ''}
        <div class="lens-annotation-actions">
          <button class="action-btn" data-action="dismiss" data-index="${i}">Dismiss</button>
          <button class="action-btn" data-action="challenge" data-index="${i}">Challenge</button>
        </div>
      </div>
    `;
  }).join('');

  const card = document.createElement('div');
  card.className = 'annotation-card lens-results';
  card.id = 'lens-results-card';
  card.innerHTML = `
    <div class="annotation-card-header" id="lens-header">
      <span class="annotation-type lens">Evaluate</span>
      <span class="quote-text">${summaryText}</span>
      <button class="close-annotation" id="close-lens">&times;</button>
    </div>
    <div class="annotation-card-body">
      ${annotationsHtml}
    </div>
  `;

  area.appendChild(card);

  // Attach listeners
  card.querySelector('#close-lens').addEventListener('click', (e) => {
    e.stopPropagation();
    evaluations = [];
    card.remove();
  });

  card.querySelector('#lens-header').addEventListener('click', (e) => {
    if (e.target.closest('.close-annotation')) return;
    card.classList.toggle('collapsed');
  });

  // Dismiss buttons
  card.querySelectorAll('[data-action="dismiss"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const annotation = btn.closest('.lens-annotation');
      annotation.style.opacity = '0.4';
      annotation.style.textDecoration = 'line-through';
      btn.disabled = true;
    });
  });

  // Challenge buttons — open a Mirror thread about this rule
  card.querySelectorAll('[data-action="challenge"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const ev = evaluations[idx];
      if (ev && challengeCallback) {
        challengeCallback(ev);
      }
    });
  });
}

let challengeCallback = null;
export function setOnChallenge(cb) { challengeCallback = cb; }
