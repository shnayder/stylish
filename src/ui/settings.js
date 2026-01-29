// Settings panel UI

import { settings, loadSettings, saveSettingsToStorage } from '../state.js';
import { testConnection as testLLMConnection } from '../llm.js';

let statusTimeoutId = null;

export function initSettings() {
  loadSettings();
  applySettingsToUI();
  setupSettingsEventListeners();

  // Auto-test connection on load if settings exist
  if (settings.provider === 'local') {
    testConnection().catch(() => {});
  }
}

function applySettingsToUI() {
  document.querySelector(`input[name="provider"][value="${settings.provider}"]`).checked = true;
  document.getElementById('local-url').value = settings.localUrl;
  document.getElementById('anthropic-key').value = settings.anthropicKey;
  updateProviderUI();
}

function updateProviderUI() {
  const provider = document.querySelector('input[name="provider"]:checked').value;
  document.getElementById('local-settings').style.display = provider === 'local' ? 'block' : 'none';
  document.getElementById('anthropic-settings').style.display = provider === 'anthropic' ? 'block' : 'none';
}

function showSettingsStatus(message, type) {
  const status = document.getElementById('settings-status');
  status.textContent = message;
  status.className = `settings-status ${type}`;
  status.style.display = 'block';

  if (statusTimeoutId) {
    clearTimeout(statusTimeoutId);
  }
  statusTimeoutId = setTimeout(() => { status.style.display = 'none'; }, 3000);
}

export function saveSettings() {
  const newSettings = {
    provider: document.querySelector('input[name="provider"]:checked').value,
    localUrl: document.getElementById('local-url').value,
    anthropicKey: document.getElementById('anthropic-key').value
  };
  saveSettingsToStorage(newSettings);
  showSettingsStatus('Settings saved', 'success');
}

export async function testConnection() {
  try {
    const result = await testLLMConnection();
    if (result.success) {
      showSettingsStatus(result.message, result.isWarning ? 'warning' : 'success');
      document.getElementById('settings-toggle').classList.add('connected');
    } else {
      showSettingsStatus(result.message, 'error');
      document.getElementById('settings-toggle').classList.remove('connected');
    }
  } catch (e) {
    let message = e.message;
    if (e.message === 'Failed to fetch' || e.message.includes('Load failed')) {
      message = 'CORS error - Enable CORS in LM Studio settings, or serve this file via a local server';
    }
    showSettingsStatus(`Connection failed: ${message}`, 'error');
    document.getElementById('settings-toggle').classList.remove('connected');
  }
}

function setupSettingsEventListeners() {
  document.getElementById('settings-toggle').addEventListener('click', () => {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('visible');
  });

  document.querySelectorAll('input[name="provider"]').forEach(radio => {
    radio.addEventListener('change', updateProviderUI);
  });

  document.getElementById('test-connection').addEventListener('click', testConnection);
  document.getElementById('save-settings').addEventListener('click', saveSettings);

  // Close settings when clicking outside
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('settings-panel');
    const toggle = document.getElementById('settings-toggle');
    if (panel.classList.contains('visible') &&
        !panel.contains(e.target) &&
        !toggle.contains(e.target)) {
      panel.classList.remove('visible');
    }
  });
}
