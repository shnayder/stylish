// Writing area — central text surface with selection-based actions

import { styleGuide, isGenerating, setGenerating } from '../state.js';
import { callLLM } from '../llm.js';
import { SYSTEM_PROMPT, buildGenerationPrompt, getStyleGuideText } from '../prompts.js';
import { escapeHtml } from '../utils.js';
import { renderStats } from './stats.js';

const STORAGE_KEY = 'writing-text';
let selectionMenuVisible = false;
let currentSelectionData = null;

// Callbacks for the three flows
let onReactCallback = null;
let onVariationsCallback = null;
let onEvaluateSelectionCallback = null;
let onEvaluateFullCallback = null;

export function setOnReact(cb) { onReactCallback = cb; }
export function setOnVariations(cb) { onVariationsCallback = cb; }
export function setOnEvaluateSelection(cb) { onEvaluateSelectionCallback = cb; }
export function setOnEvaluateFull(cb) { onEvaluateFullCallback = cb; }

export function getWritingText() {
  return document.getElementById('writing-text').value;
}

export function setWritingText(text) {
  const textarea = document.getElementById('writing-text');
  textarea.value = text;
  localStorage.setItem(STORAGE_KEY, text);
}

export function replaceSelection(start, end, newText) {
  const textarea = document.getElementById('writing-text');
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + newText + after;
  localStorage.setItem(STORAGE_KEY, textarea.value);
}

export function initWritingArea() {
  const textarea = document.getElementById('writing-text');
  const selectionMenu = document.getElementById('selection-menu');
  const generateBtn = document.getElementById('generate-draft-btn');
  const evaluateBtn = document.getElementById('evaluate-btn');

  // Restore saved text
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    textarea.value = saved;
  }

  // Persist on change
  textarea.addEventListener('input', () => {
    localStorage.setItem(STORAGE_KEY, textarea.value);
  });

  // Selection tracking — show/hide selection menu
  textarea.addEventListener('mouseup', () => {
    setTimeout(() => showSelectionMenu(textarea, selectionMenu), 10);
  });

  // Hide selection menu on various events
  textarea.addEventListener('keydown', () => hideSelectionMenu(selectionMenu));
  textarea.addEventListener('blur', () => {
    // Delay to allow button clicks to fire
    setTimeout(() => {
      if (!selectionMenuVisible) return;
      hideSelectionMenu(selectionMenu);
    }, 200);
  });

  // Selection menu button handlers
  document.getElementById('sel-react').addEventListener('click', () => {
    if (currentSelectionData && onReactCallback) {
      onReactCallback(currentSelectionData);
    }
    hideSelectionMenu(selectionMenu);
  });

  document.getElementById('sel-variations').addEventListener('click', () => {
    if (currentSelectionData && onVariationsCallback) {
      onVariationsCallback(currentSelectionData);
    }
    hideSelectionMenu(selectionMenu);
  });

  document.getElementById('sel-evaluate').addEventListener('click', () => {
    if (currentSelectionData && onEvaluateSelectionCallback) {
      onEvaluateSelectionCallback(currentSelectionData);
    }
    hideSelectionMenu(selectionMenu);
  });

  // Generate Draft button
  generateBtn.addEventListener('click', handleGenerateDraft);

  // Evaluate button (full text)
  evaluateBtn.addEventListener('click', () => {
    if (onEvaluateFullCallback) {
      onEvaluateFullCallback();
    }
  });

  // Click outside to hide selection menu
  document.addEventListener('mousedown', (e) => {
    if (selectionMenu.contains(e.target)) return;
    if (e.target === textarea) return;
    hideSelectionMenu(selectionMenu);
  });
}

function getTextSelection() {
  const textarea = document.getElementById('writing-text');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === end) return null;
  return {
    text: textarea.value.substring(start, end),
    start,
    end,
    fullText: textarea.value
  };
}

function showSelectionMenu(textarea, menu) {
  const sel = getTextSelection();
  if (!sel) {
    hideSelectionMenu(menu);
    return;
  }

  currentSelectionData = sel;

  // Position near the selection
  const rect = textarea.getBoundingClientRect();
  // Approximate position: use selectionEnd to find roughly where to put the menu
  const textBeforeEnd = textarea.value.substring(0, sel.end);
  const lines = textBeforeEnd.split('\n');
  const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 28;
  const paddingTop = parseFloat(getComputedStyle(textarea).paddingTop) || 20;
  const paddingLeft = parseFloat(getComputedStyle(textarea).paddingLeft) || 20;

  // Rough vertical position
  const scrollTop = textarea.scrollTop;
  const yOffset = paddingTop + (lines.length * lineHeight) - scrollTop;
  const top = rect.top + Math.min(yOffset, rect.height - 40) + window.scrollY;
  const left = rect.left + paddingLeft + 50;

  menu.style.top = `${top}px`;
  menu.style.left = `${Math.min(left, rect.right - 200)}px`;
  menu.classList.add('visible');
  selectionMenuVisible = true;
}

function hideSelectionMenu(menu) {
  menu.classList.remove('visible');
  selectionMenuVisible = false;
}

async function handleGenerateDraft() {
  if (isGenerating) return;

  const settingInput = document.getElementById('setting-input').value.trim();
  const sceneInput = document.getElementById('scene-input').value.trim();

  if (!settingInput) {
    alert('Please describe what you\'re writing about in the Context panel.');
    return;
  }

  setGenerating(true);
  const btn = document.getElementById('generate-draft-btn');
  const surface = document.getElementById('writing-surface');
  const origText = btn.textContent;
  btn.textContent = 'Generating...';
  btn.disabled = true;
  surface.classList.add('loading');

  let guidance = '';
  if (sceneInput) {
    guidance = `Scene guidance:\n${sceneInput}`;
  }

  try {
    const prompt = buildGenerationPrompt(settingInput, guidance);
    const response = await callLLM(prompt, SYSTEM_PROMPT);

    // Parse response — strip JSON tags line if present
    const lines = response.trim().split('\n');
    let textStartIndex = 0;
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      try {
        const jsonMatch = lines[i].match(/^\s*\{[^}]+\}\s*$/);
        if (jsonMatch) {
          textStartIndex = i + 1;
          break;
        }
      } catch (e) { /* not json */ }
    }
    const text = lines.slice(textStartIndex).join('\n').trim() || response.trim();
    setWritingText(text);
  } catch (e) {
    alert(`Draft generation failed: ${e.message}`);
  }

  btn.textContent = origText;
  btn.disabled = false;
  surface.classList.remove('loading');
  setGenerating(false);
  renderStats();
}
