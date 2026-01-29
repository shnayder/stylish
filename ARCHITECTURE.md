# Architecture & Engineering Plan

## Current State

Single `index.html` file (~2000 lines) with embedded CSS and JS. No build system, no tests, no module boundaries. Opens directly in browser, uses localStorage, calls LLM APIs directly from client.

**Problems as we scale:**
- Hard to navigate and modify large single file
- No way to work on features in isolation
- Merge conflicts when working in parallel
- No tests = regressions creep in
- Can't deploy anywhere useful (CORS issues with local LLM)

## Proposed Architecture

### Phase 1: Split into modules (minimal tooling)

Keep it simple - use native ES modules, no bundler yet.

```
/
├── index.html          # Shell: loads CSS and JS modules
├── styles/
│   ├── main.css        # Base styles
│   ├── components.css  # Component-specific styles
│   └── modal.css       # Modal styles
├── src/
│   ├── main.js         # Entry point, initialization
│   ├── state.js        # All app state, localStorage persistence
│   ├── llm.js          # LLM API calls (local + cloud)
│   ├── prompts.js      # All prompt templates
│   ├── ui/
│   │   ├── render.js       # Main render functions
│   │   ├── alternatives.js # Alternatives grid
│   │   ├── styleGuide.js   # Style guide section
│   │   ├── drillDown.js    # Coaching modal
│   │   ├── settings.js     # Settings panel
│   │   └── stylePalette.js # Style properties palette
│   └── utils.js        # Shared utilities
├── spec.md             # Product spec
├── CLAUDE.md           # Dev guidance
└── ARCHITECTURE.md     # This file
```

**Why this works:**
- Native ES modules work in modern browsers without bundler
- Clear separation of concerns
- Can work on `drillDown.js` without touching `alternatives.js`
- Still just open `index.html` locally - no build step

**Tradeoff:** Won't work on older browsers, but that's fine for a prototype.

### Phase 2: Add build tooling (when needed)

If/when we need:
- TypeScript for better refactoring
- NPM packages
- Minification for production
- Hot module reloading for faster dev

**Recommended:** Vite
- Near-zero config
- Fast dev server with HMR
- Produces single bundle for production
- Easy to add incrementally

### Phase 3: Testing

**Unit tests for:**
- State management (add/remove rules, persistence)
- Prompt generation (given inputs, produces expected prompts)
- Response parsing (extracts tags, rules from LLM output)

**E2E tests (later):**
- Playwright or Cypress
- Test critical flows with mocked LLM responses

## Deployment Options

### Option A: GitHub Pages (simplest)
**Works for:** Claude API (with browser access header)
**Doesn't work for:** Local LM Studio (CORS from remote origin)

```
Local dev:    file:// or localhost → LM Studio works
Production:   GitHub Pages → Claude API only
```

This is probably fine - use local LLM for dev, Claude for sharing/demo.

### Option B: Cloudflare Pages + Workers (if we need backend)
**Works for:** Both, API keys stay server-side
**Complexity:** Minimal - Workers are easy to set up

Only needed if:
- We want to hide API keys properly
- We need server-side features (user accounts, shared style guides, etc.)

### Recommendation

Start with **Option A**:
1. Set up GitHub Pages deployment
2. Local dev uses LM Studio
3. Deployed version uses Claude API (user provides key, stored in localStorage)

Move to Option B only if we need server-side features.

## Parallel Development Strategy

### Git workflow
- `main` branch = stable, deployable
- Feature branches for each piece of work
- Keep features small and modular

### Module boundaries enable parallelism
With split files, two people can work on:
- One on `drillDown.js` (coaching improvements)
- One on `alternatives.js` (variation management)

Without stepping on each other.

### Feature flags (simple version)
```javascript
// state.js
const FEATURES = {
  hierarchicalRules: false,  // Coming soon
  ruleDeduplication: false,  // Coming soon
};
```

Can develop features behind flags, merge to main, enable when ready.

## Migration Plan

### Step 1: Split files (do first)
1. Create directory structure
2. Extract CSS into separate files
3. Extract JS into modules with clear interfaces
4. Verify everything still works

### Step 2: Set up GitHub Pages
1. Create GitHub repo (if not already)
2. Enable Pages from main branch
3. Test deployment

### Step 3: Add tests incrementally
1. Start with state management tests
2. Add prompt generation tests
3. Add more as we touch each area

## Open Questions

1. **State management library?** Current approach (plain objects + localStorage) works. Could add something like Zustand if state gets complex, but probably not needed yet.

2. **UI framework?** Current vanilla JS rendering works. Could add Preact/Lit for components if we want, but adds complexity. Probably not worth it for a prototype.

3. **Multiple projects?** Currently single project in localStorage. May need to add project selection/switching. Can do this within current architecture.
