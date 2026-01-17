# Story 8.2: Sentence Edit Regeneration

Status: ready-for-dev

## Story

As a **creator**,
I want **assets to automatically regenerate when I edit sentence text**,
so that **my content stays in sync without manual intervention**.

## Acceptance Criteria

1. Editing sentence text triggers cascade
2. Audio marked dirty immediately
3. Option to auto-regenerate audio on text change
4. "Regenerate Audio" button appears when dirty
5. After audio regenerates, video remains dirty (different duration)
6. Batch regenerate option for all dirty audio
7. Confirmation before cascade regeneration
8. Undo option for text edits (within session)

## Tasks / Subtasks

- [ ] Task 1: Add text edit handler (AC: 1, 2)
  - [ ] 1.1: Detect sentence text changes
  - [ ] 1.2: Mark isAudioDirty
  - [ ] 1.3: Mark isVideoDirty (duration may change)

- [ ] Task 2: Add auto-regenerate option (AC: 3, 7)
  - [ ] 2.1: Add setting for auto-regeneration
  - [ ] 2.2: Show confirmation dialog
  - [ ] 2.3: Trigger audio/generate if enabled

- [ ] Task 3: Add dirty indicator and button (AC: 4)
  - [ ] 3.1: Show "Audio out of sync" indicator
  - [ ] 3.2: Add "Regenerate Audio" button

- [ ] Task 4: Handle duration change (AC: 5)
  - [ ] 4.1: Note that video may not match audio length
  - [ ] 4.2: Mark video dirty after audio regenerates

- [ ] Task 5: Add batch regeneration (AC: 6)
  - [ ] 5.1: "Regenerate All Dirty Audio" button
  - [ ] 5.2: Reuse bulk audio generation logic

- [ ] Task 6: Add undo option (AC: 8)
  - [ ] 6.1: Store previous text value
  - [ ] 6.2: Add undo button (session only)

- [ ] Task 7: Write tests
  - [ ] 7.1: Unit tests for cascade logic
  - [ ] 7.2: Integration tests for text → audio flow

## Dev Notes

### Architecture Patterns
- Debounce text changes before triggering cascade
- Confirmation prevents accidental regeneration
- Session-only undo (not persisted)

### Source Tree Components

**Modified Files:**
- `components/ScriptEditorV2/SentenceRow.tsx` - Add text edit handler
- `src/backend/api/sentences.ts` - Update cascade logic

### References
- [Source: docs/stories/STORY-032-sentence-edit-regeneration.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-804]

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
