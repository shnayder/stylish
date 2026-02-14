# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-assisted writing style explorer that helps writers find and articulate description styles. See `spec.md` for product vision, goals, and high-level design.

## Key Documents

- `spec.md` - Product spec: goals, hypotheses, high-level design, features
- `ARCHITECTURE.md` - Technical architecture and engineering plan
- `CLAUDE.md` - This file: dev guidance and conventions

## Current Technical State

**Stack:** Modular ES6 JavaScript with separate CSS files, no build step required.

**Structure:**
```
/
├── index.html              # HTML shell — text-centered single-page layout
├── server.js               # Dev server: static files + style guide & category registry APIs
├── style-guide.json        # Style guide data (human-editable JSON)
├── category-registry.json  # Category definitions for rule resolution pipeline
├── styles/
│   ├── main.css            # Base styles, settings panel, stats panel
│   ├── components.css      # Style guide rules, selection popups, assessment badges
│   ├── surface.css         # Text-centered layout: context panel, writing surface, annotations
│   └── modal.css           # Drill-down, refinement, synthesis modals
├── src/
│   ├── main.js             # Entry point, initialization, callback wiring
│   ├── state.js            # All app state, localStorage + file-backed persistence
│   ├── llm.js              # LLM API calls (local + cloud)
│   ├── prompts.js          # Prompt templates and response parsing
│   ├── resolution.js       # Hierarchical rule resolution pipeline
│   ├── utils.js            # Shared utilities
│   └── ui/
│       ├── writingArea.js      # Central text surface, selection menu, generate draft
│       ├── mirror.js           # Mirror flow: inline reaction threads (coaching)
│       ├── lens.js             # Lens flow: evaluation annotations
│       ├── variations.js       # Inline variations for selected text
│       ├── styleGuidePanel.js  # Collapsible style guide panel + full management view
│       ├── settings.js         # Settings panel
│       ├── styleGuide.js       # Full style guide management (rules CRUD)
│       ├── drillDown.js        # Coaching modal (legacy fallback)
│       ├── refinement.js       # Style rule refinement modal
│       ├── synthesis.js        # Feedback synthesis modal
│       └── stats.js            # LLM usage stats panel
├── test/
│   └── screenshot.spec.js  # Playwright visual tests
├── package.json            # npm config
└── playwright.config.js    # Test config
```

**LLM:** Dual support for local (LM Studio at localhost:1234) and cloud (Claude API).

**State:** Style guide stored in `style-guide.json` and category registry in `category-registry.json`, both via server API (localStorage as backup). Settings and session data in localStorage.

**Testing:** Playwright for automated browser tests and screenshots.

## Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Serve locally (starts Node server on port 3000)
npm run serve
```

## Development Conventions

### Planning features

Plan in this order — **user-facing design first, implementation second, code last:**

1. **UX/design first:** What does the user see and do? Describe the interaction flow, what appears on screen, what the user clicks/types, what feedback they get. Use plain language. Don't mention CSS classes, module names, or data structures at this stage unless there are significant technical tradeoffs to make.
2. **Implementation plan:** Once the UX is agreed on, describe the technical approach — what modules are involved, what data flows where, what the LLM calls look like, what state changes. Include a comprehensive testing plan. Update `ARCHITECTURE.md` if the feature adds new modules or significant patterns.
3. **Code:** Write the code. Follow existing patterns.

When discussing a feature with the user, stay at the appropriate level. A UX conversation should not include implementation details like planned CSS class names or function signatures.

### When adding features
1. Check if it fits the high-level design in `spec.md`
2. Document new features in the Features section of `spec.md`
3. Place code in the appropriate module based on responsibility
4. Follow existing patterns for state management and UI updates
5. Update `ARCHITECTURE.md` if adding new modules, APIs, or significant patterns

### Module responsibilities
- `state.js` - State changes, localStorage, and file-backed persistence (style guide). Export state variables and functions to modify them.
- `llm.js` - LLM API calls only. No UI, no state management.
- `prompts.js` - Prompt construction and response parsing. Imports state for context.
- `ui/*.js` - Render functions and event listeners for specific UI sections.
- `main.js` - Initialization and wiring between modules.

### LLM integration
- Local endpoint: `http://localhost:1234/v1/chat/completions`
- Keep prompts clean - local models may echo instructions
- Filter LLM responses for echoed prompt fragments
- Add console logging for debugging LLM issues

### Code style
- ES6 modules with named exports
- Async/await for async operations
- Clear function names describing purpose
- Keep functions focused and reasonably sized

## Recommended Local Models

For creative writing with LM Studio:
- **Mistral 7B Instruct** - Good starting point, fast
- **Nous Hermes 2** variants - Fine-tuned for creative tasks
- **Mixtral 8x7B** - Better quality if hardware supports it

## Next Steps (Engineering)

See `ARCHITECTURE.md` for the full plan. Summary:

1. ~~Split into modules~~ - DONE
2. ~~Add Playwright tests~~ - DONE
3. **GitHub Pages** - Deploy for testing; local LLM for dev, Claude API for deployed version
4. **More tests** - Add state management and prompt generation unit tests
