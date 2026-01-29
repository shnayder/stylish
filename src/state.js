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
