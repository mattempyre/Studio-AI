# Story 3.3: Bulk Audio Generation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **creator**,
I want **to generate audio for all sentences at once**,
so that **I can proceed efficiently without clicking each one individually**.

## Acceptance Criteria

1. "Generate All Audio" button visible in script editor toolbar
2. Button disabled when all sentences already have audio (not dirty)
3. Clicking button queues `audio/generate` events for all dirty sentences
4. Progress shows: "Generating... (5/24)" with live updates
5. Progress bar shows percentage completion visually
6. Each sentence row shows generation status icon:
   - Pending (in queue) - clock icon
   - Generating (in progress) - spinner
   - Complete (has audio) - checkmark
   - Failed (error) - X icon
7. Completed sentences show play button for inline audio playback
8. Multiple audio plays stop the previous audio before playing new
9. "Cancel" button stops remaining queued jobs
10. Cancel does not remove already-generated audio
11. WebSocket updates drive all status changes in real-time
12. On completion, show success toast with count
13. Failed sentences show retry option

## Tasks / Subtasks

- [ ] Task 1: Create bulk audio generation API endpoint (AC: 3, 9, 10)
  - [ ] 1.1: Add `POST /api/v1/projects/:id/generate-audio` endpoint
  - [ ] 1.2: Query dirty sentences from project
  - [ ] 1.3: Queue `audio/generate` events via Inngest
  - [ ] 1.4: Add `POST /api/v1/projects/:id/cancel-audio` endpoint
  - [ ] 1.5: Update job status to 'cancelled' for queued jobs

- [ ] Task 2: Create useAudioGeneration hook (AC: 4, 5, 11)
  - [ ] 2.1: Create `hooks/useAudioGeneration.ts`
  - [ ] 2.2: Integrate with useWebSocket for progress updates
  - [ ] 2.3: Track generation state (isGenerating, progress, sentenceStatuses)
  - [ ] 2.4: Implement startGeneration function
  - [ ] 2.5: Implement cancelGeneration function

- [ ] Task 3: Create AudioToolbar component (AC: 1, 2, 4, 5, 9, 12)
  - [ ] 3.1: Create `components/ScriptEditorV2/AudioToolbar.tsx`
  - [ ] 3.2: Display "Generate All Audio" button with count
  - [ ] 3.3: Show progress bar during generation
  - [ ] 3.4: Show cancel button during generation
  - [ ] 3.5: Display completion toast

- [ ] Task 4: Create SentenceAudioStatus component (AC: 6, 7, 8, 13)
  - [ ] 4.1: Create `components/ScriptEditorV2/SentenceAudioStatus.tsx`
  - [ ] 4.2: Show status icons (pending/generating/complete/failed)
  - [ ] 4.3: Add play/stop button for audio playback
  - [ ] 4.4: Stop other playing audio when new one starts
  - [ ] 4.5: Show duration for completed audio
  - [ ] 4.6: Add retry button for failed sentences

- [ ] Task 5: Integrate into ScriptEditorV2 (AC: all)
  - [ ] 5.1: Add AudioToolbar to Header or below it
  - [ ] 5.2: Add SentenceAudioStatus to SentenceRow
  - [ ] 5.3: Pass WebSocket events through to components
  - [ ] 5.4: Test full flow with real Inngest/Chatterbox

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for useAudioGeneration hook
  - [ ] 6.2: Unit tests for AudioToolbar component
  - [ ] 6.3: Unit tests for SentenceAudioStatus component
  - [ ] 6.4: Integration test for bulk generation API
  - [ ] 6.5: E2E test for full generation flow (optional)

## Dev Notes

### Architecture Patterns

- **Hook-based state management**: Use custom hooks for generation state (similar to existing `useWebSocket`, `useCharacters` patterns)
- **WebSocket-driven updates**: All progress updates come via WebSocket, not polling
- **Inngest job queue**: Leverages existing audio/generate event type with concurrency limit of 4
- **Component composition**: Small, focused components (AudioToolbar, SentenceAudioStatus) composed into ScriptEditorV2

### Source Tree Components to Touch

**New Files:**
- `hooks/useAudioGeneration.ts` - Generation state management hook
- `components/ScriptEditorV2/AudioToolbar.tsx` - Bulk generation controls
- `components/ScriptEditorV2/SentenceAudioStatus.tsx` - Per-sentence status display

**Modified Files:**
- `src/backend/api/projects.ts` - Add generate-audio and cancel-audio endpoints
- `components/ScriptEditorV2/Header.tsx` - Add AudioToolbar
- `components/ScriptEditorV2/SentenceRow.tsx` - Add SentenceAudioStatus

### Testing Standards

- Unit tests for hooks using React Testing Library
- Component tests with mocked WebSocket events
- API integration tests using supertest
- Minimum 80% coverage for new code

### Project Structure Notes

- Follows existing pattern: hooks in `/hooks/`, components in feature folders
- API endpoints follow REST conventions in `src/backend/api/`
- WebSocket event types already defined in `hooks/useWebSocket.ts`
- Inngest event type `audio/generate` already exists from STORY-014

### References

- [Source: docs/stories/STORY-016-bulk-audio-generation.md] - Original detailed story
- [Source: docs/stories/STORY-014-audio-generation-job.md] - Audio generation implementation
- [Source: hooks/useWebSocket.ts] - WebSocket hook patterns
- [Source: src/backend/inngest/functions/generateAudio.ts] - Existing audio generation function
- [Source: components/ScriptEditorV2/Header.tsx] - Where to integrate AudioToolbar

## UX/UI Considerations

### User Flow & Mental Model
Picture Maya, a creator with a 45-sentence script. She's excited about her video but dreads clicking "generate" 45 times. The bulk generation feature should feel like pressing "bake" on an oven — one action, clear progress, confidence it's working.

### Visual Hierarchy & Token Usage

**AudioToolbar Component:**
- Use `surface-2` background with `border-color` border for the toolbar container
- "Generate All Audio" button: `bg-primary` with `primary-hover` on hover
- Disabled state: reduce to `bg-primary-muted` with `cursor-not-allowed`
- Progress text "Generating... (5/24)": `text-secondary` for the label, actual count in `text-primary`
- Progress bar track: `bg-surface-3`, filled portion: `bg-primary` with subtle `shadow-glow-sm`
- Cancel button: `border-border-color` with `text-error` on hover

**SentenceAudioStatus Icons:**
| State | Icon | Token | Animation |
|-------|------|-------|-----------|
| Pending (queued) | Clock | `text-muted` | None |
| Generating | Spinner | `text-info` | `animate-spin` |
| Complete | Checkmark | `text-success` | Subtle scale-in |
| Failed | X circle | `text-error` | None |

### Interaction Patterns

1. **Optimistic Feedback:** Button should immediately change to "Generating..." state — don't wait for server confirmation
2. **Graceful Degradation:** If WebSocket disconnects, fall back to polling with a subtle "reconnecting..." indicator
3. **Audio Playback Exclusivity:** When user clicks play on sentence B while A is playing, A fades out (200ms) before B starts — no jarring cut
4. **Retry Affordance:** Failed sentences show a small retry icon that glows `primary` on hover — easy to spot, easy to click

### Accessibility Considerations
- Progress bar needs `aria-valuenow`, `aria-valuemin`, `aria-valuemax` attributes
- Status icons need `aria-label` (e.g., "Audio generation in progress")
- Toast notifications should use `role="alert"` for screen reader announcement
- Play/stop buttons need distinct `aria-pressed` states

### Responsive Behavior
- On narrow viewports (<640px): Collapse progress bar to percentage text only
- AudioToolbar stacks vertically on mobile with full-width buttons

### Edge Cases to Handle Gracefully
- **All sentences already have audio:** Button disabled with helpful tooltip "All audio is up to date"
- **Mixed states after cancel:** Show summary toast "Generated 15 of 24 — 9 remaining"
- **Rapid clicking:** Debounce button clicks (300ms) to prevent duplicate requests

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

(To be filled during implementation)

### Completion Notes List

(To be filled upon completion)

### File List

(To be filled with all files created/modified)
