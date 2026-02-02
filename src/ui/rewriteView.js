// Rewrite view UI - single sentence exploration

import {
  rewriteState,
  variationDirections,
  initRewriteState,
  closeRewriteState,
  setRewriteCurrentSentence,
  addRewriteActiveDirection,
  removeRewriteActiveDirection,
  setRewriteVariationsForDirection,
  addToConsiderationSet,
  removeFromConsiderationSet,
  updateConsiderationItem,
  addCommentToConsiderationItem,
  startLoadingDirection,
  stopLoadingDirection,
  isDirectionLoading,
  getRewriteContext,
  alternatives,
  styleGuide
} from '../state.js';
import { escapeHtml } from '../utils.js';
import { callLLM } from '../llm.js';
import { SYSTEM_PROMPT } from '../prompts.js';

let onReplaceCallback = null;

export function setReplaceCallback(callback) {
  onReplaceCallback = callback;
}

// Open the rewrite view with selected text
export function openRewriteView(alternativeId, fullText, selectedText, startIndex, endIndex) {
  initRewriteState(alternativeId, fullText, selectedText, startIndex, endIndex);

  // Show the rewrite view
  document.getElementById('rewrite-view').classList.add('visible');
  document.querySelector('.container').classList.add('hidden');
  document.getElementById('settings-toggle').classList.add('hidden');

  // Render the initial state
  renderRewriteView();

  // Generate initial directions and variations
  generateInitialDirections();
}

export function closeRewriteView() {
  closeRewriteState();
  document.getElementById('rewrite-view').classList.remove('visible');
  document.querySelector('.container').classList.remove('hidden');
  document.getElementById('settings-toggle').classList.remove('hidden');
}

function renderRewriteView() {
  renderContext();
  renderDirections();
  renderVariations();
  renderConsiderationSet();
}

function renderContext() {
  const { contextBefore, contextAfter } = getRewriteContext();

  document.getElementById('context-before').textContent = contextBefore || '(beginning of text)';
  document.getElementById('context-after').textContent = contextAfter || '(end of text)';
  document.getElementById('current-sentence').value = rewriteState.currentSentence;
}

function renderDirections() {
  const activeContainer = document.getElementById('active-directions');
  const moreContainer = document.getElementById('more-directions');

  // Active directions
  const activeIds = rewriteState.activeDirections;
  activeContainer.innerHTML = activeIds.map(id => {
    const dir = variationDirections.find(d => d.id === id);
    if (!dir) return '';
    const isLoading = isDirectionLoading(id);
    return `
      <div class="direction-chip active${isLoading ? ' loading' : ''}" data-direction-id="${id}">
        <span class="direction-name">${escapeHtml(dir.name)}</span>
        ${isLoading ? '<span class="loading-spinner"></span>' : ''}
        <button class="remove-direction" data-direction-id="${id}">&times;</button>
      </div>
    `;
  }).join('');

  // More directions (those not active)
  const inactiveDirections = variationDirections.filter(d => !activeIds.includes(d.id));
  moreContainer.innerHTML = inactiveDirections.map(dir => `
    <div class="direction-chip inactive" data-direction-id="${dir.id}" title="${escapeHtml(dir.description)}">
      <span class="direction-name">${escapeHtml(dir.name)}</span>
    </div>
  `).join('');

  // Add event listeners
  activeContainer.querySelectorAll('.remove-direction').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dirId = e.target.dataset.directionId;
      removeRewriteActiveDirection(dirId);
      renderDirections();
      renderVariations();
    });
  });

  moreContainer.querySelectorAll('.direction-chip.inactive').forEach(chip => {
    chip.addEventListener('click', () => {
      const dirId = chip.dataset.directionId;
      addRewriteActiveDirection(dirId);
      renderDirections();
      generateVariationsForDirection(dirId);
    });
  });
}

function renderVariations() {
  const container = document.getElementById('variations-by-direction');
  const activeIds = rewriteState.activeDirections;

  if (activeIds.length === 0) {
    container.innerHTML = '<div class="variations-empty">Select directions above to generate variations</div>';
    return;
  }

  container.innerHTML = activeIds.map(dirId => {
    const dir = variationDirections.find(d => d.id === dirId);
    if (!dir) return '';

    const variations = rewriteState.variationsByDirection[dirId] || [];
    const isLoading = isDirectionLoading(dirId);

    return `
      <div class="direction-variations" data-direction-id="${dirId}">
        <div class="direction-header">
          <h4>${escapeHtml(dir.name)}</h4>
          <span class="variation-count">${variations.length} variations</span>
        </div>
        <div class="variations-grid">
          ${isLoading ? '<div class="variation-loading">Generating variations...</div>' : ''}
          ${variations.map(v => `
            <div class="variation-card" data-variation-id="${v.id}">
              ${v.label ? `<div class="variation-label">${escapeHtml(v.label)}</div>` : ''}
              <div class="variation-text">${escapeHtml(v.text)}</div>
              <button class="action-btn add-to-consideration" data-variation-id="${v.id}" data-direction-id="${dirId}">
                + Consider
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for "Consider" buttons
  container.querySelectorAll('.add-to-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      const variationId = btn.dataset.variationId;
      const directionId = btn.dataset.directionId;
      const variations = rewriteState.variationsByDirection[directionId] || [];
      const variation = variations.find(v => v.id === variationId);
      if (variation) {
        addToConsiderationSet({
          text: variation.text,
          label: variation.label,
          sourceDirection: directionId
        });
        renderConsiderationSet();
      }
    });
  });
}

function renderConsiderationSet() {
  const container = document.getElementById('consideration-list');
  const emptyMsg = document.getElementById('consideration-empty');
  const countEl = document.getElementById('consideration-count');

  const items = rewriteState.considerationSet;
  countEl.textContent = items.length > 0 ? `(${items.length})` : '';

  if (items.length === 0) {
    emptyMsg.style.display = 'block';
    container.innerHTML = '';
    return;
  }

  emptyMsg.style.display = 'none';
  container.innerHTML = items.map(item => {
    const dir = variationDirections.find(d => d.id === item.sourceDirection);
    const sourceLabel = dir ? dir.name : 'Custom';
    const labelDisplay = item.label ? ` - ${item.label}` : '';

    return `
      <div class="consideration-card" data-item-id="${item.id}">
        <div class="consideration-source">${escapeHtml(sourceLabel)}${escapeHtml(labelDisplay)}</div>
        <div class="consideration-text" data-item-id="${item.id}">${escapeHtml(item.text)}</div>
        <div class="consideration-actions">
          <button class="action-btn edit-consideration" data-item-id="${item.id}">Edit</button>
          <button class="action-btn branch-consideration" data-item-id="${item.id}">Branch</button>
          <button class="action-btn comment-consideration" data-item-id="${item.id}">Comment</button>
          <button class="action-btn remove-consideration" data-item-id="${item.id}">Remove</button>
          <button class="action-btn primary use-consideration" data-item-id="${item.id}">Use This</button>
        </div>
        ${item.comments.length > 0 ? `
          <div class="consideration-comments">
            ${item.comments.map(c => `<div class="comment-item">${escapeHtml(c)}</div>`).join('')}
          </div>
        ` : ''}
        <div class="consideration-edit-form" data-item-id="${item.id}" style="display: none;">
          <textarea class="edit-consideration-text">${escapeHtml(item.text)}</textarea>
          <div class="edit-actions">
            <button class="action-btn cancel-edit-consideration" data-item-id="${item.id}">Cancel</button>
            <button class="action-btn primary save-edit-consideration" data-item-id="${item.id}">Save</button>
          </div>
        </div>
        <div class="consideration-comment-form" data-item-id="${item.id}" style="display: none;">
          <textarea class="new-comment-text" placeholder="What do you like or want to change?"></textarea>
          <div class="comment-actions">
            <button class="action-btn cancel-comment" data-item-id="${item.id}">Cancel</button>
            <button class="action-btn primary save-comment" data-item-id="${item.id}">Add Comment</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners
  setupConsiderationEventListeners();
}

function setupConsiderationEventListeners() {
  const container = document.getElementById('consideration-list');

  // Remove
  container.querySelectorAll('.remove-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      removeFromConsiderationSet(btn.dataset.itemId);
      renderConsiderationSet();
    });
  });

  // Use This - sets as current sentence
  container.querySelectorAll('.use-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const item = rewriteState.considerationSet.find(c => c.id === itemId);
      if (item) {
        setRewriteCurrentSentence(item.text);
        document.getElementById('current-sentence').value = item.text;
      }
    });
  });

  // Branch - sets as current and regenerates
  container.querySelectorAll('.branch-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const item = rewriteState.considerationSet.find(c => c.id === itemId);
      if (item) {
        setRewriteCurrentSentence(item.text);
        document.getElementById('current-sentence').value = item.text;
        // Clear variations and regenerate
        rewriteState.variationsByDirection = {};
        generateVariationsForActiveDirections();
      }
    });
  });

  // Edit
  container.querySelectorAll('.edit-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const card = container.querySelector(`.consideration-card[data-item-id="${itemId}"]`);
      card.querySelector('.consideration-text').style.display = 'none';
      card.querySelector('.consideration-actions').style.display = 'none';
      card.querySelector('.consideration-edit-form').style.display = 'block';
    });
  });

  container.querySelectorAll('.cancel-edit-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const card = container.querySelector(`.consideration-card[data-item-id="${itemId}"]`);
      card.querySelector('.consideration-text').style.display = 'block';
      card.querySelector('.consideration-actions').style.display = 'flex';
      card.querySelector('.consideration-edit-form').style.display = 'none';
    });
  });

  container.querySelectorAll('.save-edit-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const card = container.querySelector(`.consideration-card[data-item-id="${itemId}"]`);
      const newText = card.querySelector('.edit-consideration-text').value.trim();
      if (newText) {
        updateConsiderationItem(itemId, { text: newText });
        renderConsiderationSet();
      }
    });
  });

  // Comment
  container.querySelectorAll('.comment-consideration').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const card = container.querySelector(`.consideration-card[data-item-id="${itemId}"]`);
      card.querySelector('.consideration-comment-form').style.display = 'block';
      card.querySelector('.new-comment-text').focus();
    });
  });

  container.querySelectorAll('.cancel-comment').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const card = container.querySelector(`.consideration-card[data-item-id="${itemId}"]`);
      card.querySelector('.consideration-comment-form').style.display = 'none';
      card.querySelector('.new-comment-text').value = '';
    });
  });

  container.querySelectorAll('.save-comment').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.itemId;
      const card = container.querySelector(`.consideration-card[data-item-id="${itemId}"]`);
      const comment = card.querySelector('.new-comment-text').value.trim();
      if (comment) {
        addCommentToConsiderationItem(itemId, comment);
        renderConsiderationSet();
      }
    });
  });
}

// Generate initial directions using LLM
async function generateInitialDirections() {
  // Build prompt to suggest 4 relevant directions
  const { contextBefore, contextAfter } = getRewriteContext();
  const styleRules = styleGuide.map(r => r.principle).join('\n');

  const prompt = `Given this sentence and its context, suggest 4 variation directions that would be most interesting to explore.

Context before: "${contextBefore}"

THE SENTENCE: "${rewriteState.currentSentence}"

Context after: "${contextAfter}"

${styleRules ? `Style guide rules:\n${styleRules}\n` : ''}

Available directions:
${variationDirections.map(d => `- ${d.id}: ${d.name} (${d.description})`).join('\n')}

Return ONLY 4 direction IDs, one per line, that would offer the most interesting variations for this sentence. Consider the sentence's current style and what alternatives might improve it or offer useful contrast.`;

  try {
    const response = await callLLM(prompt, SYSTEM_PROMPT);
    const directionIds = response.split('\n')
      .map(line => line.trim().toLowerCase().replace(/[^a-z-]/g, ''))
      .filter(id => variationDirections.some(d => d.id === id))
      .slice(0, 4);

    // Use suggested directions or fall back to defaults
    const finalDirections = directionIds.length >= 2 ? directionIds :
      ['complexity', 'concrete', 'emotion', 'pacing'];

    finalDirections.forEach(id => addRewriteActiveDirection(id));
    renderDirections();

    // Generate variations for each direction
    await generateVariationsForActiveDirections();
  } catch (e) {
    console.error('Failed to generate initial directions:', e);
    // Fall back to default directions
    ['complexity', 'concrete', 'emotion', 'pacing'].forEach(id =>
      addRewriteActiveDirection(id)
    );
    renderDirections();
    await generateVariationsForActiveDirections();
  }
}

async function generateVariationsForActiveDirections() {
  const promises = rewriteState.activeDirections.map(dirId =>
    generateVariationsForDirection(dirId)
  );
  await Promise.all(promises);
}

async function generateVariationsForDirection(directionId) {
  const dir = variationDirections.find(d => d.id === directionId);
  if (!dir) return;

  startLoadingDirection(directionId);
  renderDirections();
  renderVariations();

  const { contextBefore, contextAfter } = getRewriteContext();
  const styleRules = styleGuide.map(r => r.principle).join('\n');

  // Get comments from consideration set that might inform generation
  const relevantComments = rewriteState.considerationSet
    .flatMap(item => item.comments)
    .filter(c => c)
    .join('\n');

  // Build prompt based on direction type
  const prompt = buildVariationPrompt(dir, contextBefore, contextAfter, styleRules, relevantComments);

  try {
    const response = await callLLM(prompt, SYSTEM_PROMPT);
    const variations = parseVariations(response, dir);
    setRewriteVariationsForDirection(directionId, variations);
  } catch (e) {
    console.error(`Failed to generate variations for ${directionId}:`, e);
    setRewriteVariationsForDirection(directionId, []);
  }

  stopLoadingDirection(directionId);
  renderDirections();
  renderVariations();
}

function buildVariationPrompt(dir, contextBefore, contextAfter, styleRules, relevantComments) {
  const baseContext = `Context before: "${contextBefore}"

ORIGINAL SENTENCE: "${rewriteState.currentSentence}"

Context after: "${contextAfter}"

${styleRules ? `Style guide rules to follow:\n${styleRules}\n` : ''}
${relevantComments ? `User feedback to incorporate:\n${relevantComments}\n` : ''}`;

  if (dir.type === 'spectrum') {
    // Generate variations across the spectrum
    const labels = dir.labels;
    return `Rewrite this sentence at different points along the "${dir.name}" spectrum (${dir.description}).

${baseContext}

Generate 5 rewrites, one for each point on the spectrum. Label each with EXACTLY one of these labels, in this order:
${labels.map((l, i) => `${i + 1}. [${l}]`).join('\n')}

Format each line as: [Label] The rewritten sentence here.
Output exactly 5 variations, one per line.`;

  } else if (dir.type === 'binary') {
    // Generate variations for both poles
    const [pole1, pole2] = dir.poles;
    return `Rewrite this sentence exploring both "${pole1}" and "${pole2}" approaches.

${baseContext}

Generate 4 rewrites total:
1. [${pole1}] - A clear example using ${pole1.toLowerCase()}
2. [${pole1}] - Another variation using ${pole1.toLowerCase()}
3. [${pole2}] - A clear example using ${pole2.toLowerCase()}
4. [${pole2}] - Another variation using ${pole2.toLowerCase()}

Format each line as: [Label] The rewritten sentence here.
Output exactly 4 variations, one per line.`;

  } else {
    // 'enhance' type - show degrees of the quality
    const labels = dir.labels;
    return `Rewrite this sentence with varying degrees of ${dir.name.toLowerCase()} (${dir.description}).

${baseContext}

Generate 5 rewrites showing different intensities of this quality. Label each with EXACTLY one of these labels, in order from least to most:
${labels.map((l, i) => `${i + 1}. [${l}]`).join('\n')}

Format each line as: [Label] The rewritten sentence here.
Output exactly 5 variations, one per line.`;
  }
}

function parseVariations(response, dir) {
  const lines = response.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const variations = [];
  const labelPattern = /^\[([^\]]+)\]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(labelPattern);
    if (match) {
      const label = match[1].trim();
      let text = match[2].trim();
      // Remove quotes if present
      text = text.replace(/^["']|["']$/g, '').trim();
      if (text.length > 10) {
        variations.push({
          id: `var-${dir.id}-${Date.now()}-${variations.length}`,
          text,
          label,
          directionId: dir.id
        });
      }
    } else {
      // Fallback: try to parse as numbered list
      const numberedMatch = line.match(/^\d+[\.\)\:\-]\s*(.+)$/);
      if (numberedMatch) {
        let text = numberedMatch[1].trim();
        text = text.replace(/^["']|["']$/g, '').trim();
        if (text.length > 10) {
          // Assign label based on position
          const labels = dir.labels || dir.poles || [];
          const labelIndex = Math.min(variations.length, labels.length - 1);
          variations.push({
            id: `var-${dir.id}-${Date.now()}-${variations.length}`,
            text,
            label: labels[labelIndex] || null,
            directionId: dir.id
          });
        }
      }
    }
  }

  return variations.slice(0, 6);
}

function replaceOriginal() {
  const newText = rewriteState.currentSentence;
  const { alternativeId, fullText, startIndex, endIndex } = rewriteState;

  // Build the new full text
  const newFullText = fullText.substring(0, startIndex) + newText + fullText.substring(endIndex);

  // Update the alternative
  const alt = alternatives.find(a => a.id === alternativeId);
  if (alt) {
    alt.text = newFullText;
  }

  // Close the view and notify
  closeRewriteView();
  if (onReplaceCallback) {
    onReplaceCallback();
  }
}

export function initRewriteView() {
  // Back button
  document.getElementById('rewrite-back').addEventListener('click', closeRewriteView);

  // Replace button
  document.getElementById('rewrite-replace').addEventListener('click', replaceOriginal);

  // Current sentence changes
  document.getElementById('current-sentence').addEventListener('input', (e) => {
    setRewriteCurrentSentence(e.target.value);
  });

  // Toggle more directions
  document.getElementById('toggle-more-directions').addEventListener('click', () => {
    const moreContainer = document.getElementById('more-directions');
    const btn = document.getElementById('toggle-more-directions');
    const isExpanded = moreContainer.classList.toggle('expanded');
    btn.textContent = isExpanded ? 'Hide more directions' : 'Show more directions';
  });

  // Generate more variations
  document.getElementById('generate-more-variations').addEventListener('click', async () => {
    // Regenerate for all active directions
    await generateVariationsForActiveDirections();
  });
}
