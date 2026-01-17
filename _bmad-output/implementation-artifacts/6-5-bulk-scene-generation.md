# Story 6.5: Bulk Scene Generation

Status: ready-for-dev

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

- [ ] Task 1: Create bulk generation API (AC: 3, 4, 10)
  - [ ] 1.1: Add `POST /api/v1/projects/:id/generate-scenes`
  - [ ] 1.2: Queue image generation events
  - [ ] 1.3: Queue video generation events after images

- [ ] Task 2: Create useSceneGeneration hook (AC: 2, 6)
  - [ ] 2.1: Create `hooks/useSceneGeneration.ts`
  - [ ] 2.2: Track overall progress
  - [ ] 2.3: Listen for WebSocket events

- [ ] Task 3: Create BulkGenerationToolbar component (AC: 1, 5, 7)
  - [ ] 3.1: Create `components/Storyboard/BulkGenerationToolbar.tsx`
  - [ ] 3.2: Add generate button with progress
  - [ ] 3.3: Add cancel button
  - [ ] 3.4: Show completion toast

- [ ] Task 4: Add error handling (AC: 8, 9)
  - [ ] 4.1: Collect failed sentences
  - [ ] 4.2: Show error summary dialog
  - [ ] 4.3: Add retry failed option

- [ ] Task 5: Write tests
  - [ ] 5.1: Unit tests for progress tracking
  - [ ] 5.2: Integration tests for bulk queue
  - [ ] 5.3: Cancel behavior tests

## Dev Notes

### Architecture Patterns
- Similar to bulk audio generation (STORY-016)
- Sequential: images first, then videos
- WebSocket events drive all updates

### Source Tree Components

**New Files:**
- `hooks/useSceneGeneration.ts`
- `components/Storyboard/BulkGenerationToolbar.tsx`
- `components/Storyboard/ErrorSummaryDialog.tsx`

**Modified Files:**
- `src/backend/api/projects.ts` - Add generate-scenes endpoint
- `pages/Storyboard.tsx` - Add toolbar

### References
- [Source: docs/stories/STORY-027-bulk-scene-generation.md]
- [Source: docs/stories/STORY-016-bulk-audio-generation.md] - Similar pattern
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-606]

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
