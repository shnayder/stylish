// Alternatives grid UI

import {
  alternatives, removeAlternative as removeAlt,
  reactions, addReaction, removeReaction, removeReactionsForAlternative, getReactionsForAlternative,
  currentSelection, setCurrentSelection, clearCurrentSelection
} from '../state.js';
import { truncate } from '../utils.js';
import { openDrillDown } from './drillDown.js';
import { openRewriteView } from './rewriteView.js';

// Track selection position for rewrite
let selectionStartIndex = -1;
let selectionEndIndex = -1;

let onReactionsChanged = null;

export function setReactionsChangedCallback(callback) {
  onReactionsChanged = callback;
}

export function renderAlternatives() {
  const container = document.getElementById('alternatives');
  container.innerHTML = alternatives.map((alt, index) => `
    <div class="alternative${index === 0 ? ' selected' : ''}" data-alt-id="${alt.id}">
      <button class="remove-alternative" data-alt-id="${alt.id}" title="Remove">&times;</button>
      <div class="style-tags">
        ${alt.tags.map(tag => `<span class="tag ${tag.type}">${tag.text}</span>`).join('')}
      </div>
      <div class="description-text" data-alt-id="${alt.id}">
        ${alt.text.split('\n\n').map(p => `<p>${p}</p>`).join('')}
      </div>
      <div class="reaction-input">
        <div class="input-row">
          <textarea placeholder="Your reaction to this version..." data-alt-id="${alt.id}"></textarea>
          <button class="action-btn add-reaction-btn" data-alt-id="${alt.id}">Add</button>
        </div>
        <div class="reactions-list" data-alt-id="${alt.id}"></div>
      </div>
      <div class="alternative-actions">
        <button class="action-btn primary">Use This</button>
        <button class="action-btn">Vary This</button>
        <button class="action-btn">More Like This</button>
      </div>
    </div>
  `).join('');

  // Add event listeners for reaction buttons
  document.querySelectorAll('.add-reaction-btn').forEach(btn => {
    btn.addEventListener('click', handleAddReaction);
  });

  // Add event listeners for text selection
  document.querySelectorAll('.description-text').forEach(el => {
    el.addEventListener('mouseup', handleTextSelection);
  });

  // Add event listeners for remove buttons
  document.querySelectorAll('.remove-alternative').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const altId = e.target.dataset.altId;
      removeAlternative(altId);
    });
  });
}

export function removeAlternative(altId) {
  if (removeAlt(altId)) {
    removeReactionsForAlternative(altId);
    renderAlternatives();
    renderAllReactions();
    if (onReactionsChanged) onReactionsChanged();
  }
}

function handleAddReaction(e) {
  const altId = e.target.dataset.altId;
  const textarea = document.querySelector(`.reaction-input textarea[data-alt-id="${altId}"]`);
  const text = textarea.value.trim();

  if (text) {
    addReaction({
      alternativeId: altId,
      quote: null,
      text: text
    });
    textarea.value = '';
    renderReactionsForAlternative(altId);
    renderAllReactions();
    if (onReactionsChanged) onReactionsChanged();
  }
}

function handleTextSelection(e) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    const altId = e.currentTarget.dataset.altId;
    setCurrentSelection(selectedText, altId);

    // Calculate start/end indices in the full text
    const alt = alternatives.find(a => a.id === altId);
    if (alt) {
      const fullText = alt.text;
      const startIdx = fullText.indexOf(selectedText);
      if (startIdx !== -1) {
        selectionStartIndex = startIdx;
        selectionEndIndex = startIdx + selectedText.length;
      }
    }

    showSelectionPopup(e);
  }
}

function showSelectionPopup(e) {
  const popup = document.getElementById('selection-popup');
  const selectedTextEl = document.getElementById('popup-selected-text');
  const inputEl = document.getElementById('popup-reaction-input');

  // Show the selected text (truncated if too long)
  const displayText = currentSelection.text.length > 100
    ? currentSelection.text.substring(0, 100) + '...'
    : currentSelection.text;
  selectedTextEl.textContent = `"${displayText}"`;

  // Position the popup near the selection
  const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 10}px`;
  popup.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - 300)}px`;

  popup.classList.add('visible');
  inputEl.value = '';
  inputEl.focus();
}

export function hideSelectionPopup() {
  const popup = document.getElementById('selection-popup');
  popup.classList.remove('visible');
  clearCurrentSelection();
}

export function handleRemoveReaction(id) {
  removeReaction(id);
  // Re-render reactions for all alternatives
  alternatives.forEach(alt => renderReactionsForAlternative(alt.id));
  renderAllReactions();
  if (onReactionsChanged) onReactionsChanged();
}

export function renderReactionsForAlternative(altId) {
  const container = document.querySelector(`.reactions-list[data-alt-id="${altId}"]`);
  if (!container) return;

  const altReactions = getReactionsForAlternative(altId);

  container.innerHTML = altReactions.map(r => `
    <div class="reaction-item">
      <button class="remove-reaction" data-reaction-id="${r.id}">&times;</button>
      ${r.quote ? `<div class="reaction-quote">"${truncate(r.quote, 80)}"</div>` : ''}
      <div class="reaction-text">${r.text}</div>
    </div>
  `).join('');

  // Add remove listeners
  container.querySelectorAll('.remove-reaction').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleRemoveReaction(parseInt(e.target.dataset.reactionId));
    });
  });
}

export function renderAllReactions() {
  const container = document.getElementById('all-reactions');

  if (reactions.length === 0) {
    container.innerHTML = '<p class="empty-state">Select text or add reactions to alternatives to collect your thoughts here.</p>';
    return;
  }

  container.innerHTML = reactions.map(r => {
    const alt = alternatives.find(a => a.id === r.alternativeId);
    const altLabel = alt ? alt.tags[0].text : 'Unknown';
    return `
      <div class="reaction-item">
        <button class="remove-reaction" data-reaction-id="${r.id}">&times;</button>
        <div class="source-label">On "${altLabel}" version</div>
        ${r.quote ? `<div class="reaction-quote">"${truncate(r.quote, 80)}"</div>` : ''}
        <div class="reaction-text">${r.text}</div>
      </div>
    `;
  }).join('');

  // Add remove listeners
  container.querySelectorAll('.remove-reaction').forEach(btn => {
    btn.addEventListener('click', (e) => {
      handleRemoveReaction(parseInt(e.target.dataset.reactionId));
    });
  });
}

export function initPopupEventListeners() {
  document.getElementById('popup-cancel').addEventListener('click', hideSelectionPopup);

  document.getElementById('popup-save').addEventListener('click', () => {
    const inputEl = document.getElementById('popup-reaction-input');
    const text = inputEl.value.trim();

    if (text && currentSelection.text) {
      addReaction({
        alternativeId: currentSelection.alternativeId,
        quote: currentSelection.text,
        text: text
      });
      renderReactionsForAlternative(currentSelection.alternativeId);
      renderAllReactions();
      if (onReactionsChanged) onReactionsChanged();
      hideSelectionPopup();
    }
  });

  document.getElementById('popup-drill-down').addEventListener('click', () => {
    const inputEl = document.getElementById('popup-reaction-input');
    const reactionText = inputEl.value.trim();

    if (currentSelection.text) {
      // Capture values before hideSelectionPopup clears them
      const selectedText = currentSelection.text;
      const altId = currentSelection.alternativeId;
      hideSelectionPopup();
      openDrillDown(selectedText, reactionText, altId);
    }
  });

  document.getElementById('popup-rewrite').addEventListener('click', () => {
    if (currentSelection.text) {
      // Capture values before hideSelectionPopup clears them
      const selectedText = currentSelection.text;
      const altId = currentSelection.alternativeId;
      const startIdx = selectionStartIndex;
      const endIdx = selectionEndIndex;

      // Get the full text of the alternative
      const alt = alternatives.find(a => a.id === altId);
      if (alt) {
        hideSelectionPopup();
        openRewriteView(altId, alt.text, selectedText, startIdx, endIdx);
      }
    }
  });

  // Allow Enter to submit in popup
  document.getElementById('popup-reaction-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('popup-save').click();
    }
  });

  // Close popup when clicking outside
  document.addEventListener('mousedown', (e) => {
    const popup = document.getElementById('selection-popup');
    if (popup.classList.contains('visible') && !popup.contains(e.target)) {
      // Small delay to allow text selection to complete
      setTimeout(() => {
        if (!window.getSelection().toString().trim()) {
          hideSelectionPopup();
        }
      }, 100);
    }
  });
}
