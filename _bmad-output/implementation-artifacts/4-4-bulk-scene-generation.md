# Story 4.4: Bulk Scene Generation

Status: review

## Story

As a **creator**,
I want **to generate images and videos for all scenes at once**,
so that **I can process my entire video efficiently**.

## Acceptance Criteria

1. "Generate All Scenes" button in storyboard toolbar
2. Button shows progress: "Generating... (5/24)"
3. Generates images for all sentences lacking images
4. After images complete, generates videos
5. Cancel button stops remaining jobs
6. Per-sentence status updates in real-time
7. Toast notification on completion
8. Error summary shows failed sentences
9. Retry failed sentences option
10. Respects concurrency limits (1 for images, 1 for video)

## Tasks / Subtasks

- [x] Task 1: Create bulk generation API (AC: 3, 4, 10)
  - [x] 1.1: Add `POST /api/v1/projects/:id/generate-scenes`
  - [x] 1.2: Queue image generation events
  - [x] 1.3: Queue video generation events after images

- [x] Task 2: Create useSceneGeneration hook (AC: 2, 6)
  - [x] 2.1: Create `hooks/useSceneGeneration.ts`
  - [x] 2.2: Track overall progress
  - [x] 2.3: Listen for WebSocket events

- [x] Task 3: Create BulkGenerationToolbar component (AC: 1, 5, 7)
  - [x] 3.1: Create `components/Storyboard/BulkGenerationToolbar.tsx`
  - [x] 3.2: Add generate button with progress
  - [x] 3.3: Add cancel button
  - [x] 3.4: Show completion toast

- [x] Task 4: Add error handling (AC: 8, 9)
  - [x] 4.1: Collect failed sentences
  - [x] 4.2: Show error summary dialog
  - [x] 4.3: Add retry failed option

- [x] Task 5: Write tests
  - [x] 5.1: Unit tests for progress tracking
  - [x] 5.2: Integration tests for bulk queue
  - [x] 5.3: Cancel behavior tests

## Dev Notes

### Architecture Patterns (Updated per Architecture v1.1)
- Similar to bulk audio generation (STORY-016)
- Sequential: images first, then videos
- WebSocket events drive all updates
- **Audio pre-requisite**: Audio should be generated first (section-level batch is available via `audio/generate-section` event)

### Audio Generation Options (per Architecture v1.1)

The architecture provides two audio generation modes:

1. **Per-sentence audio** (`audio/generate`): Individual TTS for each sentence
2. **Section-level batch** (`audio/generate-section`): Generate audio for entire section at once, with Whisper-based sentence alignment

For bulk scene generation, consider:
- If audio is missing, recommend generating section audio first for better flow
- Section-level audio provides word-level timing for karaoke highlighting

### Video Prompt Dependency

Before video generation, ensure `videoPrompt` fields are populated:
- Use `prompts/generate-video` event or `videoPromptService` to generate video prompts
- Video prompts describe motion/action for Wan 2.2 image-to-video workflows

### Source Tree Components

**New Files:**
- `hooks/useSceneGeneration.ts`
- `components/Storyboard/BulkGenerationToolbar.tsx`
- `components/Storyboard/ErrorSummaryDialog.tsx`

**Modified Files:**
- `src/backend/api/projects.ts` - Add generate-scenes endpoint
- `pages/Storyboard.tsx` - Add toolbar

### References
- [Source: docs/architecture-videogen-ai-studio-2026-01-17.md] - Architecture v1.1 (2026-01-19)
- [Source: docs/stories/STORY-027-bulk-scene-generation.md]
- [Source: docs/stories/STORY-016-bulk-audio-generation.md] - Similar pattern
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-606]
- [Source: src/backend/inngest/client.ts] - Event type definitions
- [Source: src/backend/services/videoPromptService.ts] - Video prompt generation service

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
- Tests run successfully: 27 tests passing across 3 test files

### Completion Notes List
- Implemented bulk scene generation API with three endpoints:
  - `POST /api/v1/projects/:id/generate-scenes` - Queue image and video generation
  - `POST /api/v1/projects/:id/cancel-scenes` - Cancel queued jobs
  - `POST /api/v1/projects/:id/retry-failed-scenes` - Retry failed jobs
- Created useSceneGeneration hook with WebSocket integration for real-time progress
- Created BulkGenerationToolbar component with:
  - "Generate All Scenes" button with progress display
  - Cancel button (shown during generation)
  - Progress bar with percentage
  - Completion notification toast
  - Error indicator linking to error dialog
- Created ErrorSummaryDialog component for error display and retry
- Integrated toolbar into Storyboard component header
- All acceptance criteria implemented and tested

### File List

**New Files Created:**
- `hooks/useSceneGeneration.ts` - Hook for managing bulk scene generation state
- `components/Storyboard/BulkGenerationToolbar.tsx` - Toolbar component
- `components/Storyboard/ErrorSummaryDialog.tsx` - Error summary dialog
- `components/Storyboard/index.ts` - Component exports
- `tests/unit/generateScenesApi.test.ts` - API unit tests
- `tests/unit/useSceneGeneration.test.ts` - Hook unit tests
- `tests/components/Storyboard/BulkGenerationToolbar.test.tsx` - Component tests

**Modified Files:**
- `src/backend/api/projects.ts` - Added generate-scenes, cancel-scenes, retry-failed-scenes endpoints
- `components/Storyboard.tsx` - Integrated BulkGenerationToolbar

## Change Log

- 2026-01-19: Initial implementation of bulk scene generation feature (STORY 4-4)
