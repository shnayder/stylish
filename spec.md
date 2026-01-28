# Writing style explorer

This is a UI exploration of an AI-assisted writing style explorer. There are a million ways to describe something. This tool should help me find one I like, and articulate the articulatable aspects of that style so it can be applied again elsewhere in my writing.

Let's start focused on setting description. 

User desires:
- Describe what I know about the setting
- Describe what I know about how I want to approach setting description in general
- Add any additional info that this description could or should include (e.g. character action), or additional purposes the description should serve (increase tension, release tension through humor, reinforce a particular theme or point, etc)
- see alternative ways to describe it, including style labels or descriptions to help me articulate what I'm going for.

Features
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
    - "What I'm Describing" and "My Guidance" are now editable textareas
    - Content used as context for LLM generation
- Generation features
    - "Generate More" creates 2 new alternatives using current setting/guidance
    - "Generate with Selected Styles" creates 1 alternative with specified style properties
    - "Generate New Version" (from reactions) creates 1 alternative incorporating user feedback
    - Loading states shown during generation
    - Alternatives parsed for style tags (tone, technique, pacing)

