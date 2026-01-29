// Main entry point - initialization and event wiring

import {
  alternatives, addAlternative, reactions, selectedStyles,
  isGenerating, setGenerating
} from './state.js';
import { callLLM } from './llm.js';
import { SYSTEM_PROMPT, buildGenerationPrompt, parseGeneratedResponse } from './prompts.js';
import { setupAutoResize, autoResizeTextarea, truncate } from './utils.js';

// UI modules
import { initSettings } from './ui/settings.js';
import {
  renderAlternatives, renderAllReactions,
  setReactionsChangedCallback, initPopupEventListeners
} from './ui/alternatives.js';
import { initStyleGuide } from './ui/styleGuide.js';
import { initDrillDownEventListeners } from './ui/drillDown.js';
import { renderStylePalette, setGenerateWithStylesCallback, initStylePaletteEventListeners } from './ui/stylePalette.js';

// Input helpers
function getSettingInput() {
  return document.getElementById('setting-input').value;
}

function getStyleInput() {
  return document.getElementById('style-input').value;
}

function getSceneInput() {
  return document.getElementById('scene-input').value;
}

function getGuidanceInput() {
  const style = getStyleInput().trim();
  const scene = getSceneInput().trim();

  let guidance = '';
  if (style) {
    guidance += `General style rules:\n${style}`;
  }
  if (scene) {
    if (guidance) guidance += '\n\n';
    guidance += `For this scene:\n${scene}`;
  }
  return guidance;
}

// Generation functions
async function generateAlternatives(count = 2, additionalInstructions = '') {
  if (isGenerating) return;
  setGenerating(true);

  const settingInfo = getSettingInput();
  const guidance = getGuidanceInput();

  if (!settingInfo.trim()) {
    alert('Please describe what you want to write about in the "What I\'m Describing" pane.');
    setGenerating(false);
    return;
  }

  // Show loading state
  const container = document.getElementById('alternatives');

  // Add loading placeholders
  for (let i = 0; i < count; i++) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'alternative loading';
    loadingDiv.innerHTML = '<span class="loading-indicator"></span> Generating...';
    container.appendChild(loadingDiv);
  }

  try {
    const prompt = buildGenerationPrompt(settingInfo, guidance, additionalInstructions);

    // Generate multiple alternatives
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(callLLM(prompt, SYSTEM_PROMPT));
    }

    const results = await Promise.all(promises);

    // Remove loading placeholders
    container.querySelectorAll('.alternative.loading').forEach(el => el.remove());

    // Add new alternatives
    results.forEach((response, i) => {
      const parsed = parseGeneratedResponse(response);
      const newAlt = {
        id: `alt-${Date.now()}-${i}`,
        tags: parsed.tags,
        text: parsed.text
      };
      addAlternative(newAlt);
    });

    renderAlternatives();
  } catch (e) {
    // Remove loading placeholders
    container.querySelectorAll('.alternative.loading').forEach(el => el.remove());
    alert(`Generation failed: ${e.message}\n\nMake sure LM Studio is running with a model loaded.`);
  }

  setGenerating(false);
}

async function generateWithStyles() {
  const stylesArray = Array.from(selectedStyles);
  if (stylesArray.length === 0) return;

  const instructions = `Apply these specific style properties:
${stylesArray.map(s => `- ${s}`).join('\n')}

Make sure the description clearly embodies these stylistic choices.`;

  await generateAlternatives(1, instructions);
}

async function generateWithReactions() {
  if (reactions.length === 0) return;

  const reactionText = reactions.map(r => {
    if (r.quote) {
      return `Regarding "${r.quote}": ${r.text}`;
    }
    return r.text;
  }).join('\n');

  const instructions = `The writer has provided this feedback on previous attempts:
${reactionText}

Use this feedback to create an improved version that addresses their concerns and preferences.`;

  await generateAlternatives(1, instructions);
}

// Panel button state
function updatePanelButtons() {
  const applyBtn = document.getElementById('apply-to-guidance');
  const generateBtn = document.getElementById('generate-with-reactions');
  const hasReactions = reactions.length > 0;

  applyBtn.disabled = !hasReactions;
  generateBtn.disabled = !hasReactions;
}

// Initialize application
function init() {
  // Initialize UI components
  initSettings();
  initStyleGuide();

  // Render initial state
  renderAlternatives();
  renderAllReactions();
  renderStylePalette();
  setupAutoResize();

  // Set up callbacks
  setReactionsChangedCallback(updatePanelButtons);
  setGenerateWithStylesCallback(generateWithStyles);

  // Initialize event listeners
  initPopupEventListeners();
  initDrillDownEventListeners();
  initStylePaletteEventListeners();

  // Generation button listeners
  document.querySelector('.regenerate-btn').addEventListener('click', () => {
    generateAlternatives(2);
  });

  document.getElementById('generate-with-reactions').addEventListener('click', generateWithReactions);

  // Apply to Guidance button - adds reactions to scene guidance
  document.getElementById('apply-to-guidance').addEventListener('click', () => {
    const sceneEl = document.getElementById('scene-input');
    const reactionText = reactions.map(r => {
      if (r.quote) {
        return `- Re "${truncate(r.quote, 40)}": ${r.text}`;
      }
      return `- ${r.text}`;
    }).join('\n');

    sceneEl.value += '\n\nFeedback from reviewing alternatives:\n' + reactionText;
    autoResizeTextarea(sceneEl);
    alert('Reactions added to scene guidance!');
  });
}

// Start the app
init();
