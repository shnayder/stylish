// Feedback log panel UI

import {
  feedbackLog,
  getFeedbackByDirection,
  getFeedbackCount,
  removeFeedback,
  updateFeedback,
  clearFeedbackLog
} from '../state.js';
import { escapeHtml, truncate } from '../utils.js';

let feedbackLogExpanded = false;
let onSynthesizeCallback = null;

export function setOnSynthesizeCallback(callback) {
  onSynthesizeCallback = callback;
}

export function renderFeedbackLog() {
  const listEl = document.getElementById('feedback-log-list');
  const emptyEl = document.getElementById('feedback-log-empty');
  const actionsEl = document.getElementById('feedback-log-actions');
  const countEl = document.getElementById('feedback-count');

  const count = getFeedbackCount();
  countEl.textContent = count > 0 ? `(${count})` : '';
  countEl.style.display = count > 0 ? 'inline' : 'none';

  if (count === 0) {
    emptyEl.style.display = 'block';
    listEl.innerHTML = '';
    actionsEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  actionsEl.style.display = 'flex';

  const grouped = getFeedbackByDirection();
  listEl.innerHTML = Object.entries(grouped).map(([dirId, group]) => `
    <div class="feedback-group" data-direction="${dirId}">
      <div class="feedback-group-header">${escapeHtml(group.name)}</div>
      <div class="feedback-group-items">
        ${group.items.map(fb => renderFeedbackItem(fb)).join('')}
      </div>
    </div>
  `).join('');

  // Add event listeners
  setupFeedbackItemListeners();
}

function renderFeedbackItem(fb) {
  if (fb.type === 'vote') {
    const icon = fb.vote === 'up' ? '👍' : '👎';
    const voteClass = fb.vote === 'up' ? 'vote-up' : 'vote-down';
    return `
      <div class="feedback-item ${voteClass}" data-feedback-id="${fb.id}">
        <div class="feedback-item-header">
          <span class="feedback-icon">${icon}</span>
          <span class="feedback-label">[${escapeHtml(fb.variationLabel || 'Unlabeled')}]</span>
          <button class="feedback-delete" data-feedback-id="${fb.id}" title="Delete">&times;</button>
        </div>
        <div class="feedback-text">"${escapeHtml(fb.variationText)}"</div>
      </div>
    `;
  } else if (fb.type === 'highlight') {
    return `
      <div class="feedback-item annotation" data-feedback-id="${fb.id}">
        <div class="feedback-item-header">
          <span class="feedback-icon">💬</span>
          <span class="feedback-label">[${escapeHtml(fb.variationLabel || 'Unlabeled')}]</span>
          <button class="feedback-delete" data-feedback-id="${fb.id}" title="Delete">&times;</button>
        </div>
        <div class="feedback-highlighted-text">"${escapeHtml(fb.highlightedText)}"</div>
        <div class="feedback-annotation">${escapeHtml(fb.annotation)}</div>
        <div class="feedback-item-actions">
          <button class="action-btn feedback-edit" data-feedback-id="${fb.id}">Edit</button>
        </div>
      </div>
    `;
  } else if (fb.type === 'card_annotation') {
    return `
      <div class="feedback-item annotation" data-feedback-id="${fb.id}">
        <div class="feedback-item-header">
          <span class="feedback-icon">💬</span>
          <span class="feedback-label">[${escapeHtml(fb.variationLabel || 'Unlabeled')}]</span>
          <span class="feedback-type-label">Full variation</span>
          <button class="feedback-delete" data-feedback-id="${fb.id}" title="Delete">&times;</button>
        </div>
        <div class="feedback-annotation">${escapeHtml(fb.annotation)}</div>
        <div class="feedback-item-actions">
          <button class="action-btn feedback-edit" data-feedback-id="${fb.id}">Edit</button>
        </div>
      </div>
    `;
  }
  return '';
}

function setupFeedbackItemListeners() {
  const listEl = document.getElementById('feedback-log-list');

  // Delete buttons
  listEl.querySelectorAll('.feedback-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const feedbackId = btn.dataset.feedbackId;
      removeFeedback(feedbackId);
      renderFeedbackLog();
    });
  });

  // Edit buttons
  listEl.querySelectorAll('.feedback-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const feedbackId = btn.dataset.feedbackId;
      const fb = feedbackLog.find(f => f.id === feedbackId);
      if (fb && fb.annotation) {
        const newAnnotation = prompt('Edit your annotation:', fb.annotation);
        if (newAnnotation !== null && newAnnotation.trim()) {
          updateFeedback(feedbackId, { annotation: newAnnotation.trim() });
          renderFeedbackLog();
        }
      }
    });
  });
}

export function initFeedbackLog() {
  // Toggle expand/collapse
  document.getElementById('toggle-feedback-log').addEventListener('click', () => {
    feedbackLogExpanded = !feedbackLogExpanded;
    const content = document.getElementById('feedback-log-content');
    const btn = document.getElementById('toggle-feedback-log');

    if (feedbackLogExpanded) {
      content.classList.add('expanded');
      btn.textContent = 'Collapse';
    } else {
      content.classList.remove('expanded');
      btn.textContent = 'Expand';
    }
  });

  // Clear all feedback
  document.getElementById('clear-feedback').addEventListener('click', () => {
    if (confirm('Clear all feedback? This cannot be undone.')) {
      clearFeedbackLog();
      renderFeedbackLog();
    }
  });

  // Synthesize rules
  document.getElementById('synthesize-rules').addEventListener('click', () => {
    if (onSynthesizeCallback) {
      onSynthesizeCallback();
    }
  });
}
