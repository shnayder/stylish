// Drill-down coaching modal UI

import {
  drillDownState, initDrillDownState, resetDrillDownState,
  addDrillDownMessage, setProposedRule, addStyleRule
} from '../state.js';
import { callLLM } from '../llm.js';
import {
  COACH_SYSTEM_PROMPT,
  buildCoachStartPrompt,
  buildCoachFollowupPrompt,
  cleanCoachResponse
} from '../prompts.js';
import { escapeHtml } from '../utils.js';
import { renderStyleGuide } from './styleGuide.js';
import { renderStyleGuidePanel } from './styleGuidePanel.js';

export function openDrillDown(selectedText, initialReaction, alternativeId) {
  initDrillDownState(selectedText, initialReaction, alternativeId);

  // Update modal UI
  document.getElementById('modal-selected-text').textContent = `"${selectedText}"`;
  document.getElementById('modal-initial-reaction').textContent = initialReaction || '(no initial reaction)';
  document.getElementById('conversation-messages').innerHTML = '';
  document.getElementById('coach-input').value = '';
  document.getElementById('proposed-rule').classList.remove('visible');
  document.getElementById('add-to-style-guide').disabled = true;

  // Show modal
  document.getElementById('drill-down-overlay').classList.add('visible');

  // Start the coaching conversation
  startCoachConversation();
}

export function closeDrillDown() {
  document.getElementById('drill-down-overlay').classList.remove('visible');
  resetDrillDownState();
}

async function startCoachConversation() {
  const prompt = buildCoachStartPrompt(
    drillDownState.selectedText,
    drillDownState.initialReaction
  );

  try {
    let response = await callLLM(prompt, COACH_SYSTEM_PROMPT);
    response = cleanCoachResponse(response);
    addCoachMessage(response);
  } catch (e) {
    addCoachMessage("I'd love to help you explore this. What specifically bothers you about this passage - is it the word choice, the rhythm, or the idea being expressed?");
  }
}

async function sendToCoach() {
  const input = document.getElementById('coach-input');
  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Add user message
  addUserMessage(userMessage);
  input.value = '';

  const shouldPropose = drillDownState.conversation.length >= 4;

  const prompt = buildCoachFollowupPrompt(
    drillDownState.selectedText,
    drillDownState.initialReaction,
    drillDownState.conversation,
    shouldPropose
  );

  try {
    let response = await callLLM(prompt, COACH_SYSTEM_PROMPT);
    response = cleanCoachResponse(response);
    addCoachMessage(response);

    // Check if response contains a proposed rule
    const ruleMatch = response.match(/\{[^}]*"principle"[^}]*\}/);
    if (ruleMatch) {
      try {
        const rule = JSON.parse(ruleMatch[0]);
        showProposedRule(rule);
      } catch (e) {
        // Couldn't parse rule, continue conversation
      }
    }
  } catch (e) {
    addCoachMessage("I'm having trouble connecting. Could you tell me more about what you're looking for in this description?");
  }
}

function addUserMessage(content) {
  addDrillDownMessage('user', content);
  const messagesEl = document.getElementById('conversation-messages');
  messagesEl.innerHTML += `
    <div class="conv-message user">
      <span class="speaker">You</span>
      <div class="content">${escapeHtml(content)}</div>
    </div>
  `;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addCoachMessage(content) {
  addDrillDownMessage('coach', content);
  const messagesEl = document.getElementById('conversation-messages');

  // Strip out any JSON from display
  const displayContent = content.replace(/\{[^}]*"principle"[^}]*\}/g, '').trim();

  if (displayContent) {
    messagesEl.innerHTML += `
      <div class="conv-message coach">
        <span class="speaker">Coach</span>
        <div class="content">${escapeHtml(displayContent)}</div>
      </div>
    `;
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showProposedRule(rule) {
  // Always include the original example from the drill-down
  rule.originalExample = drillDownState.selectedText;

  setProposedRule(rule);

  const previewEl = document.getElementById('rule-preview');
  const principleEl = document.getElementById('preview-principle');
  const examplesEl = document.getElementById('preview-examples');

  principleEl.textContent = rule.principle || '';

  let examplesHtml = '';

  // Show original example
  if (rule.originalExample) {
    examplesHtml += `<div style="margin-bottom: 8px; font-style: italic; color: #666;">
      <span style="font-style: normal; color: #888;">Original:</span> "${escapeHtml(rule.originalExample)}"
    </div>`;
  }
  if (rule.betterVersion) {
    examplesHtml += `<div style="margin-bottom: 8px; font-style: italic; color: #5a5;">
      <span style="font-style: normal; color: #888;">Better:</span> "${escapeHtml(rule.betterVersion)}"
    </div>`;
  }

  if (rule.avoid && rule.avoid.length > 0) {
    examplesHtml += `<span class="avoid">Avoid: ${rule.avoid.join(', ')}</span>`;
  }
  if (rule.prefer && rule.prefer.length > 0) {
    if (rule.avoid && rule.avoid.length > 0) examplesHtml += '<br>';
    examplesHtml += `<span class="prefer">Prefer: ${rule.prefer.join(', ')}</span>`;
  }
  examplesEl.innerHTML = examplesHtml;

  document.getElementById('proposed-rule').classList.add('visible');
  document.getElementById('add-to-style-guide').disabled = false;
}

function toggleRuleEdit() {
  const previewEl = document.getElementById('rule-preview');
  const editArea = document.getElementById('rule-edit-area');
  const editBtn = document.getElementById('edit-rule-btn');
  const saveBtn = document.getElementById('save-rule-edit');

  if (editArea.style.display === 'none' || !editArea.style.display) {
    // Start editing
    editArea.value = JSON.stringify(drillDownState.proposedRule, null, 2);
    editArea.style.display = 'block';
    previewEl.style.display = 'none';
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
  } else {
    // Save edit
    try {
      const editedRule = JSON.parse(editArea.value);
      setProposedRule(editedRule);
      showProposedRule(editedRule);
    } catch (e) {
      alert('Invalid JSON format');
      return;
    }
    editArea.style.display = 'none';
    previewEl.style.display = 'block';
    editBtn.style.display = 'inline-block';
    saveBtn.style.display = 'none';
  }
}

function addRuleToStyleGuide() {
  if (drillDownState.proposedRule) {
    addStyleRule(drillDownState.proposedRule);
    closeDrillDown();
    renderStyleGuide();
    renderStyleGuidePanel();
  }
}

export function initDrillDownEventListeners() {
  document.getElementById('close-drill-down').addEventListener('click', closeDrillDown);

  document.getElementById('drill-down-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('drill-down-overlay')) {
      closeDrillDown();
    }
  });

  document.getElementById('send-to-coach').addEventListener('click', sendToCoach);

  document.getElementById('coach-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendToCoach();
    }
  });

  document.getElementById('edit-rule-btn').addEventListener('click', toggleRuleEdit);
  document.getElementById('save-rule-edit').addEventListener('click', toggleRuleEdit);

  document.getElementById('keep-exploring').addEventListener('click', () => {
    document.getElementById('proposed-rule').classList.remove('visible');
    document.getElementById('add-to-style-guide').disabled = true;
    setProposedRule(null);
  });

  document.getElementById('add-to-style-guide').addEventListener('click', addRuleToStyleGuide);
}
