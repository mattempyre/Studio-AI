# Video Editor Timeline Enhancement Plan

## Overview

Build a full-featured video editor timeline that allows users to:
- Play and scrub through all generated videos/audio in sync
- Trim videos from each end
- Drag-drop clips to reorder
- Zoom in/out for precision editing
- Export final video using Remotion

## Approach

- **Remotion:** Export only (for final video rendering to MP4)
- **Editing UI:** Enhance existing VideoPreview.tsx
- **Priority:** All core features (trimming, drag-drop, zoom)

---

## Current State

The existing `VideoPreview.tsx` has a solid foundation:
- Timeline with playback controls (play/pause, scrub)
- Multi-track audio visualization (voice, music, SFX)
- Video track showing scene thumbnails
- Text overlay system
- Resizable timeline panel
- Playhead indicator

**Missing features we need to add:**
- Video trimming (button exists, no implementation)
- Synchronized video/audio playback (videos play independently)
- Drag-and-drop clip repositioning
- Clip splitting
- Zoom controls
- Waveform visualization

---

## Implementation Phases

### Phase 1: Data Model & State Setup
**Files:** `types.ts`, `components/VideoPreview.tsx`

**Tasks:**
- [ ] Add timeline-specific fields to Scene type:
  ```typescript
  timelineStart: number;  // position on timeline (seconds)
  effectiveDuration: number;  // duration after trims
  ```
- [ ] Add VideoEditor state:
  - `zoomLevel` (pixels per second)
  - `selectedClipId` for active selection
  - `isDragging` for drag operations
- [ ] Create refs for all video elements to control playback

---

### Phase 2: Video Trimming
**Files:** `components/VideoPreview.tsx`

**Tasks:**
- [ ] Add trim handles to clip edges (left/right drag handles)
- [ ] Implement `handleTrimStart` / `handleTrimEnd` drag handlers
- [ ] Update Scene `trimStart`/`trimEnd` on drag
- [ ] Visual feedback: grayed-out trimmed portions, handle hover states
- [ ] Apply trims to video playback (set `currentTime` offset)

**UI Design:**
```
┌─────────────────────────────────────────┐
│ ◄│                CLIP                │► │  ◄ Trim handles
└─────────────────────────────────────────┘
   │←── trimmed ──→│← visible content →│←─ trimmed ─→│
```

---

### Phase 3: Synchronized Playback
**Files:** `components/VideoPreview.tsx`

**Tasks:**
- [ ] Create `useTimelinePlayback` hook:
  - Master time state
  - Sync all video elements via refs
  - Handle audio elements
- [ ] Calculate which clip is active at current time
- [ ] Seek videos to correct position (accounting for trims)
- [ ] Play/pause all media together

**Logic:**
```typescript
// For each video element:
const clipStart = scene.timelineStart;
const trimOffset = scene.trimStart || 0;
const localTime = masterTime - clipStart + trimOffset;

if (localTime >= 0 && localTime < effectiveDuration) {
  videoRef.currentTime = localTime;
  videoRef.play();
} else {
  videoRef.pause();
}
```

---

### Phase 4: Drag-Drop Reordering
**Files:** `components/VideoPreview.tsx`

**Tasks:**
- [ ] Add `draggable` attribute to clip elements
- [ ] Implement `onDragStart`, `onDragOver`, `onDrop` handlers
- [ ] Show drop indicator between clips
- [ ] Reorder scenes array on drop
- [ ] Recalculate `timelineStart` for all clips

**Drop Indicator:**
```
[Clip A] | [Clip B] [Clip C]
         ↑
    drop indicator (blue line)
```

---

### Phase 5: Zoom & Timeline Controls
**Files:** `components/VideoPreview.tsx`

**Tasks:**
- [ ] Add zoom slider (100% = 100px/second, range 25%-400%)
- [ ] Render time ruler with tick marks (adapts to zoom)
- [ ] Add keyboard shortcuts:
  - `Space` = play/pause
  - `J/K/L` = shuttle (reverse/pause/forward)
  - `[/]` = set in/out points
  - `←/→` = frame step
- [ ] Implement snap-to-grid and snap-to-clip

**Time Ruler:**
```
|    |    |    |    |    |    |    |    |
0:00 0:05 0:10 0:15 0:20 0:25 0:30 0:35
```

---

### Phase 6: Remotion Export Integration
**Files:** New `src/remotion/` folder

**Tasks:**
- [ ] Install Remotion: `npm install remotion @remotion/cli @remotion/renderer`
- [ ] Create `RemotionComposition.tsx`:
  - Map project scenes to Remotion sequences
  - Apply trim values via `startFrom`/`endAt`
  - Include audio tracks
- [ ] Create export API endpoint
- [ ] Add "Export Video" button that triggers Remotion render

**Remotion Structure:**
```typescript
// src/remotion/Composition.tsx
export const VideoComposition: React.FC<{project: Project}> = ({project}) => {
  return (
    <>
      {project.scenes.map((scene, i) => (
        <Sequence
          key={scene.id}
          from={scene.timelineStart * fps}
          durationInFrames={(scene.effectiveDuration) * fps}
        >
          <Html5Video
            src={scene.videoUrl}
            startFrom={(scene.trimStart || 0) * fps}
          />
        </Sequence>
      ))}
    </>
  );
};
```

---

## Key Files to Modify

| File | Changes |
|------|---------|
| `types.ts` | Add `timelineStart`, `effectiveDuration` to Scene |
| `components/VideoPreview.tsx` | Main editor enhancements (trim, drag, zoom) |
| `routes.tsx` | Pass updated project to backend on changes |
| `src/remotion/Composition.tsx` | New - Remotion export composition |
| `src/backend/api/export.ts` | New - Export API endpoint |

---

## Component Structure (Optional Refactor)

If VideoPreview gets too large (>300 lines), refactor into:

```
components/
  VideoEditor/
    VideoEditor.tsx          # Main component
    Timeline.tsx             # Timeline tracks container
    TimelineClip.tsx         # Individual clip with trim handles
    TimeRuler.tsx            # Time ruler with ticks
    PlaybackControls.tsx     # Play/pause, shuttle controls
    ZoomControls.tsx         # Zoom slider
    hooks/
      useTimelinePlayback.ts # Playback sync logic
      useDragDrop.ts         # Drag-drop logic
      useKeyboardShortcuts.ts
```

---

## Data Model Updates

```typescript
// types.ts additions

interface Scene {
  // existing fields...
  id: string;
  narration: string;
  imageUrl?: string;
  videoUrl?: string;
  trimStart?: number;     // seconds trimmed from start
  trimEnd?: number;       // seconds trimmed from end

  // NEW fields for timeline
  timelineStart?: number;     // position on timeline (seconds)
  effectiveDuration?: number; // calculated: videoDuration - trimStart - trimEnd
}

// For zoom state
interface TimelineState {
  zoomLevel: number;      // pixels per second (default 100)
  scrollOffset: number;   // horizontal scroll position
  selectedClipId: string | null;
}
```

---

## Verification Plan

### Manual Testing
- [ ] Create project with multiple scenes/videos
- [ ] Test trimming from both ends (left and right handles)
- [ ] Verify playback respects trims
- [ ] Test drag-drop reordering
- [ ] Check zoom behavior at different levels
- [ ] Test keyboard shortcuts
- [ ] Export video and verify output

### Edge Cases
- [ ] Empty project (no scenes)
- [ ] Single scene project
- [ ] Very long videos (>5 minutes)
- [ ] Missing audio tracks
- [ ] Clips with no video (image only)

---

## Open Source References

These projects provide inspiration and potential code patterns:

| Library | URL | Features |
|---------|-----|----------|
| react-timeline-editor | https://github.com/xzdarcy/react-timeline-editor | Timeline drag-drop |
| Twick | https://github.com/ncounterspecialist/twick | Full editor SDK |
| DesignCombo | https://github.com/designcombo/react-video-editor | CapCut-like editor |
| Remotion | https://remotion.dev | Video rendering |

---

## Notes

- Scene type already has `trimStart`/`trimEnd` defined - just need to implement UI
- VideoPreview already has `requestAnimationFrame` playback loop - extend it
- Audio track clips already have `startTime`/`duration` - same pattern for video
- Use `useRef` for video elements to avoid stale closure issues
