# Architecture

**Keep this document updated** when adding new modules, APIs, data flows, or significant patterns. This should reflect the actual current state of the codebase, not aspirational plans.

## Stack

Modular ES6 JavaScript with separate CSS files, no build step. Native browser ES modules. Node.js dev server for file-backed persistence.

## Server (`server.js`)

Minimal Node.js HTTP server serving static files plus two JSON file APIs:

| Endpoint | Methods | File | Empty default |
|----------|---------|------|---------------|
| `/api/style-guide` | GET, PUT | `style-guide.json` | `[]` |
| `/api/category-registry` | GET, PUT | `category-registry.json` | `{}` |

Both follow the same pattern: GET returns file contents (or default if missing), PUT validates JSON and writes pretty-printed.

## Data Files

### `style-guide.json`

Array of rule objects. Each rule has:
- `id` — unique identifier (e.g. `rule-met-003`)
- `principle` — short rule statement
- `categories` — array of category strings (e.g. `["metaphor", "description/senses"]`)
- `avoid` / `prefer` — arrays of pattern descriptions
- `originalExample` / `betterVersion` — example text pair

### `category-registry.json`

Flat object mapping category names to `{ description }`. Maintained as rules evolve. Currently 20 categories covering metaphor, description/senses, diction, imagery, abstraction, rhythm, pacing, repetition, transitions, voice, tone, register, authorial, clarity, implication, causality, scene, character, dialogue, world.

## State Management (`src/state.js`)

All app state lives here as exported `let` variables with mutation functions. Persistence:

- **Style guide** → server API (`/api/style-guide`) with localStorage backup
- **Category registry** → server API (`/api/category-registry`) with localStorage backup
- **Settings** → localStorage only
- **Session data** (alternatives, reactions, rewrite state, feedback log) → in-memory only

Key state objects: `settings`, `styleGuide`, `categoryRegistry`, `alternatives`, `reactions`, `rewriteState`, `drillDownState`, `feedbackLog`, `llmStats`.

Helper: `buildCategoryIndex()` returns `Map<categoryName, ruleId[]>` computed from the current style guide.

## LLM Integration (`src/llm.js`)

Dual provider support:
- **Local**: LM Studio at configurable URL (default `localhost:1234`), OpenAI-compatible API
- **Cloud**: Anthropic Claude API with direct browser access

Single `callLLM(prompt, systemPrompt)` entry point. Token usage tracked via `recordLLMCall()` in state.

## Prompt System (`src/prompts.js`)

Prompt builders return plain strings. Response parsers extract structured data from LLM output.

**Generation prompts**: `buildGenerationPrompt()`, `parseGeneratedResponse()`
**Coaching prompts**: `buildCoachStartPrompt()`, `buildCoachFollowupPrompt()`, `cleanCoachResponse()`
**Resolution pipeline prompts**: `buildCategoryMatchPrompt()`, `buildRuleTriagePrompt()`, `buildRuleEvaluationPrompt()`

`getStyleGuideText(ruleSubset?)` formats rules for inclusion in prompts; accepts optional subset array.

## Rule Resolution Pipeline (`src/resolution.js`)

Hierarchical pipeline that evaluates text against the style guide efficiently. Instead of stuffing all rules into context, it filters in stages:

```
Text → Stage 1: Category Match (1 LLM call)
     → Stage 2: Rule Lookup (free in-memory filter)
     → Stage 3: Rule Triage (1 LLM call, skipped if ≤15 candidates)
     → Stage 4: Deep Evaluation (1 LLM call)
```

Entry point: `resolveRules(text, { onStageComplete })` — returns `{ matchedCategories, candidateRules, triagedRules, evaluations }`. The `onStageComplete` callback enables progressive UI updates.

Parse helpers (`parseCategoryMatch`, `parseTriageResponse`, `parseEvaluation`) handle messy LLM output: markdown code blocks, preamble text, trailing commas, field name variations.

## UI Modules (`src/ui/`)

Each module owns a section of the UI. Pattern: `init*()` function wires event listeners, `render*()` functions update DOM.

| Module | Responsibility |
|--------|---------------|
| `settings.js` | Settings panel, data import/export |
| `alternatives.js` | Alternatives grid, selection popup, reactions |
| `styleGuide.js` | Style guide tab — rule list, edit, delete, expand/collapse |
| `tabs.js` | Tab switching (Writing / Style Guide) |
| `drillDown.js` | Coaching modal — conversation with LLM to crystallize rules |
| `stylePalette.js` | Style properties palette for directed generation |
| `rewriteView.js` | Sentence rewrite view with variation directions |
| `feedbackLog.js` | Feedback log within rewrite view |
| `synthesis.js` | Feedback-to-rules synthesis modal |
| `refinement.js` | Style rule refinement modal |
| `stats.js` | LLM usage stats panel |
| `analyzer.js` | Text analyzer — runs resolution pipeline, shows progressive results |

## Entry Point (`src/main.js`)

Initializes all modules in sequence, wires cross-module callbacks, sets up generation button handlers.

Init order: settings → tabs → style guide (async) → category registry (async) → render → event listeners → callbacks.

## Deployment

Currently local development only. Dev server on port 3000. Future: GitHub Pages with Claude API for deployed version, local LLM for dev.

## Testing

Playwright for browser-level tests (`test/screenshot.spec.js`). Run with `npm test`.
