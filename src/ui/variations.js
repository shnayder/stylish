// Inline variations — generate alternative phrasings for selected text

import { callLLM } from '../llm.js';
import { SYSTEM_PROMPT, getStyleGuideText } from '../prompts.js';
import { escapeHtml } from '../utils.js';
import { replaceSelection } from './writingArea.js';
import { renderStats } from './stats.js';

let activeVariation = null;

export function initVariations() {
  // No static DOM setup needed
}

export async function showVariations(selectionData) {
  const area = document.getElementById('annotations-area');

  // Remove any existing variations card
  const existing = area.querySelector('.inline-variations');
  if (existing) existing.remove();

  activeVariation = {
    quote: selectionData.text,
    start: selectionData.start,
    end: selectionData.end,
    fullText: selectionData.fullText,
    variations: []
  };

  // Show loading card
  const card = document.createElement('div');
  card.className = 'annotation-card inline-variations';
  card.id = 'variations-card';
  card.innerHTML = `
    <div class="annotation-card-header" id="variations-header">
      <span class="annotation-type variations">Variations</span>
      <span class="quote-text">"${escapeHtml(truncate(selectionData.text, 80))}"</span>
      <button class="close-annotation" id="close-variations">&times;</button>
    </div>
    <div class="annotation-card-body">
      <div class="annotation-loading">
        <span class="loading-indicator"></span> Generating variations...
      </div>
    </div>
  `;
  // Insert at beginning of annotations area
  area.insertBefore(card, area.firstChild);

  card.querySelector('#close-variations').addEventListener('click', (e) => {
    e.stopPropagation();
    card.remove();
    activeVariation = null;
  });

  card.querySelector('#variations-header').addEventListener('click', (e) => {
    if (e.target.closest('.close-annotation')) return;
    card.classList.toggle('collapsed');
  });

  // Generate variations
  try {
    const variations = await generateVariations(selectionData);
    activeVariation.variations = variations;
    renderVariationsBody(card, variations, selectionData);
  } catch (e) {
    console.error('[Variations] Generation failed:', e);
    card.querySelector('.annotation-card-body').innerHTML = `
      <div class="lens-summary" style="color: #a55;">Failed to generate variations: ${escapeHtml(e.message)}</div>
    `;
  }

  renderStats();
}

async function generateVariations(selectionData) {
  // Get context around the selection
  const before = selectionData.fullText.substring(
    Math.max(0, selectionData.start - 200),
    selectionData.start
  );
  const after = selectionData.fullText.substring(
    selectionData.end,
    Math.min(selectionData.fullText.length, selectionData.end + 200)
  );

  const styleGuideText = getStyleGuideText();

  const prompt = `You are rewriting a passage from a piece of creative writing. Here is the context:

...${before}[SELECTED TEXT]${after}...

The selected text is:
"${selectionData.text}"

${styleGuideText}

Generate exactly 5 alternative versions of ONLY the selected text. Each should take a different stylistic approach while fitting the surrounding context. Vary the tone, imagery, sentence structure, or word choice.

Output ONLY the 5 alternatives, one per line, numbered 1-5. No explanations or commentary.`;

  const response = await callLLM(prompt, SYSTEM_PROMPT);

  // Parse numbered list
  const lines = response.trim().split('\n')
    .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(line => line.length > 0);

  return lines.slice(0, 5);
}

function renderVariationsBody(card, variations, selectionData) {
  const body = card.querySelector('.annotation-card-body');

  if (variations.length === 0) {
    body.innerHTML = `<div class="lens-summary">No variations generated.</div>`;
    return;
  }

  const listHtml = variations.map((v, i) => `
    <div class="variation-option" data-index="${i}">
      <span class="variation-text">${escapeHtml(v)}</span>
      <button class="action-btn primary" data-action="use" data-index="${i}">Use</button>
    </div>
  `).join('');

  body.innerHTML = `
    <div class="variations-list">
      ${listHtml}
    </div>
    <div class="variations-actions">
      <button class="action-btn" id="regenerate-variations">Generate More</button>
    </div>
  `;

  // Use button handlers
  body.querySelectorAll('[data-action="use"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      const newText = variations[idx];
      replaceSelection(selectionData.start, selectionData.end, newText);
      card.remove();
      activeVariation = null;
    });
  });

  // Regenerate
  const regenBtn = body.querySelector('#regenerate-variations');
  if (regenBtn) {
    regenBtn.addEventListener('click', async () => {
      body.innerHTML = `
        <div class="annotation-loading">
          <span class="loading-indicator"></span> Generating more variations...
        </div>
      `;
      try {
        const newVariations = await generateVariations(selectionData);
        activeVariation.variations = newVariations;
        renderVariationsBody(card, newVariations, selectionData);
        renderStats();
      } catch (e) {
        body.innerHTML = `<div class="lens-summary" style="color: #a55;">Failed: ${escapeHtml(e.message)}</div>`;
      }
    });
  }
}

function truncate(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}
