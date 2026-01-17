# Story 5.3: Video Regeneration & Override

Status: ready-for-dev

## Story

As a **creator**,
I want **to edit video prompts and regenerate individual videos**,
so that **I have creative control over motion and animation**.

## Acceptance Criteria

1. Video prompt editable in scene inspector panel
2. Prompt changes auto-save with debounce
3. Editing prompt sets `isVideoDirty: true`
4. "Regenerate Video" button visible in inspector
5. Button disabled if no source image exists
6. Button disabled during active generation
7. Click triggers `video/generate` event for single sentence
8. Progress indicator shows during generation
9. Generated video replaces existing video
10. Video preview updates immediately after completion
11. Error state shows retry option
12. Old video file deleted after successful replacement

## Tasks / Subtasks

- [ ] Task 1: Create VideoPromptEditor component (AC: 1, 2)
  - [ ] 1.1: Create `components/Storyboard/VideoPromptEditor.tsx`
  - [ ] 1.2: Implement debounced auto-save
  - [ ] 1.3: Optional prompt (can use image prompt)

- [ ] Task 2: Create regenerate endpoint (AC: 7, 12)
  - [ ] 2.1: Add `POST /api/v1/sentences/:id/regenerate-video`
  - [ ] 2.2: Delete old video file
  - [ ] 2.3: Queue video/generate event

- [ ] Task 3: Update sentence API for dirty flag (AC: 3)
  - [ ] 3.1: Set isVideoDirty on videoPrompt change

- [ ] Task 4: Add video controls to SceneInspector (AC: 4, 5, 6, 8, 9, 10)
  - [ ] 4.1: Create VIDEO tab in inspector
  - [ ] 4.2: Add video preview with playback
  - [ ] 4.3: Add regenerate button with loading state
  - [ ] 4.4: Listen for WebSocket completion

- [ ] Task 5: Write tests
  - [ ] 5.1: Unit tests for video prompt editor
  - [ ] 5.2: Integration tests for regeneration

## Dev Notes

### Architecture Patterns
- Video prompt is optional (defaults to image prompt + motion)
- Requires image to exist before video generation
- Same pattern as image regeneration

### Source Tree Components

**New Files:**
- `components/Storyboard/VideoPromptEditor.tsx`

**Modified Files:**
- `src/backend/api/sentences.ts` - Add regenerate-video endpoint
- `components/Storyboard/SceneInspector.tsx` - Add video tab

### References
- [Source: docs/stories/STORY-022-video-regeneration-override.md]
- [Source: docs/stories/STORY-019-image-regeneration-override.md] - Similar pattern

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
