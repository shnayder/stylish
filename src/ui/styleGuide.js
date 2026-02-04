// Style guide section UI

import {
  styleGuide, loadStyleGuide as loadFromStorage,
  removeStyleRule, updateStyleRule, toggleStyleGuideExpanded,
  styleGuideExpanded
} from '../state.js';
import { escapeHtml } from '../utils.js';
import { callLLM } from '../llm.js';
import { SYSTEM_PROMPT } from '../prompts.js';
import { openRefinement } from './refinement.js';

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
          <button class="refine" data-rule-id="${rule.id}" title="Refine with AI">refine</button>
          <button class="remove" data-rule-id="${rule.id}" title="Remove">&times;</button>
        </div>
        <div class="rule-display">
          <div class="rule-principle">${escapeHtml(rule.principle)}</div>
          ${rule.avoid && rule.avoid.length > 0 ? `
            <div class="rule-patterns avoid">
              <span class="pattern-label">Avoid:</span>
              ${rule.avoid.map(a => `<span class="pattern-item">${escapeHtml(a)}</span>`).join('')}
            </div>
          ` : ''}
          ${rule.prefer && rule.prefer.length > 0 ? `
            <div class="rule-patterns prefer">
              <span class="pattern-label">Prefer:</span>
              ${rule.prefer.map(p => `<span class="pattern-item">${escapeHtml(p)}</span>`).join('')}
            </div>
          ` : ''}
          ${rule.originalExample ? `
            <div class="rule-examples-block">
              <div class="example-bad">
                <span class="example-label">Bad:</span>
                <div class="example-content">${escapeHtml(rule.originalExample).replace(/\n/g, '<br>')}</div>
              </div>
              ${rule.betterVersion ? `
                <div class="example-better">
                  <span class="example-label">Better:</span>
                  <div class="example-content">${escapeHtml(rule.betterVersion).replace(/\n/g, '<br>')}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
        <div class="edit-form">
          <label>Principle</label>
          <textarea class="edit-principle">${escapeHtml(rule.principle || '')}</textarea>
          <label>Avoid</label>
          <textarea class="edit-avoid">${escapeHtml((rule.avoid || []).join('\n'))}</textarea>
          <label>Prefer</label>
          <textarea class="edit-prefer">${escapeHtml((rule.prefer || []).join('\n'))}</textarea>
          <label>Bad <span class="field-hint">(select text to suggest rewrites)</span></label>
          <textarea class="edit-original" data-rule-id="${rule.id}">${escapeHtml(rule.originalExample || '')}</textarea>
          <label>Better</label>
          <textarea class="edit-better">${escapeHtml(rule.betterVersion || '')}</textarea>
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

    rulesListEl.querySelectorAll('.refine').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRefinement(e.target.dataset.ruleId);
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

    // Text selection in Bad field for suggest rewrites
    rulesListEl.querySelectorAll('.edit-original').forEach(textarea => {
      textarea.addEventListener('mouseup', handleBadTextSelection);
    });
  }
}

// Track current selection context for suggestions
let suggestContext = null;

function handleBadTextSelection(e) {
  const textarea = e.target;
  const selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd).trim();

  hideSuggestPopup();

  if (!selectedText || selectedText.length < 5) {
    return;
  }

  const ruleEl = textarea.closest('.style-rule');
  const ruleId = textarea.dataset.ruleId;

  suggestContext = {
    ruleId,
    ruleEl,
    selectedText,
    textarea
  };

  // Position popup near the textarea
  const rect = textarea.getBoundingClientRect();
  showSuggestPopup(rect.left + 10, rect.bottom + window.scrollY + 5);
}

function showSuggestPopup(x, y) {
  let popup = document.getElementById('suggest-rewrite-popup');

  if (!popup) {
    popup = document.createElement('div');
    popup.id = 'suggest-rewrite-popup';
    popup.className = 'suggest-rewrite-popup';
    popup.innerHTML = `
      <div class="suggest-popup-content">
        <span class="suggest-popup-text">Suggest rewrites for selection?</span>
        <button class="action-btn primary suggest-popup-btn">Suggest</button>
        <button class="suggest-popup-close">&times;</button>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelector('.suggest-popup-btn').addEventListener('click', generateSuggestionsForSelection);
    popup.querySelector('.suggest-popup-close').addEventListener('click', hideSuggestPopup);
  }

  popup.style.left = `${x}px`;
  popup.style.top = `${y}px`;
  popup.classList.add('visible');
}

function hideSuggestPopup() {
  const popup = document.getElementById('suggest-rewrite-popup');
  if (popup) {
    popup.classList.remove('visible');
  }
}

async function generateSuggestionsForSelection() {
  if (!suggestContext) return;

  const { ruleEl, selectedText } = suggestContext;
  const principle = ruleEl.querySelector('.edit-principle').value.trim();
  const avoidStr = ruleEl.querySelector('.edit-avoid').value.trim();
  const preferStr = ruleEl.querySelector('.edit-prefer').value.trim();

  hideSuggestPopup();

  // Show loading state in Better field
  const betterTextarea = ruleEl.querySelector('.edit-better');
  const originalBetter = betterTextarea.value;
  betterTextarea.value = originalBetter + (originalBetter ? '\n' : '') + '(generating suggestions...)';
  betterTextarea.disabled = true;

  const prompt = buildSuggestionPrompt(selectedText, principle, avoidStr, preferStr);

  try {
    const response = await callLLM(prompt, SYSTEM_PROMPT);
    const suggestions = parseSuggestions(response);

    // Append suggestions as bullet points
    const bulletSuggestions = suggestions.map(s => `• ${s}`).join('\n');
    betterTextarea.value = originalBetter + (originalBetter ? '\n' : '') + bulletSuggestions;
  } catch (e) {
    betterTextarea.value = originalBetter;
    alert(`Failed to generate suggestions: ${e.message}`);
  }

  betterTextarea.disabled = false;
  suggestContext = null;
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
    avoid: avoidStr ? avoidStr.split('\n').map(s => s.trim()).filter(s => s) : [],
    prefer: preferStr ? preferStr.split('\n').map(s => s.trim()).filter(s => s) : []
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

  // Hide suggest popup on click outside
  document.addEventListener('mousedown', (e) => {
    const popup = document.getElementById('suggest-rewrite-popup');
    if (popup && !popup.contains(e.target) && !e.target.classList.contains('edit-original')) {
      hideSuggestPopup();
    }
  });
}
