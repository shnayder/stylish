// Main entry point — initialization and event wiring for text-centered UI

import { loadCategoryRegistry } from './state.js';
import { setupAutoResize } from './utils.js';

// UI modules — new surface-based layout
import { initSettings } from './ui/settings.js';
import { initStyleGuide, renderStyleGuide } from './ui/styleGuide.js';
import {
  initWritingArea, setOnReact, setOnVariations,
  setOnEvaluateSelection, setOnEvaluateFull, getWritingText
} from './ui/writingArea.js';
import { initMirror, openMirrorThread } from './ui/mirror.js';
import { initLens, runEvaluation, runEvaluationOnSelection, setOnChallenge } from './ui/lens.js';
import { initVariations, showVariations } from './ui/variations.js';
import { initStyleGuidePanel, renderStyleGuidePanel } from './ui/styleGuidePanel.js';
import { initStats, renderStats } from './ui/stats.js';
import { initRefinement } from './ui/refinement.js';
import { initDrillDownEventListeners } from './ui/drillDown.js';

// Initialize application
async function init() {
  // Initialize core infrastructure
  initSettings();
  await initStyleGuide();
  await loadCategoryRegistry();

  // Initialize UI modules
  initWritingArea();
  initMirror();
  initLens();
  initVariations();
  initStyleGuidePanel();
  initStats();
  initRefinement();
  initDrillDownEventListeners();

  // Wire up the three flows via callbacks

  // 1. React (Mirror flow): selection → coaching conversation
  setOnReact((selectionData) => {
    openMirrorThread(selectionData);
  });

  // 2. Variations (Pen flow): selection → inline alternatives
  setOnVariations((selectionData) => {
    showVariations(selectionData);
  });

  // 3. Evaluate (Lens flow): selection → evaluation, or full text → evaluation
  setOnEvaluateSelection((selectionData) => {
    runEvaluationOnSelection(selectionData);
  });

  setOnEvaluateFull(() => {
    const text = getWritingText();
    runEvaluation(text);
  });

  // 4. Challenge from Lens → opens Mirror thread about the rule
  setOnChallenge((evaluation) => {
    // Create a selection-like object for the challenge
    const text = getWritingText();
    const ruleId = evaluation.ruleId;
    const note = evaluation.note || '';
    openMirrorThread({
      text: `[Challenging rule: ${ruleId}] ${note}`,
      start: 0,
      end: 0,
      fullText: text
    });
  });

  // Collapsible context panel
  document.getElementById('context-toggle').addEventListener('click', () => {
    document.getElementById('context-panel').classList.toggle('collapsed');
  });

  // Auto-resize context textareas
  setupAutoResize();

  // Render initial state
  renderStats();
}

// Start the app
init();
