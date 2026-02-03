// Stats panel UI

import { llmStats, resetLLMStats, estimateCost, LLM_PRICING } from '../state.js';

let statsPanelVisible = false;

export function renderStats() {
  // Update stat values
  document.getElementById('stat-calls').textContent = llmStats.totalCalls.toLocaleString();
  document.getElementById('stat-input-tokens').textContent = llmStats.totalInputTokens.toLocaleString();
  document.getElementById('stat-output-tokens').textContent = llmStats.totalOutputTokens.toLocaleString();
  document.getElementById('stat-total-tokens').textContent =
    (llmStats.totalInputTokens + llmStats.totalOutputTokens).toLocaleString();

  // Update stats toggle indicator
  const statsToggle = document.getElementById('stats-toggle');
  if (llmStats.totalCalls > 0) {
    statsToggle.classList.add('has-activity');
  } else {
    statsToggle.classList.remove('has-activity');
  }

  // Update cost estimates
  renderCostEstimates();
}

function renderCostEstimates() {
  const costGrid = document.getElementById('cost-grid');

  const models = [
    { id: 'local', name: 'Local (Free)' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'claude-3-haiku-20240307', name: 'Claude Haiku' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude Sonnet' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'claude-3-opus-20240229', name: 'Claude Opus' }
  ];

  costGrid.innerHTML = models.map(model => {
    const cost = estimateCost(model.id);
    const isLocal = model.id === 'local';
    const costStr = isLocal ? 'Free' : `$${cost.total.toFixed(4)}`;
    const costClass = isLocal ? 'free' : '';

    return `
      <div class="cost-item">
        <span class="cost-model">${model.name}</span>
        <span class="cost-value ${costClass}">${costStr}</span>
      </div>
    `;
  }).join('');
}

function toggleStatsPanel() {
  statsPanelVisible = !statsPanelVisible;
  const panel = document.getElementById('stats-panel');

  if (statsPanelVisible) {
    panel.classList.add('visible');
    renderStats(); // Refresh stats when opening
  } else {
    panel.classList.remove('visible');
  }

  // Close settings panel if open
  document.getElementById('settings-panel').classList.remove('visible');
}

export function initStats() {
  // Stats toggle
  document.getElementById('stats-toggle').addEventListener('click', toggleStatsPanel);

  // Reset stats button
  document.getElementById('reset-stats').addEventListener('click', () => {
    if (confirm('Reset all LLM usage stats?')) {
      resetLLMStats();
      renderStats();
    }
  });

  // Close stats panel when clicking outside
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('stats-panel');
    const toggle = document.getElementById('stats-toggle');

    if (statsPanelVisible &&
        !panel.contains(e.target) &&
        e.target !== toggle) {
      statsPanelVisible = false;
      panel.classList.remove('visible');
    }
  });

  // Initial render
  renderStats();
}
