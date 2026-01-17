# Story 8.1: Dependency Tracking

Status: ready-for-dev

## Story

As a **creator**,
I want **the system to track dependencies between assets**,
so that **changes cascade appropriately when I edit content**.

## Acceptance Criteria

1. System tracks: text → audio, text → imagePrompt → image → video
2. Sentence text change marks audio dirty
3. Sentence text change marks imagePrompt for regeneration
4. ImagePrompt change marks image dirty and video dirty
5. Image regeneration marks video dirty
6. Dirty flags visible in UI
7. "Regenerate All Dirty" option per sentence
8. Dependency chain visible in inspector

## Tasks / Subtasks

- [ ] Task 1: Define dependency rules (AC: 1)
  - [ ] 1.1: Document dependency graph
  - [ ] 1.2: Create constants for dependency rules

- [ ] Task 2: Implement text change cascade (AC: 2, 3)
  - [ ] 2.1: Modify sentence text update handler
  - [ ] 2.2: Set isAudioDirty on text change
  - [ ] 2.3: Optionally regenerate imagePrompt

- [ ] Task 3: Implement prompt change cascade (AC: 4)
  - [ ] 3.1: Set isImageDirty and isVideoDirty
  - [ ] 3.2: Trigger on imagePrompt update

- [ ] Task 4: Implement image change cascade (AC: 5)
  - [ ] 4.1: Set isVideoDirty on image regeneration

- [ ] Task 5: Add dirty indicators to UI (AC: 6, 8)
  - [ ] 5.1: Create DirtyIndicator component
  - [ ] 5.2: Show in sentence row and inspector
  - [ ] 5.3: Show dependency chain

- [ ] Task 6: Add regenerate all dirty (AC: 7)
  - [ ] 6.1: Add button to inspector
  - [ ] 6.2: Queue all dirty regenerations

- [ ] Task 7: Write tests
  - [ ] 7.1: Unit tests for cascade logic
  - [ ] 7.2: Integration tests for full chain

## Dev Notes

### Dependency Graph
```
text
  ├─→ audio (isAudioDirty)
  └─→ imagePrompt
        └─→ image (isImageDirty)
              └─→ video (isVideoDirty)
```

### Dirty Flag Fields
- `isAudioDirty`: Audio needs regeneration
- `isImageDirty`: Image needs regeneration
- `isVideoDirty`: Video needs regeneration

### Source Tree Components

**New Files:**
- `components/Storyboard/DirtyIndicator.tsx`

**Modified Files:**
- `src/backend/api/sentences.ts` - Add cascade logic
- `components/Storyboard/SceneInspector.tsx` - Show dirty indicators

### References
- [Source: docs/stories/STORY-031-dependency-tracking.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-801]

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
