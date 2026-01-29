# Writing style explorer

This is a UI exploration of an AI-assisted writing style explorer. There are a million ways to describe something. This tool should help me find one I like, and articulate the articulatable aspects of that style so it can be applied again elsewhere in my writing.

## Goals and hypotheses

Hypothesis: it is now possible to fairly easily capture more granular aspects of a user’s writing style and related preferences, and this can be useful. It can help generate better suggestions, and show them useful context.  

More granular hypotheses or goals:
- Assistance. the system should ultimately generate good suggestions.
    - Steerability. It should be easier to get the kind of output I want than using direct prompt engineering. This applies for user input — the UI should pull the right info out of their brain. It also applies to AI output -- the elicited and organized information should be used to ensure that generated suggestions are likely to be good.
- Pedagogy. For a non-expert writer, or even an expert starting a new project, the system should help clarify what style is desired, and how to think about it. Using the tool should make me a better writer.
- Usability at scale. It's relatively easy to gather and process the first few pieces of feedback. It's going to be harder to make it practical with thousands of detailed thoughts at many levels of abstraction.
- Structured approach: defining schemas and organizing the info hierarchically is useful both for steerability and robustness of AI support and for UX scalability. 

Validation: build a prototype for writing small story segments (a paragraph or two), that helps me personally hone in on a style I like. Along the way, produce an organized style guide. Test by writing a handful of examples in very different stories, as well as by making a few variations on the same piece, with different style preferences. 

Less concern with speed and cost for now. If quality is good enough, lots of ways to optimize (just wait a few months, for one). UX needs to be relatively polished so I can evaluate usability. Visual polish and consistency is nice but less important. 

## High level design

This is a high level description of what we're trying to build. We'll need to add functionality incrementally, feature by feature.

Major parts of the app:
- Context on what are we writing.
- Current draft and variations
- Style guide evolving as we go. 
- Reactions to and discussions about all of the above. 

Each described in the following subsections.

### Context

- Story context: what are we writing about? What do we know about it? What has happened before or will happen after? etc. Could eventually be fleshed out into sections, but can start with a simple text box.
- Global style context: e.g. we're writing in 3rd person past tense, etc.
- Local style context: tone, emotion, etc we want in this scene or passage.

### Current draft and variations
- A current draft, and variations at various levels -- entire thing, a paragraph, or a highlighted segment like a sentence or even a single word.
    - could be recursive -- look at a variation and ask for some further variations of one of the sentences
    - tools to manually and intelligently manage all this -- pick one variation out of many, deprioritize or archive ones that seem obsolete, etc.

### Ever-evolving style guide
- My rules of writing. Organized by category, and level of detail.
    - high level rules
        - detailed rules and exceptions
            - examples -- good and bad, perhaps alternatives. Including something about their context -- the same sentence could be great in one situation and terrible in another.
    - ongoing organization as new rules are added
        - dedup by placing new examples of an existing rule in the right place
        - propose merging or splitting rules 
    - could include general writing best practices by default
    - ways to review, filter, and edit the style guide -- perhaps tags, search, etc.
    - find rules and examples that are most relevant to a particular context, to display as the user works

### Reaction and coaching and elicitation flows
- for any piece of text I see, be able to express an opinion -- could be good/bad when quickly reviewing a bunch of suggestions, but I'm imagining actual words in many cases
- an AI assistant or writing coach that helps clarify that reaction, match it to existing style rules and perhaps add as an example, or create a new rule.

## Features
(Add as new ones are added)

- for quick initial iteration, start with a static html prototype based on hard-coded data structures inside the file, capturing a moment mid-user-journey. We'll turn into a real app later.
    - Pane for what we're trying to describe.
    - Pane for my guidance on how to describe settings
    - Several alternatives, each with a few words or tags or bullet points of meta-description
    - Use rivendell from LotR/the Hobbit as the example setting.
- Reactions system for collecting user feedback on alternatives
    - Add reactions to an entire alternative via text input below each one
    - Select text within an alternative to react to a specific passage (popup appears)
    - Reactions panel at bottom collects all reactions across alternatives
    - "Apply to Guidance" button to update guidance based on reactions
    - "Generate New Version" button to create new description incorporating feedback
- Style Properties palette for exploring and selecting style attributes
    - ~50 properties organized into categories: Tone, Pacing, Technique, Sensory Focus, Perspective, Mood, Structure
    - Multi-select with visual feedback
    - "Generate with Selected Styles" to create new variant based on selected properties
    - Selection count displayed in header
- LLM Integration
    - Settings panel (gear icon, top right) for configuring LLM provider
    - Local mode: LM Studio (OpenAI-compatible API at localhost:1234)
    - Cloud mode: Anthropic Claude API
    - Test connection button to verify setup
    - Settings persisted in localStorage
- Editable input panes
    - "What I'm Describing" - setting details (auto-sizes to content)
    - "General Style" - rules that apply to whole project (POV, tense, prose style)
    - "This Scene" - goals specific to this description (mood, tension, purpose)
    - Content used as context for LLM generation
- Style Guide (per-project)
    - Collapsible section showing crystallized style rules
    - Each rule has: principle, avoid examples, prefer examples
    - Rules are fed into all generation prompts
    - Persisted in localStorage
- Style Drill-Down (coaching conversation)
    - Select text + click "Drill Down" to explore your reaction
    - Modal opens with AI writing coach
    - Coach asks clarifying questions to help articulate preferences
    - After 2-3 exchanges, proposes a crystallized style rule
    - User can edit rule before adding to Style Guide
    - Helps move from vague feelings to specific principles
- Generation features
    - "Generate More" creates 2 new alternatives using current setting/guidance
    - "Generate with Selected Styles" creates 1 alternative with specified style properties
    - "Generate New Version" (from reactions) creates 1 alternative incorporating user feedback
    - Loading states shown during generation
    - Alternatives parsed for style tags (tone, technique, pacing)

