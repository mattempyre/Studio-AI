# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Frontend
npm install          # Install dependencies
npm run dev          # Start Vite dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build

# Backend
npm run server       # Start Express server on port 3001 (with hot reload)
npm run db:init      # Initialize SQLite database with schema
npm run db:studio    # Open Drizzle Studio for database viewing

# Inngest (Job Queue)
docker-compose up -d inngest  # Start Inngest dev server on port 8288
docker-compose down           # Stop all Docker services

# Testing
npm test             # Run all tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:
- `DEEPSEEK_API_KEY` - For script generation (future)
- `COMFYUI_URL` - Local ComfyUI instance (future)
- `CHATTERBOX_URL` - Local TTS service (future)

## Architecture

**Tech Stack:**
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS (via CDN)
- **Backend:** Node.js, Express, TypeScript, Drizzle ORM, SQLite
- **APIs:** Deepseek (script), ComfyUI (image/video), Chatterbox (TTS)

**Backend Structure:** (`src/backend/`)
- `server.ts` - Express server entry point
- `api/` - REST API routes (projects, characters, health, inngest)
- `db/` - Drizzle ORM schema and database connection
- `inngest/` - Inngest client, event types, and job functions
- `services/` - Business logic (jobService for tracking jobs)
- `clients/` - External service clients (future)

**Database:** SQLite with Drizzle ORM. Tables: projects, sections, sentences, characters, generation_jobs.

**State Management:** Frontend uses lifted-state pattern in App.tsx - all global state flows down via props.

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
| `src/backend/server.ts` | Express server entry point |
| `src/backend/db/schema.ts` | Drizzle ORM database schema |
| `src/backend/api/projects.ts` | Projects CRUD API endpoints |
| `src/backend/api/characters.ts` | Characters CRUD API endpoints |
| `src/backend/inngest/client.ts` | Inngest client and event type definitions |
| `src/backend/inngest/functions/` | Inngest job handler functions |
| `src/backend/services/jobService.ts` | Job status tracking service |

## Gemini API Integration

The `geminiService.ts` uses these models:
- `gemini-3-flash-preview` - Script generation with optional Google Search grounding
- `gemini-2.5-flash-image` - Image generation from prompts
- `gemini-2.5-flash-preview-tts` - Text-to-speech (PCM→WAV conversion included)
- `veo-3.1-fast-generate-preview` - Video generation (long-polling for completion)

API key is read from `process.env.API_KEY` or prompted via `window.aistudio` for AI Studio integration.

## Inngest Job Queue

Inngest handles background job orchestration for generation tasks. Key concepts:

**Event Types** (defined in `inngest/client.ts`):
- `test/hello` - Test event for verifying setup
- `audio/generate`, `audio/completed` - TTS generation
- `image/generate`, `image/completed` - Image generation
- `video/generate`, `video/completed` - Video generation
- `script/generate`, `script/completed` - Script generation
- `project/generate-all` - Bulk generation
- `export/start`, `export/completed` - Project export

**Concurrency Settings** (from architecture):
- Audio jobs: 4 parallel (CPU-bound)
- Image/Video jobs: 1 at a time (GPU-bound)

**Job Tracking:**
The `jobService` tracks job status in the `generation_jobs` table with states: `queued` → `running` → `completed` | `failed`

## Code Patterns

**useRef for Async State:** Components use `useRef` to access latest state in async callbacks (e.g., `projectRef.current` in Storyboard) to avoid stale closure issues.

**Progressive Updates:** Scene/section updates are applied one at a time to prevent overwriting concurrent changes.

**Auto-generation:** Storyboard auto-generates missing images on mount via useEffect.

**Inngest Steps:** Use `step.run()` for durable execution - each step is retryable and persisted.

## Type Definitions

Core types in `types.ts`:
- `Project` - Contains script sections, scenes, audio tracks, characters
- `Scene` - Maps to script section with imagePrompt, videoPrompt, narration
- `AudioTrack` - Multi-track support (voice/music/sfx) with clips array
- `Character` - Cast member with name, description, imageUrl
- `Voice` - Platform or cloned voice for TTS

## Testing Requirements

When developing or modifying features:
- Always check if tests exist for the feature being developed
- If no tests exist, create comprehensive tests covering:
  - Happy path scenarios
  - Edge cases
  - Error handling
- Run tests to verify they pass before considering the feature complete