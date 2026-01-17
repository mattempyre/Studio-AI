# Story 8.3: Prompt Edit Regeneration

Status: ready-for-dev

## Story

As a **creator**,
I want **image and video to regenerate when I edit prompts**,
so that **my visuals match my updated creative direction**.

## Acceptance Criteria

1. Editing imagePrompt marks image dirty and video dirty
2. Editing videoPrompt marks only video dirty
3. Dirty indicators appear in inspector
4. "Regenerate" buttons enabled when dirty
5. Regenerating image automatically queues video regeneration
6. Option to skip video regeneration after image
7. Progress shows cascading regeneration
8. Cancel stops remaining cascade

## Tasks / Subtasks

- [ ] Task 1: Implement imagePrompt cascade (AC: 1, 5)
  - [ ] 1.1: Mark isImageDirty on prompt change
  - [ ] 1.2: Mark isVideoDirty on prompt change
  - [ ] 1.3: Auto-queue video after image completes

- [ ] Task 2: Implement videoPrompt cascade (AC: 2)
  - [ ] 2.1: Mark isVideoDirty on prompt change
  - [ ] 2.2: Only video regeneration needed

- [ ] Task 3: Add skip video option (AC: 6)
  - [ ] 3.1: Checkbox in regenerate dialog
  - [ ] 3.2: Skip video queue if checked

- [ ] Task 4: Update progress UI (AC: 7)
  - [ ] 4.1: Show "Image → Video" cascade progress
  - [ ] 4.2: Indicate current step

- [ ] Task 5: Add cancel handling (AC: 8)
  - [ ] 5.1: Cancel image also cancels pending video
  - [ ] 5.2: Update UI on cancel

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for cascade logic
  - [ ] 6.2: Integration tests for image → video flow

## Dev Notes

### Cascade Flow
```
imagePrompt change
  → isImageDirty = true
  → isVideoDirty = true
  → User clicks "Regenerate Image"
  → Image completes
  → System auto-queues video/generate
  → Video completes
```

### Source Tree Components

**Modified Files:**
- `src/backend/api/sentences.ts` - Add cascade logic
- `components/Storyboard/SceneInspector.tsx` - Add cascade UI
- `src/backend/inngest/functions/generateImage.ts` - Queue video after

### References
- [Source: docs/stories/STORY-033-prompt-edit-regeneration.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-805]

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
