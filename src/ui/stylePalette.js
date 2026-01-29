// Style properties palette UI

import {
  styleProperties, selectedStyles,
  toggleSelectedStyle, clearSelectedStyles
} from '../state.js';

let onGenerateWithStyles = null;

export function setGenerateWithStylesCallback(callback) {
  onGenerateWithStyles = callback;
}

export function renderStylePalette() {
  const container = document.getElementById('style-categories');
  container.innerHTML = Object.entries(styleProperties).map(([category, options]) => `
    <div class="style-category">
      <h3>${category}</h3>
      <div class="style-options">
        ${options.map(opt => `
          <span class="style-option${selectedStyles.has(opt) ? ' selected' : ''}" data-style="${opt}">
            ${opt}
          </span>
        `).join('')}
      </div>
    </div>
  `).join('');

  // Add click listeners
  container.querySelectorAll('.style-option').forEach(el => {
    el.addEventListener('click', () => {
      toggleSelectedStyle(el.dataset.style);
      renderStylePalette();
    });
  });

  updateStyleSelectionCount();
}

function updateStyleSelectionCount() {
  const countEl = document.getElementById('style-selection-count');
  const generateBtn = document.getElementById('generate-from-styles');
  const clearBtn = document.getElementById('clear-styles');
  const count = selectedStyles.size;

  if (count === 0) {
    countEl.textContent = '';
    generateBtn.disabled = true;
    clearBtn.disabled = true;
  } else {
    countEl.textContent = `${count} selected`;
    generateBtn.disabled = false;
    clearBtn.disabled = false;
  }
}

function clearStyles() {
  clearSelectedStyles();
  renderStylePalette();
}

export function initStylePaletteEventListeners() {
  document.getElementById('generate-from-styles').addEventListener('click', () => {
    if (onGenerateWithStyles) {
      onGenerateWithStyles();
    }
  });

  document.getElementById('clear-styles').addEventListener('click', clearStyles);
}
