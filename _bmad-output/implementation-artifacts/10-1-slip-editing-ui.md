# Story 10.1: Slip Editing UI for Video Timeline

Status: done

## Story

As a video editor,
I want to adjust the slip offset of video clips using Alt+drag,
so that I can choose the best portion of a generated video to display during playback.

## Background Context

Videos are now generated with 1 second of extra duration (0.5s handles on each end) to allow slip editing. The `slipOffset` field already exists on the `Scene` type and playback already respects this value. What's missing is the UI to let users adjust this offset.

**Current State (from [audio-slip-editing.md](docs/plans/audio-slip-editing.md)):**
- Video handles: **Implemented** - New videos generate 1s longer
- slipOffset in Scene type: **Implemented** - Defaults to 0
- slipOffset in playback: **Implemented** - syncVideos respects slipOffset
- Slip editing UI: **Implemented** - This story

## Acceptance Criteria

1. When user holds Alt and drags horizontally on a video clip, the slip offset adjusts
2. Visual indicator shows the current slip position within available handle range
3. Slip offset is clamped to valid range (0 to 1.0 seconds for videos with handles)
4. Existing videos without handles (slipOffset 0) show indicator that slip is unavailable
5. Changes persist to scene state via callback to parent component
6. Slip dragging does not conflict with trim handles or clip dragging

## Tasks / Subtasks

- [x] Task 1: Add slip editing state and event handlers to TimelineClip (AC: #1, #6)
  - [x] 1.1 Add `isSlipping` state to track Alt+drag operation
  - [x] 1.2 Detect Alt key press during mousedown on clip body (not trim handles)
  - [x] 1.3 Create `handleSlipMouseDown` handler that captures initial position
  - [x] 1.4 Calculate delta in seconds from pixel movement using pixelsPerSecond
  - [x] 1.5 Ensure slip drag doesn't trigger when clicking trim handles

- [x] Task 2: Add slip offset clamping logic (AC: #3, #4)
  - [x] 2.1 Determine max slip range from video duration vs effective duration
  - [x] 2.2 For videos with handles: clamp between 0 and 1.0 seconds
  - [x] 2.3 For legacy videos without handles: disable slip (range = 0)
  - [x] 2.4 Calculate available slip based on `HANDLE_SECONDS * 2` constant

- [x] Task 3: Add onSlipOffsetChange callback prop (AC: #5)
  - [x] 3.1 Add `onSlipOffsetChange?: (sceneId: string, offset: number) => void` to TimelineClipProps
  - [x] 3.2 Wire callback in parent component (VideoTimeline or VideoEditor)
  - [x] 3.3 Update scene state when slip offset changes

- [x] Task 4: Add visual slip indicator UI (AC: #2, #4)
  - [x] 4.1 Show slip range indicator when Alt key is held
  - [x] 4.2 Display current slip position within the range (e.g., colored bar or marker)
  - [x] 4.3 Show "No slip available" indicator for legacy videos
  - [x] 4.4 Change cursor to indicate slip mode (e.g., `cursor-move` or custom)

- [x] Task 5: Update types and wire to parent (AC: #1, #5)
  - [x] 5.1 Update TimelineClipProps interface in types.ts
  - [x] 5.2 Pass onSlipOffsetChange from VideoTimeline to TimelineClip
  - [x] 5.3 Implement scene update in parent state management

## Dev Notes

### Slip Editing Concept

Slip editing adjusts which portion of a longer source video plays during a fixed timeline window. Unlike trimming (which changes the clip's duration on timeline), slip editing slides the source content within a fixed-duration window.

```
Source video with handles:
[0.5s handle][--- visible content ---][0.5s handle]
              ^ slipOffset=0 starts here

After slip of +0.3s:
[0.5s handle][--- visible content ---][0.5s handle]
                   ^ slipOffset=0.3 starts here
```

### Key Implementation Pattern

From the plan document ([docs/plans/audio-slip-editing.md](docs/plans/audio-slip-editing.md)):

```typescript
// Pseudocode for TimelineClip
const handleSlipDrag = (deltaX: number) => {
  const deltaSeconds = deltaX / pixelsPerSecond;
  const newOffset = Math.max(0, Math.min(1.0, currentSlipOffset + deltaSeconds));
  onSlipOffsetChange(scene.id, newOffset);
};
```

### Existing Infrastructure

**Scene type already has slipOffset** ([types.ts:196](types.ts#L196)):
```typescript
slipOffset?: number; // Seconds into source video to start playback (default: 0.5 = handle start)
```

**Playback already uses slipOffset** ([useTimelinePlayback.ts:87](components/VideoEditor/hooks/useTimelinePlayback.ts#L87)):
```typescript
const slipOffset = scene.slipOffset ?? 0; // Default to 0 for backwards compatibility
const localTime = masterTime - clipStart + trimOffset + slipOffset;
```

**HANDLE_SECONDS constant** ([generateVideo.ts](src/backend/inngest/functions/generateVideo.ts)):
```typescript
export const HANDLE_SECONDS = 0.5;
```

### Alt Key Detection Pattern

Use `e.altKey` on mousedown to detect if Alt is held:

```typescript
const handleMouseDown = (e: React.MouseEvent) => {
  if (e.altKey) {
    // Enter slip mode
    handleSlipMouseDown(e);
  } else if (!isTrimming) {
    // Normal drag behavior
  }
};
```

### Files to Modify

| File | Changes |
|------|---------|
| `components/VideoEditor/TimelineClip.tsx` | Add slip editing logic, visual indicator |
| `components/VideoEditor/types.ts` | Add onSlipOffsetChange to TimelineClipProps |
| `components/VideoEditor/Timeline.tsx` | Pass slip callback, handle state update |

### Project Structure Notes

- Component follows existing patterns in VideoEditor folder
- State flows from VideoEditor -> Timeline -> TimelineClip
- Callbacks bubble up scene changes to parent

### Testing Approach

1. Manual test: Hold Alt and drag on a video clip
2. Verify slip offset updates in React DevTools
3. Verify playback starts from new position
4. Test clamping at boundaries (0 and 1.0s)
5. Test legacy videos show "no slip available"

### References

- [Source: docs/plans/audio-slip-editing.md#Phase-2-Slip-Editing-UI](docs/plans/audio-slip-editing.md)
- [Source: types.ts#Scene](types.ts#L178)
- [Source: components/VideoEditor/hooks/useTimelinePlayback.ts#syncVideos](components/VideoEditor/hooks/useTimelinePlayback.ts#L80)
- [Source: components/VideoEditor/TimelineClip.tsx](components/VideoEditor/TimelineClip.tsx)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (BMAD code-review workflow)

### Debug Log References

- Code review identified feature was NOT implemented despite commit message claiming otherwise
- All slip editing UI implemented from scratch during code review fix phase

### Completion Notes List

- Added `isSlipping` and `isAltHeld` state to TimelineClip for tracking slip operations
- Implemented `handleSlipMouseDown` with proper mouse capture and cleanup
- Added slip offset clamping (0 to MAX_SLIP_RANGE = 1.0s based on HANDLE_SECONDS * 2)
- Visual slip indicator shows yellow progress bar when Alt key is held
- "No slip handles" indicator displayed for legacy videos without handle space
- Cursor changes to `cursor-move` in slip mode
- Added `onSlipOffsetChange` callback to both TimelineClipProps and TimelineProps interfaces
- Wired callback through Timeline component to VideoEditor
- Implemented `handleSlipOffsetChange` in VideoEditor to update scene state
- Yellow border indicator shows when actively slipping
- Alt key tracking via global keydown/keyup event listeners
- Slip drag disabled on trim handles via existing event handling

### File List

| File | Action | Description |
|------|--------|-------------|
| `components/VideoEditor/types.ts` | Modified | Added `onSlipOffsetChange` to TimelineClipProps and TimelineProps interfaces |
| `components/VideoEditor/TimelineClip.tsx` | Rewritten | Full slip editing implementation with state, handlers, visual indicators |
| `components/VideoEditor/Timeline.tsx` | Modified | Accept and pass onSlipOffsetChange prop to TimelineClip |
| `components/VideoEditor/VideoEditor.tsx` | Modified | Added handleSlipOffsetChange callback and wired to Timeline |
