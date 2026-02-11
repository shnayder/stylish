// Style Guide Panel — collapsible summary and full management view

import { styleGuide } from '../state.js';
import { escapeHtml } from '../utils.js';
import { renderStyleGuide } from './styleGuide.js';

export function initStyleGuidePanel() {
  // Collapsible panel toggle
  const toggle = document.getElementById('style-guide-toggle');
  const panel = document.getElementById('style-guide-panel');
  toggle.addEventListener('click', (e) => {
    // Don't toggle if clicking manage button
    if (e.target.closest('#manage-rules-btn')) return;
    panel.classList.toggle('collapsed');
  });

  // Manage Rules button — open full view
  document.getElementById('manage-rules-btn').addEventListener('click', () => {
    openFullGuideView();
  });

  // Close full view
  document.getElementById('close-full-guide').addEventListener('click', () => {
    closeFullGuideView();
  });

  // Initial render
  renderStyleGuidePanel();
}

export function renderStyleGuidePanel() {
  const summary = document.getElementById('style-guide-summary');
  const countEl = document.getElementById('rule-count');
  const fullCountEl = document.getElementById('full-rule-count');

  const count = styleGuide.length;
  const countText = count > 0 ? `(${count})` : '';
  if (countEl) countEl.textContent = countText;
  if (fullCountEl) fullCountEl.textContent = countText;

  if (count === 0) {
    summary.innerHTML = '<p class="empty-guide">No style rules yet. Use React on selected text to start building your style guide.</p>';
    return;
  }

  // Show compact summaries of rules
  const rulesHtml = styleGuide.map(rule => {
    const cats = (rule.categories || [])
      .map(c => `<span class="category-tag">${escapeHtml(c)}</span>`)
      .join(' ');

    return `
      <div class="rule-summary">
        <span class="rule-principle-text">${escapeHtml(rule.principle)}</span>
        ${cats ? `<span class="rule-category-tags">${cats}</span>` : ''}
      </div>
    `;
  }).join('');

  summary.innerHTML = rulesHtml;
}

function openFullGuideView() {
  const view = document.getElementById('style-guide-full-view');
  view.classList.add('visible');
  // Render the full style guide using the existing module
  renderStyleGuide();
}

function closeFullGuideView() {
  const view = document.getElementById('style-guide-full-view');
  view.classList.remove('visible');
  // Refresh the summary panel
  renderStyleGuidePanel();
}
