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
├── index.html          # HTML shell, loads CSS and JS module
├── styles/
│   ├── main.css        # Base styles, layout, settings panel
│   ├── components.css  # Alternatives, reactions, style palette, style guide
│   └── modal.css       # Drill-down modal
├── src/
│   ├── main.js         # Entry point, initialization, event wiring
│   ├── state.js        # All app state, localStorage persistence
│   ├── llm.js          # LLM API calls (local + cloud)
│   ├── prompts.js      # Prompt templates and response parsing
│   ├── utils.js        # Shared utilities
│   └── ui/
│       ├── settings.js     # Settings panel
│       ├── alternatives.js # Alternatives grid, reactions
│       ├── styleGuide.js   # Style guide section
│       ├── drillDown.js    # Coaching modal
│       └── stylePalette.js # Style properties palette
├── test/
│   └── screenshot.spec.js  # Playwright visual tests
├── package.json        # npm config
└── playwright.config.js # Test config
```

**LLM:** Dual support for local (LM Studio at localhost:1234) and cloud (Claude API).

**State:** localStorage for settings, style guide, and session data.

**Testing:** Playwright for automated browser tests and screenshots.

## Development Commands

```bash
# Install dependencies
npm install

# Run tests
npm test

# Serve locally (for testing or to avoid file:// issues)
npm run serve
```

## Development Conventions

### When adding features
1. Check if it fits the high-level design in `spec.md`
2. Document new features in the Features section of `spec.md`
3. Place code in the appropriate module based on responsibility
4. Follow existing patterns for state management and UI updates

### Module responsibilities
- `state.js` - State changes and localStorage. Export state variables and functions to modify them.
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
