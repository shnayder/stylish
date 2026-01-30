// Style guide section UI

import {
  styleGuide, loadStyleGuide as loadFromStorage,
  removeStyleRule, updateStyleRule, toggleStyleGuideExpanded,
  styleGuideExpanded
} from '../state.js';
import { escapeHtml } from '../utils.js';
import { callLLM } from '../llm.js';
import { SYSTEM_PROMPT } from '../prompts.js';

export function initStyleGuide() {
  loadFromStorage();
  renderStyleGuide();
  setupStyleGuideEventListeners();
}

export function renderStyleGuide() {
  const countEl = document.getElementById('rule-count');
  const contentEl = document.getElementById('style-guide-content');
  const rulesListEl = document.getElementById('rules-list');
  const emptyMsg = contentEl.querySelector('.empty-message');
  const guideEl = document.getElementById('style-guide');

  countEl.textContent = styleGuide.length > 0 ? `(${styleGuide.length} rules)` : '';

  if (styleGuide.length === 0) {
    guideEl.classList.add('empty');
    emptyMsg.style.display = 'block';
    rulesListEl.innerHTML = '';
  } else {
    guideEl.classList.remove('empty');
    emptyMsg.style.display = 'none';
    rulesListEl.innerHTML = styleGuide.map(rule => `
      <div class="style-rule" data-rule-id="${rule.id}">
        <div class="rule-actions">
          <button class="edit" data-rule-id="${rule.id}" title="Edit">edit</button>
          <button class="remove" data-rule-id="${rule.id}" title="Remove">&times;</button>
        </div>
        <div class="rule-display">
          <div class="rule-principle">${escapeHtml(rule.principle)}</div>
          ${rule.originalExample ? `
            <div class="rule-original">
              <span class="example-label">Example:</span> "${escapeHtml(rule.originalExample)}"
              ${rule.betterVersion ? `<br><span class="example-label">Better:</span> "${escapeHtml(rule.betterVersion)}"` : ''}
            </div>
          ` : ''}
          <div class="rule-examples">
            ${rule.avoid && rule.avoid.length > 0 ? `<span class="avoid">Avoid: ${rule.avoid.join(', ')}</span>` : ''}
            ${rule.avoid && rule.avoid.length > 0 && rule.prefer && rule.prefer.length > 0 ? ' | ' : ''}
            ${rule.prefer && rule.prefer.length > 0 ? `<span class="prefer">Prefer: ${rule.prefer.join(', ')}</span>` : ''}
          </div>
        </div>
        <div class="edit-form">
          <label>Principle</label>
          <input type="text" class="edit-principle" value="${escapeHtml(rule.principle || '')}">
          <label>Original Example</label>
          <textarea class="edit-original">${escapeHtml(rule.originalExample || '')}</textarea>
          <label>Better Version</label>
          <div class="better-version-row">
            <textarea class="edit-better">${escapeHtml(rule.betterVersion || '')}</textarea>
            <button class="action-btn suggest-btn" data-rule-id="${rule.id}" ${!rule.originalExample ? 'disabled title="Add an original example first"' : ''}>Suggest</button>
          </div>
          <div class="suggestions-container" data-rule-id="${rule.id}" style="display: none;">
            <div class="suggestions-header">
              <span>Suggestions</span>
              <button class="action-btn suggest-more-btn" data-rule-id="${rule.id}">More</button>
            </div>
            <div class="suggestions-list"></div>
          </div>
          <label>Avoid (comma-separated)</label>
          <input type="text" class="edit-avoid" value="${escapeHtml((rule.avoid || []).join(', '))}">
          <label>Prefer (comma-separated)</label>
          <input type="text" class="edit-prefer" value="${escapeHtml((rule.prefer || []).join(', '))}">
          <div class="edit-actions">
            <button class="action-btn cancel-edit" data-rule-id="${rule.id}">Cancel</button>
            <button class="action-btn primary save-edit" data-rule-id="${rule.id}">Save</button>
          </div>
        </div>
      </div>
    `).join('');

    // Add event listeners
    rulesListEl.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeStyleRule(e.target.dataset.ruleId);
        renderStyleGuide();
      });
    });

    rulesListEl.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ruleEl = e.target.closest('.style-rule');
        ruleEl.classList.add('editing');
      });
    });

    rulesListEl.querySelectorAll('.cancel-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ruleEl = e.target.closest('.style-rule');
        ruleEl.classList.remove('editing');
        renderStyleGuide(); // Reset form values
      });
    });

    rulesListEl.querySelectorAll('.save-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ruleId = e.target.dataset.ruleId;
        const ruleEl = e.target.closest('.style-rule');
        saveRuleEdit(ruleId, ruleEl);
      });
    });

    // Suggest button listeners
    rulesListEl.querySelectorAll('.suggest-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ruleId = e.target.dataset.ruleId;
        const ruleEl = e.target.closest('.style-rule');
        generateSuggestions(ruleId, ruleEl);
      });
    });

    rulesListEl.querySelectorAll('.suggest-more-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ruleId = e.target.dataset.ruleId;
        const ruleEl = e.target.closest('.style-rule');
        generateSuggestions(ruleId, ruleEl, true);
      });
    });
  }
}

async function generateSuggestions(ruleId, ruleEl, append = false) {
  const originalExample = ruleEl.querySelector('.edit-original').value.trim();
  const principle = ruleEl.querySelector('.edit-principle').value.trim();
  const avoidStr = ruleEl.querySelector('.edit-avoid').value.trim();
  const preferStr = ruleEl.querySelector('.edit-prefer').value.trim();

  if (!originalExample) {
    alert('Please add an original example first');
    return;
  }

  const suggestBtn = ruleEl.querySelector('.suggest-btn');
  const suggestMoreBtn = ruleEl.querySelector('.suggest-more-btn');
  const container = ruleEl.querySelector('.suggestions-container');
  const listEl = container.querySelector('.suggestions-list');

  // Show loading state
  suggestBtn.disabled = true;
  suggestMoreBtn.disabled = true;
  suggestBtn.textContent = 'Loading...';

  if (!append) {
    listEl.innerHTML = '<div class="suggestion-loading">Generating suggestions...</div>';
  }
  container.style.display = 'block';

  const prompt = buildSuggestionPrompt(originalExample, principle, avoidStr, preferStr);

  try {
    const response = await callLLM(prompt, SYSTEM_PROMPT);
    const suggestions = parseSuggestions(response);

    if (!append) {
      listEl.innerHTML = '';
    } else {
      // Remove loading indicator if present
      const loadingEl = listEl.querySelector('.suggestion-loading');
      if (loadingEl) loadingEl.remove();
    }

    suggestions.forEach((suggestion, i) => {
      const suggestionEl = document.createElement('div');
      suggestionEl.className = 'suggestion-item';
      suggestionEl.innerHTML = `
        <div class="suggestion-text">${escapeHtml(suggestion)}</div>
        <button class="action-btn use-suggestion" data-index="${i}">Use</button>
      `;
      suggestionEl.querySelector('.use-suggestion').addEventListener('click', (e) => {
        e.stopPropagation();
        ruleEl.querySelector('.edit-better').value = suggestion;
        container.style.display = 'none';
      });
      listEl.appendChild(suggestionEl);
    });
  } catch (e) {
    listEl.innerHTML = `<div class="suggestion-error">Failed to generate suggestions: ${e.message}</div>`;
  }

  suggestBtn.disabled = false;
  suggestMoreBtn.disabled = false;
  suggestBtn.textContent = 'Suggest';
}

function buildSuggestionPrompt(originalExample, principle, avoidStr, preferStr) {
  let prompt = `Rewrite this text following a specific style rule.

Original text:
"${originalExample}"

Style rule: ${principle || 'Improve the writing'}`;

  if (avoidStr) {
    prompt += `\n\nPatterns to avoid: ${avoidStr}`;
  }
  if (preferStr) {
    prompt += `\n\nPreferred patterns: ${preferStr}`;
  }

  prompt += `

Generate 4 different rewrites of the original text, each applying the style rule in a slightly different way. Number them 1-4, one per line. Just output the rewrites, no explanations.`;

  return prompt;
}

function parseSuggestions(response) {
  // Split by newlines and filter out empty lines and numbering
  const lines = response.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^\d+[\.\):\-]\s*/, '').replace(/^["']|["']$/g, '').trim())
    .filter(line => line.length > 10); // Filter out very short lines

  return lines.slice(0, 5); // Return up to 5 suggestions
}

function saveRuleEdit(ruleId, ruleEl) {
  const avoidStr = ruleEl.querySelector('.edit-avoid').value.trim();
  const preferStr = ruleEl.querySelector('.edit-prefer').value.trim();

  const updates = {
    principle: ruleEl.querySelector('.edit-principle').value.trim(),
    originalExample: ruleEl.querySelector('.edit-original').value.trim() || null,
    betterVersion: ruleEl.querySelector('.edit-better').value.trim() || null,
    avoid: avoidStr ? avoidStr.split(',').map(s => s.trim()).filter(s => s) : [],
    prefer: preferStr ? preferStr.split(',').map(s => s.trim()).filter(s => s) : []
  };

  updateStyleRule(ruleId, updates);
  renderStyleGuide();
}

export function toggleStyleGuide() {
  const contentEl = document.getElementById('style-guide-content');
  const toggleIcon = document.getElementById('toggle-icon');
  const expanded = toggleStyleGuideExpanded();
  contentEl.classList.toggle('expanded', expanded);
  toggleIcon.textContent = expanded ? 'collapse' : 'expand';
}

export function expandStyleGuide() {
  if (!styleGuideExpanded) {
    toggleStyleGuide();
  }
}

function setupStyleGuideEventListeners() {
  document.getElementById('style-guide-header').addEventListener('click', toggleStyleGuide);
}
