// Style guide rule refinement modal

import { styleGuide, updateStyleRule } from '../state.js';
import { callLLM } from '../llm.js';
import { escapeHtml } from '../utils.js';
import { renderStyleGuide } from './styleGuide.js';

// Refinement state (modal-only, not persisted)
let refinementState = {
  ruleId: null,
  originalRule: null,
  workingRule: null,
  conversation: [],
  pendingSuggestion: null
};

const REFINEMENT_SYSTEM_PROMPT = `You are a writing coach helping refine a style guide rule. The user has an existing rule that isn't quite right and wants to improve it.

Your job:
1. Ask clarifying questions about what's not working
2. Understand the context and exceptions they need
3. Propose refined versions of specific fields as you go

When proposing a refinement, output JSON with ONLY the fields being changed:
- {"principle": "..."} - to update just the principle
- {"avoid": ["..."]} - to update just the avoid patterns
- {"avoid": [...], "prefer": [...]} - to update multiple fields
- {"originalExample": "...", "betterVersion": "..."} - to update examples

You can propose partial updates at any point in the conversation.
The user can accept each suggestion (updating those fields) and continue refining other aspects.

Keep the conversation focused and practical. After the JSON, you can add brief explanation.`;

export function openRefinement(ruleId) {
  const rule = styleGuide.find(r => r.id === ruleId);
  if (!rule) return;

  // Initialize state
  refinementState = {
    ruleId,
    originalRule: { ...rule },
    workingRule: { ...rule },
    conversation: [],
    pendingSuggestion: null
  };

  // Render current rule display
  renderCurrentRule();

  // Clear conversation
  document.getElementById('refinement-messages').innerHTML = '';
  document.getElementById('refinement-input').value = '';
  hideSuggestion();

  // Show modal
  document.getElementById('refinement-overlay').classList.add('visible');

  // Start with coach's opening message
  addCoachMessage("What would you like to change about this rule? Consider:\n• Is the principle too broad or too narrow?\n• Are there cases where it shouldn't apply?\n• Do the examples capture what you mean?");
}

export function closeRefinement() {
  document.getElementById('refinement-overlay').classList.remove('visible');
  refinementState = {
    ruleId: null,
    originalRule: null,
    workingRule: null,
    conversation: [],
    pendingSuggestion: null
  };
}

function renderCurrentRule() {
  const rule = refinementState.workingRule;
  if (!rule) return;

  const container = document.getElementById('refinement-current-rule');
  let html = `<div class="rule-principle">${escapeHtml(rule.principle || '')}</div>`;

  if (rule.avoid && rule.avoid.length > 0) {
    html += `<div class="rule-patterns"><span class="pattern-label">Avoid:</span> ${rule.avoid.map(a => escapeHtml(a)).join(', ')}</div>`;
  }
  if (rule.prefer && rule.prefer.length > 0) {
    html += `<div class="rule-patterns"><span class="pattern-label">Prefer:</span> ${rule.prefer.map(p => escapeHtml(p)).join(', ')}</div>`;
  }
  if (rule.originalExample || rule.betterVersion) {
    html += `<div class="rule-examples">`;
    if (rule.originalExample) {
      html += `<div class="example-bad">Bad: "${escapeHtml(rule.originalExample)}"</div>`;
    }
    if (rule.betterVersion) {
      html += `<div class="example-better">Better: "${escapeHtml(rule.betterVersion)}"</div>`;
    }
    html += `</div>`;
  }

  container.innerHTML = html;
}

function addUserMessage(content) {
  refinementState.conversation.push({ role: 'user', content });
  const messagesEl = document.getElementById('refinement-messages');
  messagesEl.innerHTML += `
    <div class="conv-message user">
      <span class="speaker">You</span>
      <div class="content">${escapeHtml(content)}</div>
    </div>
  `;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addCoachMessage(content) {
  refinementState.conversation.push({ role: 'assistant', content });
  const messagesEl = document.getElementById('refinement-messages');

  // Strip out any JSON from display
  const displayContent = content.replace(/\{[\s\S]*?\}/g, '').trim();

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

function buildRefinementPrompt(userMessage) {
  const rule = refinementState.workingRule;
  let ruleText = `Principle: ${rule.principle || '(none)'}`;
  if (rule.avoid && rule.avoid.length) {
    ruleText += `\nAvoid: ${rule.avoid.join(', ')}`;
  }
  if (rule.prefer && rule.prefer.length) {
    ruleText += `\nPrefer: ${rule.prefer.join(', ')}`;
  }
  if (rule.originalExample) {
    ruleText += `\nBad example: "${rule.originalExample}"`;
  }
  if (rule.betterVersion) {
    ruleText += `\nBetter example: "${rule.betterVersion}"`;
  }

  let prompt = `CURRENT RULE:\n${ruleText}\n\nCONVERSATION HISTORY:\n`;

  refinementState.conversation.forEach(msg => {
    const speaker = msg.role === 'user' ? 'User' : 'Coach';
    prompt += `${speaker}: ${msg.content}\n`;
  });

  prompt += `\nUser: ${userMessage}\n\nRespond to the user. If you have enough context to suggest a specific improvement, include a JSON object with the field(s) to update.`;

  return prompt;
}

async function sendMessage() {
  const input = document.getElementById('refinement-input');
  const userMessage = input.value.trim();
  if (!userMessage) return;

  addUserMessage(userMessage);
  input.value = '';

  const prompt = buildRefinementPrompt(userMessage);

  try {
    const response = await callLLM(prompt, REFINEMENT_SYSTEM_PROMPT);
    addCoachMessage(response);

    // Check for JSON suggestion in response
    const jsonMatch = response.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const suggestion = JSON.parse(jsonMatch[0]);
        // Only show if it has valid rule fields
        if (suggestion.principle || suggestion.avoid || suggestion.prefer ||
            suggestion.originalExample || suggestion.betterVersion) {
          showSuggestion(suggestion);
        }
      } catch (e) {
        // Couldn't parse, continue conversation
      }
    }
  } catch (e) {
    addCoachMessage("I'm having trouble connecting. Could you rephrase what you'd like to change?");
  }
}

function showSuggestion(suggestion) {
  refinementState.pendingSuggestion = suggestion;

  const container = document.getElementById('refinement-suggestion-content');
  let html = '';

  const fieldLabels = {
    principle: 'Principle',
    avoid: 'Avoid',
    prefer: 'Prefer',
    originalExample: 'Bad Example',
    betterVersion: 'Better Example'
  };

  for (const [key, label] of Object.entries(fieldLabels)) {
    if (suggestion[key] !== undefined) {
      const value = Array.isArray(suggestion[key])
        ? suggestion[key].join(', ')
        : suggestion[key];
      html += `
        <div class="field-update">
          <span class="field-name">${label}:</span>
          <span class="field-value">${escapeHtml(value)}</span>
        </div>
      `;
    }
  }

  container.innerHTML = html;
  document.getElementById('refinement-suggestion').classList.add('visible');
}

function hideSuggestion() {
  document.getElementById('refinement-suggestion').classList.remove('visible');
  refinementState.pendingSuggestion = null;
}

function acceptSuggestion() {
  if (!refinementState.pendingSuggestion) return;

  // Merge suggestion into working rule
  const suggestion = refinementState.pendingSuggestion;
  for (const key of ['principle', 'avoid', 'prefer', 'originalExample', 'betterVersion']) {
    if (suggestion[key] !== undefined) {
      refinementState.workingRule[key] = suggestion[key];
    }
  }

  // Update display
  renderCurrentRule();
  hideSuggestion();

  // Add acknowledgment to conversation
  addCoachMessage("Got it, I've updated that field. Anything else you'd like to refine?");
}

function saveRefinement() {
  if (!refinementState.ruleId) return;

  // Check if anything changed
  const original = refinementState.originalRule;
  const working = refinementState.workingRule;
  const hasChanges = JSON.stringify(original) !== JSON.stringify(working);

  if (hasChanges) {
    updateStyleRule(refinementState.ruleId, {
      principle: working.principle,
      avoid: working.avoid,
      prefer: working.prefer,
      originalExample: working.originalExample,
      betterVersion: working.betterVersion
    });
    renderStyleGuide();
  }

  closeRefinement();
}

export function initRefinement() {
  // Close button
  document.getElementById('close-refinement').addEventListener('click', closeRefinement);

  // Cancel button
  document.getElementById('cancel-refinement').addEventListener('click', closeRefinement);

  // Click outside to close
  document.getElementById('refinement-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'refinement-overlay') {
      closeRefinement();
    }
  });

  // Send message
  document.getElementById('send-refinement').addEventListener('click', sendMessage);

  // Enter to send
  document.getElementById('refinement-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Accept/Ignore suggestion
  document.getElementById('accept-suggestion').addEventListener('click', acceptSuggestion);
  document.getElementById('ignore-suggestion').addEventListener('click', hideSuggestion);

  // Save refinement
  document.getElementById('save-refinement').addEventListener('click', saveRefinement);
}
