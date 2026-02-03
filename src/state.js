// Application state management

// Settings & LLM Configuration
export const DEFAULT_SETTINGS = {
  provider: 'local',
  localUrl: 'http://localhost:1234',
  anthropicKey: ''
};

export let settings = { ...DEFAULT_SETTINGS };

export function loadSettings() {
  const saved = localStorage.getItem('writingStyleSettings');
  if (saved) {
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
  }
  return settings;
}

export function saveSettingsToStorage(newSettings) {
  settings = { ...settings, ...newSettings };
  localStorage.setItem('writingStyleSettings', JSON.stringify(settings));
}

// Generation state
export let isGenerating = false;

export function setGenerating(value) {
  isGenerating = value;
}

// LLM Stats tracking
export let llmStats = {
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  callHistory: [] // Recent calls for detailed view
};

export function recordLLMCall(inputTokens, outputTokens, model = 'unknown') {
  llmStats.totalCalls++;
  llmStats.totalInputTokens += inputTokens;
  llmStats.totalOutputTokens += outputTokens;
  llmStats.callHistory.push({
    timestamp: new Date().toISOString(),
    inputTokens,
    outputTokens,
    model
  });
  // Keep only last 50 calls in history
  if (llmStats.callHistory.length > 50) {
    llmStats.callHistory.shift();
  }
}

export function resetLLMStats() {
  llmStats = {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    callHistory: []
  };
}

// Pricing estimates (per 1M tokens, as of 2024)
export const LLM_PRICING = {
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'local': { input: 0, output: 0 }
};

export function estimateCost(model = 'claude-3-haiku-20240307') {
  const pricing = LLM_PRICING[model] || LLM_PRICING['claude-3-haiku-20240307'];
  const inputCost = (llmStats.totalInputTokens / 1000000) * pricing.input;
  const outputCost = (llmStats.totalOutputTokens / 1000000) * pricing.output;
  return {
    input: inputCost,
    output: outputCost,
    total: inputCost + outputCost
  };
}

// Style Guide - persisted per project
export let styleGuide = [];
export let styleGuideExpanded = false;

export function loadStyleGuide() {
  const saved = localStorage.getItem('writingStyleGuide');
  if (saved) {
    styleGuide = JSON.parse(saved);
  }
  return styleGuide;
}

export function saveStyleGuideToStorage() {
  localStorage.setItem('writingStyleGuide', JSON.stringify(styleGuide));
}

export function addStyleRule(rule) {
  styleGuide.push({
    id: `rule-${Date.now()}`,
    ...rule
  });
  saveStyleGuideToStorage();
}

export function removeStyleRule(ruleId) {
  styleGuide = styleGuide.filter(r => r.id !== ruleId);
  saveStyleGuideToStorage();
}

export function updateStyleRule(ruleId, updates) {
  const rule = styleGuide.find(r => r.id === ruleId);
  if (rule) {
    Object.assign(rule, updates);
    saveStyleGuideToStorage();
  }
}

export function toggleStyleGuideExpanded() {
  styleGuideExpanded = !styleGuideExpanded;
  return styleGuideExpanded;
}

// Alternatives data
export const alternatives = [
  {
    id: 'alt-1',
    tags: [
      { text: "immersive", type: "tone" },
      { text: "sensory layering", type: "technique" },
      { text: "measured", type: "pacing" }
    ],
    text: `The sound reached them before the sight—water falling, not crashing but singing, a chord sustained across centuries. The path curved and suddenly the valley opened below, terraced with gardens that climbed toward buildings of pale stone, their windows catching the last copper light of sunset.

Bilbo found he had stopped walking. The air here tasted different. Cleaner, yes, but also older, as if each breath carried the memory of a thousand springs. Somewhere below, someone was playing a harp, the notes drifting up like wood smoke.

"The Last Homely House," Gandalf said, and for once his voice held no irony. Even wizards, it seemed, could feel relief.`
  },
  {
    id: 'alt-2',
    tags: [
      { text: "spare", type: "tone" },
      { text: "character-anchored", type: "technique" },
      { text: "quick", type: "pacing" }
    ],
    text: `They came down into the valley at dusk. Waterfalls on three sides. Stone buildings older than any Bilbo had seen, though they wore their age lightly. Elves moved among the lamplit paths, unhurried, paying the travelers no particular attention.

Bilbo's feet had stopped hurting somewhere on the descent. He noticed this only now. The whole place seemed to insist, gently, that urgency was a choice—and not a particularly wise one.`
  },
  {
    id: 'alt-3',
    tags: [
      { text: "lyrical", type: "tone" },
      { text: "extended metaphor", type: "technique" },
      { text: "contemplative", type: "pacing" }
    ],
    text: `Rivendell lay in its valley like a held breath. The mountains cupped it in grey palms, and waterfalls threaded down their fingers, catching light that seemed borrowed from some gentler age. Here, the world had decided to pause—and having paused, had forgotten to resume.

The buildings rose from the living rock as if they had grown rather than been built, their windows glowing amber against the deepening blue of evening. Music drifted from somewhere, or perhaps from everywhere, a sound so woven into the air that silence here would have felt like a missing limb.

Bilbo stood at the valley's edge and felt something loosen in his chest. Not safety, exactly. Something older than safety. The sense of a place that had been waiting, that would go on waiting, long after the current troubles had become old songs sung by the fire.`
  },
  {
    id: 'alt-4',
    tags: [
      { text: "grounded", type: "tone" },
      { text: "contrast", type: "technique" },
      { text: "steady", type: "pacing" }
    ],
    text: `After the goblin tunnels, after Gollum's cave, after the long stumbling descent through pine forests that all looked alike—this. Rivendell opened before them like an answered prayer, though Bilbo had never been one for praying.

Terraced gardens. Waterfalls that caught the evening light. Stone buildings with windows of colored glass, and everywhere the sound of water and distant voices raised in song. The air smelled of pine and something sweeter, honeysuckle perhaps, though it was too late in the year for honeysuckle.

His companions were already heading down the path, but Bilbo lingered. He had the strangest feeling that once he entered this valley, he would not leave it quite the same hobbit who had arrived.`
  }
];

export function addAlternative(alt) {
  alternatives.push(alt);
}

export function removeAlternative(altId) {
  const index = alternatives.findIndex(a => a.id === altId);
  if (index !== -1) {
    alternatives.splice(index, 1);
    return true;
  }
  return false;
}

// Reactions
export let reactions = [];
let reactionIdCounter = 0;

export function addReaction(reaction) {
  reactions.push({
    id: ++reactionIdCounter,
    ...reaction
  });
}

export function removeReaction(id) {
  reactions = reactions.filter(r => r.id !== id);
}

export function removeReactionsForAlternative(altId) {
  reactions = reactions.filter(r => r.alternativeId !== altId);
}

export function getReactionsForAlternative(altId) {
  return reactions.filter(r => r.alternativeId === altId);
}

// Current selection state
export let currentSelection = {
  text: '',
  alternativeId: null
};

export function setCurrentSelection(text, alternativeId) {
  currentSelection = { text, alternativeId };
}

export function clearCurrentSelection() {
  currentSelection = { text: '', alternativeId: null };
}

// Selected styles for style palette
export let selectedStyles = new Set();

export function toggleSelectedStyle(style) {
  if (selectedStyles.has(style)) {
    selectedStyles.delete(style);
  } else {
    selectedStyles.add(style);
  }
}

export function clearSelectedStyles() {
  selectedStyles.clear();
}

// Style properties organized by category
export const styleProperties = {
  "Tone": [
    "immersive", "spare", "lyrical", "grounded", "intimate", "distant",
    "warm", "cool", "reverent", "irreverent", "earnest", "wry",
    "somber", "playful", "nostalgic", "urgent"
  ],
  "Pacing": [
    "measured", "quick", "contemplative", "steady", "staccato", "flowing",
    "languid", "brisk", "unhurried", "breathless"
  ],
  "Technique": [
    "sensory layering", "character-anchored", "extended metaphor", "contrast",
    "accumulation", "fragmentation", "parallel structure", "delayed reveal",
    "in medias res", "close observation", "impressionistic", "cinematic"
  ],
  "Sensory Focus": [
    "visual", "auditory", "tactile", "olfactory", "kinesthetic",
    "synesthetic", "temperature", "texture"
  ],
  "Perspective": [
    "close third", "distant third", "first person", "omniscient",
    "present tense", "past tense", "direct", "filtered"
  ],
  "Mood": [
    "mysterious", "peaceful", "tense", "melancholy", "hopeful",
    "ominous", "serene", "unsettling", "wonder", "bittersweet"
  ],
  "Structure": [
    "fragments", "long sentences", "varied rhythm", "repetition",
    "list-like", "nested clauses", "simple declarative", "question-driven"
  ]
};

// Drill-down modal state
export let drillDownState = {
  selectedText: '',
  initialReaction: '',
  alternativeId: null,
  conversation: [],
  proposedRule: null
};

export function resetDrillDownState() {
  drillDownState = {
    selectedText: '',
    initialReaction: '',
    alternativeId: null,
    conversation: [],
    proposedRule: null
  };
}

export function initDrillDownState(selectedText, initialReaction, alternativeId) {
  drillDownState = {
    selectedText,
    initialReaction,
    alternativeId,
    conversation: [],
    proposedRule: null
  };
}

export function addDrillDownMessage(role, content) {
  drillDownState.conversation.push({ role, content });
}

export function setProposedRule(rule) {
  drillDownState.proposedRule = rule;
}

// Rewrite view state
export let rewriteState = {
  isOpen: false,
  alternativeId: null,
  fullText: '',
  selectedText: '',
  startIndex: -1,
  endIndex: -1,
  currentSentence: '',
  activeDirections: [],
  allDirections: [],
  variationsByDirection: {}, // { directionId: [{ id, text, directionId, label }] }
  considerationSet: [], // [{ id, text, comments: [], sourceDirection, label }]
  loadingDirections: new Set() // Track which directions are currently loading
};

// Pre-defined variation directions with spectrum types
// type: 'spectrum' = shows range from low to high
// type: 'binary' = shows both poles
// type: 'enhance' = shows degrees of the quality
export const variationDirections = [
  {
    id: 'complexity',
    name: 'Complexity',
    description: 'Sentence structure complexity',
    type: 'spectrum',
    labels: ['Very Simple', 'Simple', 'Moderate', 'Complex', 'Very Complex']
  },
  {
    id: 'concrete',
    name: 'Concrete',
    description: 'Specificity and tangibility of imagery',
    type: 'spectrum',
    labels: ['Very Abstract', 'Abstract', 'Balanced', 'Concrete', 'Very Concrete']
  },
  {
    id: 'length',
    name: 'Length',
    description: 'Sentence length and detail',
    type: 'spectrum',
    labels: ['Very Short', 'Shorter', 'Similar', 'Longer', 'Much Longer']
  },
  {
    id: 'voice',
    name: 'Voice',
    description: 'Active vs passive voice',
    type: 'binary',
    poles: ['Active Voice', 'Passive Voice']
  },
  {
    id: 'figurative',
    name: 'Figurative',
    description: 'Metaphor and figurative language',
    type: 'spectrum',
    labels: ['Very Literal', 'Literal', 'Light Metaphor', 'Metaphorical', 'Highly Figurative']
  },
  {
    id: 'emotion',
    name: 'Emotion',
    description: 'Emotional intensity',
    type: 'spectrum',
    labels: ['Detached', 'Understated', 'Moderate', 'Emotional', 'Intense']
  },
  {
    id: 'tension',
    name: 'Tension',
    description: 'Tension and suspense level',
    type: 'spectrum',
    labels: ['Very Calm', 'Calm', 'Neutral', 'Tense', 'High Suspense']
  },
  {
    id: 'pacing',
    name: 'Pacing',
    description: 'Speed and rhythm',
    type: 'spectrum',
    labels: ['Very Slow', 'Contemplative', 'Measured', 'Brisk', 'Urgent']
  },
  {
    id: 'sensory-visual',
    name: 'Visual',
    description: 'Emphasize what is seen',
    type: 'enhance',
    labels: ['Subtle', 'Light', 'Moderate', 'Strong', 'Vivid']
  },
  {
    id: 'sensory-auditory',
    name: 'Sound',
    description: 'Emphasize what is heard',
    type: 'enhance',
    labels: ['Subtle', 'Light', 'Moderate', 'Strong', 'Vivid']
  },
  {
    id: 'sensory-tactile',
    name: 'Touch',
    description: 'Emphasize physical sensation',
    type: 'enhance',
    labels: ['Subtle', 'Light', 'Moderate', 'Strong', 'Vivid']
  },
  {
    id: 'sensory-smell',
    name: 'Smell',
    description: 'Emphasize scents and aromas',
    type: 'enhance',
    labels: ['Subtle', 'Light', 'Moderate', 'Strong', 'Vivid']
  },
  {
    id: 'rhythm',
    name: 'Rhythm',
    description: 'Focus on flow and cadence',
    type: 'enhance',
    labels: ['Plain', 'Light', 'Rhythmic', 'Musical', 'Highly Melodic']
  },
  {
    id: 'prose-style',
    name: 'Prose Style',
    description: 'Spare vs ornate prose',
    type: 'spectrum',
    labels: ['Very Spare', 'Spare', 'Balanced', 'Rich', 'Ornate']
  },
  {
    id: 'dialogue',
    name: 'Dialogue',
    description: 'Narrative vs dialogue',
    type: 'binary',
    poles: ['Pure Narrative', 'With Dialogue']
  }
];

export function initRewriteState(alternativeId, fullText, selectedText, startIndex, endIndex) {
  rewriteState = {
    isOpen: true,
    alternativeId,
    fullText,
    selectedText,
    startIndex,
    endIndex,
    currentSentence: selectedText,
    activeDirections: [],
    allDirections: [...variationDirections],
    variationsByDirection: {},
    considerationSet: [],
    loadingDirections: new Set()
  };
}

export function closeRewriteState() {
  rewriteState.isOpen = false;
}

export function setRewriteCurrentSentence(text) {
  rewriteState.currentSentence = text;
}

export function setRewriteActiveDirections(directions) {
  rewriteState.activeDirections = directions;
}

export function addRewriteActiveDirection(directionId) {
  if (!rewriteState.activeDirections.includes(directionId)) {
    rewriteState.activeDirections.push(directionId);
  }
}

export function removeRewriteActiveDirection(directionId) {
  rewriteState.activeDirections = rewriteState.activeDirections.filter(d => d !== directionId);
}

export function setRewriteVariationsForDirection(directionId, variations) {
  rewriteState.variationsByDirection[directionId] = variations;
}

export function addToConsiderationSet(item) {
  const id = `consider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  rewriteState.considerationSet.push({
    id,
    text: item.text,
    label: item.label || null,
    comments: [],
    sourceDirection: item.sourceDirection || null
  });
  return id;
}

export function removeFromConsiderationSet(itemId) {
  rewriteState.considerationSet = rewriteState.considerationSet.filter(c => c.id !== itemId);
}

export function updateConsiderationItem(itemId, updates) {
  const item = rewriteState.considerationSet.find(c => c.id === itemId);
  if (item) {
    Object.assign(item, updates);
  }
}

export function addCommentToConsiderationItem(itemId, comment) {
  const item = rewriteState.considerationSet.find(c => c.id === itemId);
  if (item) {
    item.comments.push(comment);
  }
}

export function startLoadingDirection(directionId) {
  rewriteState.loadingDirections.add(directionId);
}

export function stopLoadingDirection(directionId) {
  rewriteState.loadingDirections.delete(directionId);
}

export function isDirectionLoading(directionId) {
  return rewriteState.loadingDirections.has(directionId);
}

export function isAnyDirectionLoading() {
  return rewriteState.loadingDirections.size > 0;
}

// Get context sentences (before and after the selected text)
export function getRewriteContext() {
  const { fullText, startIndex, endIndex } = rewriteState;

  // Get text before and after
  const beforeText = fullText.substring(0, startIndex);
  const afterText = fullText.substring(endIndex);

  // Split into sentences (simple approach - split on . ! ? followed by space or end)
  const sentenceRegex = /[^.!?]*[.!?]+/g;

  const beforeSentences = beforeText.match(sentenceRegex) || [];
  const afterSentences = afterText.match(sentenceRegex) || [];

  // Get last 2-3 sentences before and first 2-3 after
  const contextBefore = beforeSentences.slice(-3).join('').trim();
  const contextAfter = afterSentences.slice(0, 3).join('').trim();

  return { contextBefore, contextAfter };
}

// Feedback log for rewrite session
export let feedbackLog = [];

export function addFeedback(feedback) {
  const id = `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  feedbackLog.push({
    id,
    timestamp: new Date().toISOString(),
    ...feedback
  });
  return id;
}

export function setVote(variationId, vote, context) {
  // Find existing vote for this variation
  const existing = feedbackLog.find(f =>
    f.type === 'vote' && f.variationId === variationId
  );

  if (existing) {
    if (existing.vote === vote) {
      // Same vote = clear it
      removeFeedback(existing.id);
      return null;
    } else {
      // Different vote = update it
      existing.vote = vote;
      existing.timestamp = new Date().toISOString();
      return existing.id;
    }
  } else {
    // New vote
    return addFeedback({
      type: 'vote',
      variationId,
      vote,
      ...context
    });
  }
}

export function getVoteForVariation(variationId) {
  const fb = feedbackLog.find(f =>
    f.type === 'vote' && f.variationId === variationId
  );
  return fb ? fb.vote : null;
}

export function addHighlightAnnotation(variationId, highlightedText, start, end, annotation, context) {
  return addFeedback({
    type: 'highlight',
    variationId,
    highlightedText,
    highlightStart: start,
    highlightEnd: end,
    annotation,
    ...context
  });
}

export function addCardAnnotation(variationId, annotation, context) {
  return addFeedback({
    type: 'card_annotation',
    variationId,
    annotation,
    ...context
  });
}

export function updateFeedback(feedbackId, updates) {
  const fb = feedbackLog.find(f => f.id === feedbackId);
  if (fb) {
    Object.assign(fb, updates);
    fb.timestamp = new Date().toISOString();
  }
}

export function removeFeedback(feedbackId) {
  feedbackLog = feedbackLog.filter(f => f.id !== feedbackId);
}

export function clearFeedbackLog() {
  feedbackLog = [];
}

export function getFeedbackByDirection() {
  const groups = {};
  for (const fb of feedbackLog) {
    const dirId = fb.directionId || 'other';
    if (!groups[dirId]) {
      groups[dirId] = {
        name: fb.directionName || 'Other',
        items: []
      };
    }
    groups[dirId].items.push(fb);
  }
  return groups;
}

export function getFeedbackCount() {
  return feedbackLog.length;
}

// Export all state as JSON object
export function exportState() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    styleGuide,
    alternatives,
    reactions,
    selectedStyles: Array.from(selectedStyles)
  };
}

// Import state with best-effort loading
export function importState(data) {
  // Settings - merge with defaults for missing fields
  if (data.settings && typeof data.settings === 'object') {
    settings = { ...DEFAULT_SETTINGS, ...data.settings };
    saveSettingsToStorage(settings);
  }

  // Style guide - validate each rule has required fields
  if (Array.isArray(data.styleGuide)) {
    styleGuide = data.styleGuide.filter(rule =>
      rule && typeof rule.principle === 'string'
    ).map(rule => ({
      id: rule.id || `rule-${Date.now()}-${Math.random()}`,
      principle: rule.principle,
      originalExample: rule.originalExample || null,
      betterVersion: rule.betterVersion || null,
      avoid: Array.isArray(rule.avoid) ? rule.avoid : [],
      prefer: Array.isArray(rule.prefer) ? rule.prefer : []
    }));
    saveStyleGuideToStorage();
  }

  // Alternatives - validate structure
  if (Array.isArray(data.alternatives)) {
    alternatives.length = 0;
    data.alternatives.forEach(alt => {
      if (alt && typeof alt.text === 'string') {
        alternatives.push({
          id: alt.id || `alt-${Date.now()}-${Math.random()}`,
          tags: Array.isArray(alt.tags) ? alt.tags : [],
          text: alt.text
        });
      }
    });
  }

  // Reactions - validate structure
  if (Array.isArray(data.reactions)) {
    reactions.length = 0;
    data.reactions.forEach(r => {
      if (r && typeof r.text === 'string' && r.alternativeId) {
        addReaction({
          alternativeId: r.alternativeId,
          quote: r.quote || null,
          text: r.text
        });
      }
    });
  }

  // Selected styles - validate each is a string
  if (Array.isArray(data.selectedStyles)) {
    selectedStyles.clear();
    data.selectedStyles.forEach(s => {
      if (typeof s === 'string') {
        selectedStyles.add(s);
      }
    });
  }

  return data.inputs || null; // Return inputs for UI to handle
}
