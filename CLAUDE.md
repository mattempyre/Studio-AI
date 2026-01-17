# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# All Servers (Recommended for Development)
npm run dev:all      # Start frontend, backend, and Inngest together

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

## Feature Implementation Guidelines

**Component Organization:**
- Keep TSX files under 300 lines - if a file exceeds this, extract sub-components
- Create a folder for complex components (e.g., `CharacterLibrary/`, `ScriptEditorV2/`)
- Follow the existing pattern: main component + sub-components in the same folder

**File Structure for Complex Components:**
```
components/
  FeatureName/
    FeatureName.tsx      # Main component, orchestrates sub-components
    SubComponentA.tsx    # Focused, single-responsibility component
    SubComponentB.tsx    # Another sub-component
    index.ts             # Re-exports main component
    types.ts             # Feature-specific types (if needed)
    hooks.ts             # Feature-specific hooks (if needed)
```

**Extraction Signals:**
- File exceeds 300 lines
- Component has multiple distinct UI sections
- Logic can be isolated into a custom hook
- A section is reused or could be tested independently

**What to Extract:**
- Modal dialogs → separate component
- List items with complex rendering → separate component
- Form sections → separate component
- Reusable UI patterns → shared component in `components/`
- Complex state logic → custom hook in same folder

**Existing Examples:**
- `CharacterLibrary/` - Grid, Card, Modal, DeleteConfirmation as separate files
- `ScriptEditorV2/` - Header, Sidebar, SectionCard, SentenceRow as separate files

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

## Story Development Workflow

### Git Worktrees for Parallel Development

Use git worktrees to work on multiple stories in parallel. Each story should have its own worktree to enable concurrent development without branch switching.

```bash
# Create a worktree for a story
git worktree add ../Studio-AI-STORY-XXX -b feature/STORY-XXX-description

# Set up ports for the worktree (IMPORTANT!)
cd ../Studio-AI-STORY-XXX
npm install
npm run setup:ports

# List active worktrees
git worktree list

# Remove a worktree after merging
git worktree remove ../Studio-AI-STORY-XXX
```

**Worktree naming convention:** `../Studio-AI-STORY-{ID}` (sibling directory to main repo)

### Worktree Port Configuration

Each worktree can run its own dev servers on different ports to avoid conflicts. Ports are assigned based on story number:

| Worktree | Frontend | Backend | Inngest |
|----------|----------|---------|---------|
| main | 3000 | 3001 | 8288 |
| STORY-010 | 3100 | 3101 | 8210 |
| STORY-011 | 3110 | 3111 | 8211 |
| STORY-012 | 3120 | 3121 | 8212 |

**Setup ports after creating a worktree:**
```bash
cd ../Studio-AI-STORY-011
npm run setup:ports    # Generates .env.local with correct ports
npm run dev:all        # Starts all servers on configured ports
```

The `npm run setup:ports` command:
- Extracts story number from directory name
- Creates `.env.local` with `PORT`, `VITE_PORT`, `INNGEST_DEV_PORT`
- Preserves any existing non-port environment variables

**Running multiple worktrees simultaneously:**
```bash
# Terminal 1 - Main repo
cd Studio-AI
npm run dev:all        # Frontend: 3000, Backend: 3001

# Terminal 2 - STORY-011 worktree
cd Studio-AI-STORY-011
npm run dev:all        # Frontend: 3110, Backend: 3111
```

### Story Dependencies

Before starting a story, verify that all dependent stories are completed:

1. Check the story document in `docs/stories/STORY-XXX.md` for dependencies
2. Check the sprint plan in `docs/sprint-plan-*.md` for dependency graph
3. Verify dependent stories are merged to main before starting

**Dependency resolution:**
- If dependencies are incomplete, either wait or work on a different story
- Stories without dependencies can be worked on immediately
- Multiple independent stories can run in parallel using separate worktrees

### Parallel Development Example

```bash
# Story A has no dependencies - start immediately
git worktree add ../Studio-AI-STORY-010 -b feature/STORY-010-script-editor

# Story B depends on A - wait for A to merge, or work on C instead
# Story C is independent - can start in parallel with A
git worktree add ../Studio-AI-STORY-011 -b feature/STORY-011-character-crud

# After completing work in a worktree
cd ../Studio-AI-STORY-010
git add . && git commit -m "feat(STORY-010): ..."
git push origin feature/STORY-010-script-editor
# Create PR, merge, then clean up
cd ../Studio-AI
git worktree remove ../Studio-AI-STORY-010
```

### Sprint Workflow

1. Review sprint plan to identify independent stories
2. Create worktrees for stories that can run in parallel
3. Respect dependency order - don't start dependent stories until prerequisites merge
4. Run tests in each worktree before committing
5. Clean up worktrees after stories are merged