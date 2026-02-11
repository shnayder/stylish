# Writing style explorer

This is a UI exploration of an AI-assisted writing style explorer. There are a million ways to describe something. This tool should help me find one I like, and articulate the articulatable aspects of that style so it can be applied again elsewhere in my writing.

## Goals and hypotheses

Hypothesis: it is now possible to explicitly capture more granular aspects of a user’s writing style and related preferences, and having such a detailed and articulated style guide can be useful. In particular, it can augment simply providing a lot of examples of a user's previous writing or writing they want to emulate, and making the AI pick up on the patterns implicitly. It can help generate better suggestions, and show them useful context. 

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

### Text-centered UI redesign (current)

The UI is organized around the writer's text as the central surface. No tabs — everything happens on one page. Three interaction postures:

1. **The Pen (direct editing)**
   - Central writing textarea — always visible, always editable
   - "Generate Draft" button creates a starting draft from context (setting + scene)
   - Select text → "Variations" generates 5 alternative phrasings inline below the text
   - Click "Use" on any variation to replace the selected text

2. **The Mirror (express reactions)**
   - Select text → "React" opens an inline coaching thread
   - Multi-turn conversation with AI writing coach
   - Coach asks clarifying questions to help articulate preferences
   - "Crystallize as Rule" proposes a style rule from the conversation
   - "Add to Style Guide" saves the rule; coach can keep exploring otherwise
   - Multiple threads can exist (only one expanded at a time)

3. **The Lens (system evaluation)**
   - "Evaluate" button runs the resolution pipeline on the full text
   - Results appear as annotation cards showing which rules are followed, violated, or partially met
   - Each annotation has actions: Dismiss, Challenge (opens Mirror thread about the rule)
   - Summary shows counts by assessment type

### Supporting infrastructure

- **Context panel** (collapsible header): "What I'm Describing" + "This Scene" panes
- **Selection menu**: Floating popup on text selection with React / Variations / Evaluate
- **Style Guide panel** (collapsible footer): Compact rule summaries, "Manage Rules" for full view
- **Full style guide view**: Overlay with full rule management (expand/collapse, edit, delete, refine with AI, reload from file)
- **LLM Integration**: Settings panel for Local (LM Studio) or Cloud (Claude API), with test connection
- **LLM Stats**: Token usage tracking and estimated costs
- **JSON export/import**: Backup and restore all data

### Previous features (available via full style guide view)

- Style rule editing: principle, avoid/prefer patterns, examples, categories
- Rule refinement modal: AI-assisted conversation to improve a rule
- Suggest rewrites for example "Bad" text in rule editing
- Category-based rule organization with expand/collapse

## Roadmap -- not implemented yet

- Single sentence rewriting view
    - show local context -- previous few lines and following few lines.
    - show current version, let me edit it directly
    - suggest different directions of variation -- e.g. simpler/more complex sentence structure, more concrete vs more abstract imagery, etc. Some can be binary or a single continuous axis, others categorical (emphasize sound/touch/smell/etc).
        - pick a few directions that seem most applicable and generate 5-10 variations along that axis
        - also suggest another 10-20 different directions
            - I can select one and add it to the set of alternatives
    - at any time, I can pick one of the recommendations and add it to a "consideration set" of alternatives
        - I can edit any of the sentences
        - I can comment on the original or any of the consideration set alternatives, and my comments are fed back in when generating a new sentence.
        - I can replace the original with one of the consideration set sentences. 
    - I can update the original text with the new sentence. 
        

- Style guide
    - CRUD -- add new rules, remove rules. Edit already supported.
    - Flexibity
        - allow multiple examples for a rule
    - "Suggest" better version options in style guide edit view -- show 3-5 rewrites, let me pick one or generate more.
    - hierarchy of scope -- some rules are about the entire story, or a scene, or a character, others about a sentence
    - hierarchy of applicability -- general rule, exceptions or more specific versions, exceptions to exceptions.
    - general guidelines, story-specific guidelines (e.g. "write in the 3rd person", "emphasize the main character's mental state more than usually recommended, since that's a major focus of this story"), scene-specific ones ("this scene should be especially fast paced").

    - auto-categorization. 
        - Define a set of categories (dynamically ideally), add tags
    - move "general style" pane into style guide

- Applying style guide
  - review some text with style guide in mind -- highlight places where rules seem to be broken, exceptions, etc. 
     - let me clarify where I'm happy -- either making an exception, or can refine the rule, or prioritizing a different principle in tension with the first.

- page org
  - ~~full style guide should be a separate tab~~ DONE
  - main text view: scene context (what I'm describing, goals for the scene), scene-specific style guidelines (including most relevant from style guide), current text, variations
  - modal for refining thoughts and opinions about some issue or question

- Reactions
  - should go into style guide
  - let me go over the text and say how happy I am with it. Highlighter style? 
    - and then dig into what I do and don't like
        - ideally with guesses from computer, informed by style guide

- To do queue? 
    - help me see what to do next... we'll worry about that later. Just having markup of what I don't like is an implicit todo list.

- for real testing, will want to be able to open different files, have basic local/global style guide management -- some things are specific to a story, some are my general preferences.