# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-assisted writing style explorer focused on helping writers find and articulate description styles. The initial focus is on setting descriptions (e.g., describing locations in fiction).

See `spec.md` for the product vision and planned features.

## Technical Architecture

**Goal:** Usable prototype, not production-grade. Keep it simple.

### Stack
- **Frontend:** Single HTML file, vanilla JS, no build step
- **LLM Backend:** Dual support for local and cloud
  - Local: LM Studio (OpenAI-compatible API at localhost:1234)
  - Cloud: Claude API (Anthropic) as fallback option
- **State:** localStorage for persistence (settings, sessions)

### LLM Configuration
- Default to local LM Studio endpoint (`http://localhost:1234/v1`)
- Settings panel to switch between local/cloud
- For cloud: API key stored in localStorage
- Recommended local models for creative writing:
  - Mistral 7B Instruct (good starting point)
  - Nous Hermes 2 variants (fine-tuned for creative tasks)
  - Mixtral 8x7B if hardware supports it

### Key Files
- `index.html` - The entire application (HTML, CSS, JS in one file)
- `spec.md` - Product vision and feature documentation
- `CLAUDE.md` - Technical decisions and dev guidance

## Coding Approach

- Keep everything in the single HTML file for simplicity
- Any time you add new functionality, document it in spec.md if not already present
- No external dependencies beyond what's loaded via CDN (if any)
- Test with LM Studio running locally on default port
