# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
```

## Environment Setup

Set `GEMINI_API_KEY` in `.env.local` with your Google Gemini API key.

## Architecture

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS (via CDN), Google Gemini API

**State Management:** Lifted-state pattern in App.tsx - all global state (projects, user, characters, voices) flows down via props. No external state library.

**Component Workflow:**
```
Auth → Dashboard → ScriptEditor → Storyboard → VideoPreview
```

Each step in the creation pipeline handles a specific phase:
- **ScriptEditor**: Script writing, character management, voice selection, audio generation
- **Storyboard**: Scene visualization, image/video prompt generation, media generation
- **VideoPreview**: Multi-track timeline editor (voice, music, SFX tracks), text overlays

## Key Files

| File | Purpose |
|------|---------|
| `App.tsx` | Root component, global state container, view routing |
| `services/geminiService.ts` | All Google Gemini API calls |
| `types.ts` | TypeScript interfaces for Project, Scene, Character, AudioTrack, etc. |
| `constants.ts` | Mock data and default values |

## Gemini API Integration

The `geminiService.ts` uses these models:
- `gemini-3-flash-preview` - Script generation with optional Google Search grounding
- `gemini-2.5-flash-image` - Image generation from prompts
- `gemini-2.5-flash-preview-tts` - Text-to-speech (PCM→WAV conversion included)
- `veo-3.1-fast-generate-preview` - Video generation (long-polling for completion)

API key is read from `process.env.API_KEY` or prompted via `window.aistudio` for AI Studio integration.

## Code Patterns

**useRef for Async State:** Components use `useRef` to access latest state in async callbacks (e.g., `projectRef.current` in Storyboard) to avoid stale closure issues.

**Progressive Updates:** Scene/section updates are applied one at a time to prevent overwriting concurrent changes.

**Auto-generation:** Storyboard auto-generates missing images on mount via useEffect.

## Type Definitions

Core types in `types.ts`:
- `Project` - Contains script sections, scenes, audio tracks, characters
- `Scene` - Maps to script section with imagePrompt, videoPrompt, narration
- `AudioTrack` - Multi-track support (voice/music/sfx) with clips array
- `Character` - Cast member with name, description, imageUrl
- `Voice` - Platform or cloned voice for TTS
