// Synthesis modal - analyze feedback and propose style rules

import {
  feedbackLog,
  getFeedbackCount,
  styleGuide,
  addStyleRule
} from '../state.js';
import { escapeHtml } from '../utils.js';
import { callLLM } from '../llm.js';
import { SYSTEM_PROMPT } from '../prompts.js';
import { renderStyleGuide } from './styleGuide.js';
import { renderFeedbackLog } from './feedbackLog.js';
import { renderStats } from './stats.js';
import { switchTab } from './tabs.js';

let proposedRules = [];
let selectedRuleIds = new Set();

export function openSynthesisModal() {
  const count = getFeedbackCount();
  if (count === 0) {
    alert('No feedback to synthesize. Vote on variations or add annotations first.');
    return;
  }

  document.getElementById('synthesis-overlay').classList.add('visible');
  document.getElementById('synthesis-loading').style.display = 'block';
  document.getElementById('synthesis-results').innerHTML = '';
  document.getElementById('apply-synthesis').disabled = true;
  proposedRules = [];
  selectedRuleIds.clear();

  synthesizeFeedback();
}

export function closeSynthesisModal() {
  document.getElementById('synthesis-overlay').classList.remove('visible');
}

async function synthesizeFeedback() {
  const prompt = buildSynthesisPrompt();

  try {
    const response = await callLLM(prompt, SYSTEM_PROMPT);
    proposedRules = parseSynthesisResponse(response);
    renderProposedRules();
    renderStats();
  } catch (e) {
    console.error('Synthesis failed:', e);
    document.getElementById('synthesis-loading').style.display = 'none';
    document.getElementById('synthesis-results').innerHTML = `
      <div class="synthesis-error">
        <p>Failed to analyze feedback: ${escapeHtml(e.message)}</p>
        <button class="action-btn" onclick="document.getElementById('synthesis-overlay').classList.remove('visible')">Close</button>
      </div>
    `;
  }
}

function buildSynthesisPrompt() {
  const feedbackText = feedbackLog.map(fb => {
    if (fb.type === 'vote') {
      return `${fb.vote === 'up' ? 'LIKED' : 'DISLIKED'} [${fb.directionName}/${fb.variationLabel}]: "${fb.variationText.substring(0, 150)}..."`;
    } else {
      const text = fb.highlightedText || fb.variationText.substring(0, 100);
      return `ANNOTATED [${fb.directionName}/${fb.variationLabel}]: "${text}"
User comment: "${fb.annotation}"`;
    }
  }).join('\n\n');

  const existingRulesText = styleGuide.map(r =>
    `- ${r.principle}`
  ).join('\n');

  const originalSentence = feedbackLog[0]?.originalSentence || '';

  return `Analyze this writing feedback and propose style rules.

ORIGINAL SENTENCE BEING EXPLORED:
"${originalSentence}"

USER FEEDBACK (${feedbackLog.length} items):
${feedbackText}

EXISTING STYLE RULES:
${existingRulesText || '(none yet)'}

YOUR TASK:
1. Identify patterns in what the user likes and dislikes
2. Propose 1-3 new style rules OR suggest edits to existing rules
3. Flag any contradictory preferences and suggest how to resolve them

OUTPUT FORMAT (JSON array):
[
  {
    "type": "new_rule",
    "rule": {
      "principle": "A clear, actionable style rule",
      "originalExample": "Example of what to avoid (from the feedback)",
      "betterVersion": "Example of what to prefer (from the feedback)",
      "avoid": ["pattern to avoid 1", "pattern to avoid 2"],
      "prefer": ["preferred pattern 1", "preferred pattern 2"]
    },
    "basedOn": "Brief explanation of which feedback items led to this rule",
    "confidence": "high"
  },
  {
    "type": "conflict",
    "description": "Description of the contradictory preferences",
    "feedbackItems": ["item 1 summary", "item 2 summary"],
    "possibleResolutions": [
      "Context-dependent resolution suggestion",
      "Choose one over the other"
    ]
  }
]

Return ONLY the JSON array, no other text.`;
}

function parseSynthesisResponse(response) {
  // Try to extract JSON from the response
  let jsonStr = response.trim();

  // Handle markdown code blocks
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find JSON array
  const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    jsonStr = arrayMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map((item, i) => ({
        ...item,
        id: `proposed-${Date.now()}-${i}`
      }));
    }
  } catch (e) {
    console.error('Failed to parse synthesis response:', e);
    // Return a fallback with the raw response
    return [{
      id: `proposed-${Date.now()}-0`,
      type: 'new_rule',
      rule: {
        principle: 'Could not parse LLM response. Please try again.',
        originalExample: null,
        betterVersion: null,
        avoid: [],
        prefer: []
      },
      basedOn: response.substring(0, 200),
      confidence: 'low'
    }];
  }

  return [];
}

function renderProposedRules() {
  document.getElementById('synthesis-loading').style.display = 'none';
  const container = document.getElementById('synthesis-results');

  if (proposedRules.length === 0) {
    container.innerHTML = '<p>No rules could be extracted from the feedback. Try adding more specific feedback.</p>';
    return;
  }

  container.innerHTML = proposedRules.map(rule => {
    if (rule.type === 'conflict') {
      return renderConflictCard(rule);
    } else {
      return renderRuleCard(rule);
    }
  }).join('');

  // Add event listeners
  setupRuleCardListeners();
  updateApplyButton();
}

function renderRuleCard(rule) {
  const isSelected = selectedRuleIds.has(rule.id);
  const typeLabel = rule.type === 'edit_existing' ? 'EDIT EXISTING' : 'NEW RULE';
  const typeClass = rule.type === 'edit_existing' ? 'edit' : 'new';
  const r = rule.rule || {};

  return `
    <div class="proposed-rule-card ${isSelected ? 'selected' : ''}" data-rule-id="${rule.id}">
      <div class="proposed-rule-type ${typeClass}">${typeLabel}</div>

      <!-- Display view -->
      <div class="proposed-rule-display">
        <div class="proposed-rule-principle">${escapeHtml(r.principle || '')}</div>
        ${rule.basedOn ? `<div class="proposed-rule-basis">Based on: ${escapeHtml(rule.basedOn)}</div>` : ''}
        ${r.originalExample ? `
          <div class="proposed-rule-examples">
            <div class="proposed-rule-example bad">✗ ${escapeHtml(r.originalExample)}</div>
            ${r.betterVersion ? `<div class="proposed-rule-example good">✓ ${escapeHtml(r.betterVersion)}</div>` : ''}
          </div>
        ` : ''}
        ${(r.avoid?.length || r.prefer?.length) ? `
          <div class="proposed-rule-patterns">
            ${r.avoid?.length ? `<span class="avoid">Avoid: ${r.avoid.map(a => escapeHtml(a)).join(', ')}</span>` : ''}
            ${r.avoid?.length && r.prefer?.length ? ' | ' : ''}
            ${r.prefer?.length ? `<span class="prefer">Prefer: ${r.prefer.map(p => escapeHtml(p)).join(', ')}</span>` : ''}
          </div>
        ` : ''}
        <div class="proposed-rule-actions">
          <button class="action-btn ${isSelected ? 'primary' : ''} toggle-rule" data-rule-id="${rule.id}">
            ${isSelected ? 'Selected ✓' : 'Include'}
          </button>
          <button class="action-btn edit-proposed-rule" data-rule-id="${rule.id}">Edit</button>
        </div>
      </div>

      <!-- Edit form (hidden by default) -->
      <div class="proposed-rule-edit-form">
        <label>Principle</label>
        <textarea class="edit-principle">${escapeHtml(r.principle || '')}</textarea>

        <label>Avoid</label>
        <textarea class="edit-avoid">${escapeHtml((r.avoid || []).join('\n'))}</textarea>

        <label>Prefer</label>
        <textarea class="edit-prefer">${escapeHtml((r.prefer || []).join('\n'))}</textarea>

        <label>Bad</label>
        <textarea class="edit-original">${escapeHtml(r.originalExample || '')}</textarea>

        <label>Better</label>
        <textarea class="edit-better">${escapeHtml(r.betterVersion || '')}</textarea>

        <div class="proposed-rule-edit-actions">
          <button class="action-btn cancel-edit" data-rule-id="${rule.id}">Cancel</button>
          <button class="action-btn primary save-edit" data-rule-id="${rule.id}">Save</button>
        </div>
      </div>
    </div>
  `;
}

function renderConflictCard(conflict) {
  return `
    <div class="proposed-rule-card conflict" data-rule-id="${conflict.id}">
      <div class="proposed-rule-type conflict">⚠️ CONFLICT DETECTED</div>
      <div class="proposed-rule-principle">${escapeHtml(conflict.description)}</div>
      ${conflict.possibleResolutions ? `
        <div class="conflict-resolutions">
          <p>Possible resolutions:</p>
          <ul>
            ${conflict.possibleResolutions.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <div class="proposed-rule-actions">
        <button class="action-btn skip-conflict" data-rule-id="${conflict.id}">Skip</button>
      </div>
    </div>
  `;
}

function setupRuleCardListeners() {
  const container = document.getElementById('synthesis-results');

  // Toggle selection
  container.querySelectorAll('.toggle-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      const ruleId = btn.dataset.ruleId;
      if (selectedRuleIds.has(ruleId)) {
        selectedRuleIds.delete(ruleId);
      } else {
        selectedRuleIds.add(ruleId);
      }
      renderProposedRules();
    });
  });

  // Edit rule - show inline form
  container.querySelectorAll('.edit-proposed-rule').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.proposed-rule-card');
      card.classList.add('editing');
    });
  });

  // Cancel edit
  container.querySelectorAll('.cancel-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.proposed-rule-card');
      card.classList.remove('editing');
      // Re-render to reset form values
      renderProposedRules();
    });
  });

  // Save edit
  container.querySelectorAll('.save-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const ruleId = btn.dataset.ruleId;
      const card = btn.closest('.proposed-rule-card');
      saveProposedRuleEdit(ruleId, card);
    });
  });

  // Skip conflict
  container.querySelectorAll('.skip-conflict').forEach(btn => {
    btn.addEventListener('click', () => {
      const ruleId = btn.dataset.ruleId;
      proposedRules = proposedRules.filter(r => r.id !== ruleId);
      renderProposedRules();
    });
  });
}

function saveProposedRuleEdit(ruleId, cardEl) {
  const rule = proposedRules.find(r => r.id === ruleId);
  if (!rule || !rule.rule) return;

  const avoidStr = cardEl.querySelector('.edit-avoid').value.trim();
  const preferStr = cardEl.querySelector('.edit-prefer').value.trim();

  rule.rule.principle = cardEl.querySelector('.edit-principle').value.trim();
  rule.rule.originalExample = cardEl.querySelector('.edit-original').value.trim() || null;
  rule.rule.betterVersion = cardEl.querySelector('.edit-better').value.trim() || null;
  rule.rule.avoid = avoidStr ? avoidStr.split('\n').map(s => s.trim()).filter(s => s) : [];
  rule.rule.prefer = preferStr ? preferStr.split('\n').map(s => s.trim()).filter(s => s) : [];

  renderProposedRules();
}

function updateApplyButton() {
  const btn = document.getElementById('apply-synthesis');
  btn.disabled = selectedRuleIds.size === 0;
  btn.textContent = selectedRuleIds.size > 0
    ? `Add ${selectedRuleIds.size} Rule${selectedRuleIds.size > 1 ? 's' : ''} to Style Guide`
    : 'Add Selected to Style Guide';
}

function applySelectedRules() {
  const rulesToAdd = proposedRules.filter(r =>
    selectedRuleIds.has(r.id) && r.type !== 'conflict' && r.rule
  );

  rulesToAdd.forEach(r => {
    addStyleRule({
      principle: r.rule.principle,
      originalExample: r.rule.originalExample || null,
      betterVersion: r.rule.betterVersion || null,
      avoid: r.rule.avoid || [],
      prefer: r.rule.prefer || []
    });
  });

  closeSynthesisModal();
  renderStyleGuide();
  renderFeedbackLog();
  switchTab('style-guide');
}

export function initSynthesis() {
  // Close button
  document.getElementById('close-synthesis').addEventListener('click', closeSynthesisModal);

  // Cancel button
  document.getElementById('cancel-synthesis').addEventListener('click', closeSynthesisModal);

  // Apply button
  document.getElementById('apply-synthesis').addEventListener('click', applySelectedRules);

  // Close on overlay click
  document.getElementById('synthesis-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'synthesis-overlay') {
      closeSynthesisModal();
    }
  });
}
