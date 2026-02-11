// Mirror flow — inline reaction threads (coaching conversations)

import { addStyleRule } from '../state.js';
import { callLLM } from '../llm.js';
import {
  COACH_SYSTEM_PROMPT,
  buildCoachStartPrompt,
  buildCoachFollowupPrompt,
  cleanCoachResponse
} from '../prompts.js';
import { escapeHtml } from '../utils.js';
import { renderStyleGuidePanel } from './styleGuidePanel.js';
import { renderStats } from './stats.js';

// Track active threads
let threads = [];
let threadIdCounter = 0;

export function initMirror() {
  // No static DOM setup needed — threads are created dynamically
}

export function openMirrorThread(selectionData) {
  const threadId = `mirror-${++threadIdCounter}`;
  const thread = {
    id: threadId,
    quote: selectionData.text,
    selStart: selectionData.start,
    selEnd: selectionData.end,
    conversation: [],
    proposedRule: null,
    collapsed: false
  };
  threads.push(thread);

  // Collapse any other expanded thread
  threads.forEach(t => {
    if (t.id !== threadId) t.collapsed = true;
  });

  renderThreads();
  startCoachConversation(thread);
}

function renderThreads() {
  const area = document.getElementById('annotations-area');

  // Keep non-mirror annotations, rebuild mirror ones
  const nonMirror = area.querySelectorAll('.annotation-card:not(.mirror-thread)');
  const mirrorHtml = threads.map(t => renderThread(t)).join('');

  // Clear and rebuild: mirror threads first, then others
  const otherHTML = Array.from(nonMirror).map(el => el.outerHTML).join('');
  area.innerHTML = mirrorHtml + otherHTML;

  // Attach event listeners
  threads.forEach(t => attachThreadListeners(t));

  // Re-attach listeners for non-mirror cards (lens, variations)
  nonMirror.forEach(el => {
    const clone = area.querySelector(`#${el.id}`);
    if (clone) {
      // Listeners will be re-attached by their own modules if needed
    }
  });
}

function renderThread(thread) {
  const truncQuote = thread.quote.length > 80
    ? thread.quote.substring(0, 80) + '...'
    : thread.quote;

  const messagesHtml = thread.conversation.map(msg => `
    <div class="thread-message ${msg.role === 'user' ? 'user' : 'coach'}">
      <span class="speaker">${msg.role === 'user' ? 'You' : 'Coach'}</span>
      <div class="message-content">${escapeHtml(msg.displayContent || msg.content)}</div>
    </div>
  `).join('');

  let proposedRuleHtml = '';
  if (thread.proposedRule) {
    const rule = thread.proposedRule;
    proposedRuleHtml = `
      <div class="proposed-rule">
        <h4>Proposed Style Rule</h4>
        <div class="rule-principle">${escapeHtml(rule.principle)}</div>
        <div class="rule-details">
          ${rule.avoid && rule.avoid.length ? `<div class="avoid">Avoid: ${rule.avoid.map(a => escapeHtml(a)).join(', ')}</div>` : ''}
          ${rule.prefer && rule.prefer.length ? `<div class="prefer">Prefer: ${rule.prefer.map(p => escapeHtml(p)).join(', ')}</div>` : ''}
        </div>
        <div class="rule-actions">
          <button class="action-btn primary" data-action="add-rule" data-thread="${thread.id}">Add to Style Guide</button>
          <button class="action-btn" data-action="keep-exploring" data-thread="${thread.id}">Keep Exploring</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="annotation-card mirror-thread ${thread.collapsed ? 'collapsed' : ''}" id="${thread.id}">
      <div class="annotation-card-header" data-thread="${thread.id}">
        <span class="annotation-type mirror">React</span>
        <span class="quote-text">"${escapeHtml(truncQuote)}"</span>
        <button class="close-annotation" data-action="close-thread" data-thread="${thread.id}">&times;</button>
      </div>
      <div class="annotation-card-body">
        <div class="thread-messages" id="messages-${thread.id}">
          ${messagesHtml}
        </div>
        ${proposedRuleHtml}
        <div class="thread-input">
          <textarea id="input-${thread.id}" placeholder="Your reaction or response..."></textarea>
          <button class="action-btn primary" data-action="send" data-thread="${thread.id}">Send</button>
        </div>
        <div class="thread-actions">
          <button class="action-btn" data-action="crystallize" data-thread="${thread.id}">Crystallize as Rule</button>
          <button class="action-btn" data-action="close-thread" data-thread="${thread.id}">Done</button>
        </div>
      </div>
    </div>
  `;
}

function attachThreadListeners(thread) {
  const card = document.getElementById(thread.id);
  if (!card) return;

  // Toggle collapse
  const header = card.querySelector('.annotation-card-header');
  header.addEventListener('click', (e) => {
    if (e.target.closest('.close-annotation')) return;
    thread.collapsed = !thread.collapsed;
    // Collapse others when expanding
    if (!thread.collapsed) {
      threads.forEach(t => { if (t.id !== thread.id) t.collapsed = true; });
    }
    renderThreads();
  });

  // Send message
  const sendBtn = card.querySelector('[data-action="send"]');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => handleSend(thread));
  }

  const inputEl = card.querySelector(`#input-${thread.id}`);
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend(thread);
      }
    });
  }

  // Close thread
  card.querySelectorAll('[data-action="close-thread"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeThread(thread.id);
    });
  });

  // Crystallize
  const crystBtn = card.querySelector('[data-action="crystallize"]');
  if (crystBtn) {
    crystBtn.addEventListener('click', () => handleCrystallize(thread));
  }

  // Add proposed rule to style guide
  const addRuleBtn = card.querySelector('[data-action="add-rule"]');
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', () => {
      if (thread.proposedRule) {
        addStyleRule({
          ...thread.proposedRule,
          originalExample: thread.quote
        });
        renderStyleGuidePanel();
        closeThread(thread.id);
      }
    });
  }

  // Keep exploring (dismiss proposed rule)
  const keepBtn = card.querySelector('[data-action="keep-exploring"]');
  if (keepBtn) {
    keepBtn.addEventListener('click', () => {
      thread.proposedRule = null;
      renderThreads();
    });
  }
}

function closeThread(threadId) {
  threads = threads.filter(t => t.id !== threadId);
  const card = document.getElementById(threadId);
  if (card) card.remove();
}

async function startCoachConversation(thread) {
  // If no user reaction yet, the coach opens with a question
  const prompt = buildCoachStartPrompt(thread.quote, '');

  try {
    let response = await callLLM(prompt, COACH_SYSTEM_PROMPT);
    response = cleanCoachResponse(response);
    thread.conversation.push({ role: 'coach', content: response, displayContent: response });
    renderThreads();
    renderStats();
  } catch (e) {
    thread.conversation.push({
      role: 'coach',
      content: "What specifically catches your attention about this passage?",
      displayContent: "What specifically catches your attention about this passage?"
    });
    renderThreads();
  }
}

async function handleSend(thread) {
  const inputEl = document.getElementById(`input-${thread.id}`);
  if (!inputEl) return;
  const userMessage = inputEl.value.trim();
  if (!userMessage) return;

  thread.conversation.push({ role: 'user', content: userMessage, displayContent: userMessage });
  inputEl.value = '';
  renderThreads();

  const shouldPropose = thread.conversation.filter(m => m.role === 'user').length >= 2;

  const prompt = buildCoachFollowupPrompt(
    thread.quote,
    thread.conversation[0]?.role === 'user' ? thread.conversation[0].content : '',
    thread.conversation,
    shouldPropose
  );

  try {
    let response = await callLLM(prompt, COACH_SYSTEM_PROMPT);
    response = cleanCoachResponse(response);

    // Check for proposed rule
    const ruleMatch = response.match(/\{[^}]*"principle"[^}]*\}/);
    if (ruleMatch) {
      try {
        const rule = JSON.parse(ruleMatch[0]);
        thread.proposedRule = rule;
      } catch (e) { /* couldn't parse */ }
    }

    // Strip JSON from display
    const display = response.replace(/\{[^}]*"principle"[^}]*\}/g, '').trim();
    if (display) {
      thread.conversation.push({ role: 'coach', content: response, displayContent: display });
    }
    renderThreads();
    renderStats();
  } catch (e) {
    thread.conversation.push({
      role: 'coach',
      content: "Could you tell me more about what you're looking for?",
      displayContent: "Could you tell me more about what you're looking for?"
    });
    renderThreads();
  }
}

async function handleCrystallize(thread) {
  // Force a rule proposal from the conversation so far
  const prompt = buildCoachFollowupPrompt(
    thread.quote,
    thread.conversation[0]?.role === 'user' ? thread.conversation[0].content : '',
    thread.conversation,
    true // force proposal
  );

  try {
    let response = await callLLM(prompt, COACH_SYSTEM_PROMPT);
    response = cleanCoachResponse(response);
    const ruleMatch = response.match(/\{[^}]*"principle"[^}]*\}/);
    if (ruleMatch) {
      const rule = JSON.parse(ruleMatch[0]);
      thread.proposedRule = rule;
      renderThreads();
      renderStats();
    } else {
      // Couldn't extract a rule
      thread.conversation.push({
        role: 'coach',
        content: "I need a bit more conversation to crystallize a rule. What specifically do you want to capture as a principle?",
        displayContent: "I need a bit more conversation to crystallize a rule. What specifically do you want to capture as a principle?"
      });
      renderThreads();
    }
  } catch (e) {
    console.error('[Mirror] Crystallize failed:', e);
  }
}
