// Prompt templates

import { styleGuide } from './state.js';

export const SYSTEM_PROMPT = `You are a creative writing assistant specializing in prose style and description. You help writers explore different ways to describe settings, finding the voice and style that resonates with them.

When generating descriptions:
- Focus on craft and style, not just content
- Vary your approach based on the style properties requested
- Be specific and evocative
- Avoid clichés unless specifically requested
- Match the requested length closely

When asked to describe your stylistic choices, use brief, specific labels (1-3 words each) for tone, technique, and pacing.`;

export const COACH_SYSTEM_PROMPT = `You are a writing coach helping a writer articulate their stylistic preferences. Your role is to:

1. Ask clarifying questions to help them understand WHY they react to certain writing choices
2. Use specific terminology for writing concepts when helpful (e.g., "filtering", "purple prose", "show don't tell")
3. Be curious and non-judgmental - there are no wrong preferences
4. Help them move from vague feelings ("I don't like this") to specific principles ("Avoid naming emotions directly")
5. After 2-3 exchanges, propose a crystallized style rule

When proposing a rule, format it as JSON on a single line:
{"principle": "Short rule description", "avoid": ["example phrase to avoid"], "prefer": ["preferred alternative"], "betterVersion": "a rewrite of the original text following this rule"}

The betterVersion should be a concrete rewrite of the specific text they selected, demonstrating the principle.

Keep your responses concise (2-3 sentences for questions, slightly longer when proposing rules).`;

export function getStyleGuideText(ruleSubset = null) {
  const rules = ruleSubset || styleGuide;
  if (rules.length === 0) return '';

  const rulesText = rules.map(rule => {
    let text = `- ${rule.principle}`;
    if (rule.originalExample && rule.betterVersion) {
      text += `\n  NOT: "${rule.originalExample}"`;
      text += `\n  BETTER: "${rule.betterVersion}"`;
    }
    if (rule.avoid && rule.avoid.length > 0) {
      text += `\n  Avoid patterns like: ${rule.avoid.join(', ')}`;
    }
    if (rule.prefer && rule.prefer.length > 0) {
      text += `\n  Prefer patterns like: ${rule.prefer.join(', ')}`;
    }
    return text;
  }).join('\n');

  return `\nStyle rules from the author (follow these strictly):
${rulesText}
`;
}

export function buildGenerationPrompt(settingInfo, guidance, additionalInstructions = '') {
  const styleGuideText = getStyleGuideText();

  return `Write a description of the following setting:

${settingInfo}

Writing guidance from the author:
${guidance}
${styleGuideText}
${additionalInstructions}

First, output a JSON line with style tags, then the description. Format:
{"tone": "word", "technique": "phrase", "pacing": "word"}

Then write the description (2-3 paragraphs unless otherwise specified).`;
}

export function parseGeneratedResponse(response) {
  // Try to extract JSON tags and description
  const lines = response.trim().split('\n');
  let tags = { tone: 'varied', technique: 'mixed', pacing: 'moderate' };
  let textStartIndex = 0;

  // Look for JSON in first few lines
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    try {
      const jsonMatch = lines[i].match(/\{[^}]+\}/);
      if (jsonMatch) {
        tags = JSON.parse(jsonMatch[0]);
        textStartIndex = i + 1;
        break;
      }
    } catch (e) {
      // Not valid JSON, continue
    }
  }

  const text = lines.slice(textStartIndex).join('\n').trim();

  return {
    tags: [
      { text: tags.tone || 'varied', type: 'tone' },
      { text: tags.technique || 'mixed', type: 'technique' },
      { text: tags.pacing || 'moderate', type: 'pacing' }
    ],
    text: text || response // Fallback to full response if parsing failed
  };
}

export function buildCoachStartPrompt(selectedText, initialReaction) {
  return `The writer selected this text from a description:
"${selectedText}"

Their initial reaction: "${initialReaction || 'They want to explore why this doesn\'t work for them'}"

Ask ONE short question (1-2 sentences) to help them articulate what specifically they react to. Offer 2-3 specific possibilities. Do not include any meta-instructions in your response.`;
}

export function buildCoachFollowupPrompt(selectedText, initialReaction, conversation, shouldPropose) {
  const conversationText = conversation
    .map(m => `${m.role === 'user' ? 'WRITER' : 'COACH'}: ${m.content}`)
    .join('\n\n');

  return `You are helping a writer explore their reaction to this text:
"${selectedText}"

Their initial reaction: "${initialReaction || 'wants to explore'}"

CONVERSATION:
${conversationText}

YOUR TASK: ${shouldPropose
  ? 'Based on the conversation, propose a style rule. Output ONLY the JSON rule, nothing else: {"principle": "...", "avoid": [...], "prefer": [...]}'
  : 'Ask ONE short clarifying question (1-2 sentences max) to help them articulate their preference. Do not repeat what they said. Do not include any instructions in your response.'}`;
}

export function cleanCoachResponse(response) {
  return response
    .replace(/^(WRITER|COACH|Writer|Coach):\s*/gm, '')
    .replace(/Continue helping.*$/gm, '')
    .replace(/Ask another question.*$/gm, '')
    .replace(/YOUR TASK:.*$/gm, '')
    .replace(/CONVERSATION:.*$/gm, '')
    .replace(/Do not include.*$/gm, '')
    .trim();
}

// --- Resolution pipeline prompts (re-exported from resolution-prompts.js) ---

export {
  buildCategoryMatchPrompt,
  buildRuleTriagePrompt,
  buildRuleEvaluationPrompt
} from './resolution-prompts.js';
