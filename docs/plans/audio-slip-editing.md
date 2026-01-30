# Plan: Fix Audio Clicks + Add Slip Editing

## Status Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Video handles for slip editing | **Implemented** | New videos generate 1s longer |
| slipOffset in Scene type | **Implemented** | Defaults to 0 for backwards compatibility |
| slipOffset in video playback | **Implemented** | syncVideos respects slipOffset |
| Web Audio API fades | **Reverted** | Broke audio playback entirely |
| Breathing room gaps | **Reverted** | Caused video/audio desync |
| Slip editing UI | **Not started** | Phase 2 |

---

## Problem Analysis

**Audio Issues:**
1. **No fade in/out logic** - Audio abruptly starts/stops causing clicks
2. **No breathing room** - Audio clips are back-to-back, feels rushed

**Video Issues:**
3. **No handles for slip editing** - Videos generated to exact audio length, no flexibility
4. **Can't pick best portion** - User stuck with whatever section of generated video plays

---

## What Was Implemented

### 1. Video Handles in `generateVideo.ts`

New videos are generated 1 second longer than the audio duration (0.5s handle on each end).

```typescript
// Handle duration for slip editing (0.5s on each end = 1s total extra)
export const HANDLE_SECONDS = 0.5;

export function calculateFrameCount(
  durationMs: number | null | undefined,
  fps: number = DEFAULT_FPS,
  addHandles: boolean = true
): number {
  // ... duration calculation ...
  const baseDuration = Math.max(5, Math.min(15, durationSeconds));
  const finalDuration = addHandles ? baseDuration + (HANDLE_SECONDS * 2) : baseDuration;
  return Math.round(finalDuration * fps);
}
```

**Note:** This only affects newly generated videos. Existing videos remain unchanged.

### 2. slipOffset in Scene Type (`types.ts`)

```typescript
export interface Scene {
  // ... existing fields ...
  slipOffset?: number; // Seconds into source video to start playback (default: 0.5 = handle start)
}
```

### 3. slipOffset Support in Playback (`useTimelinePlayback.ts`)

```typescript
const syncVideos = useCallback((masterTime: number) => {
  videoRefs.current.forEach((videoEl, sceneId) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const clipStart = scene.timelineStart ?? 0;
    const trimOffset = scene.trimStart ?? 0;
    const slipOffset = scene.slipOffset ?? 0; // Default to 0 for backwards compatibility

    const localTime = masterTime - clipStart + trimOffset + slipOffset;
    // ... rest of sync logic
  });
}, [scenes, isPlaying]);
```

**Important:** Default is 0 (not 0.5) for backwards compatibility with existing videos that don't have handles.

---

## What Was Reverted

### Web Audio API Integration

**Problem:** Once an audio element is connected to `MediaElementAudioSourceNode`, audio ONLY plays through the Web Audio graph. If anything goes wrong with the GainNode or connections, audio is completely silent.

**What happened:**
- Created `useWebAudioManager.ts` hook
- Connected audio elements on registration
- Used GainNode for fades
- **Result:** Audio stopped playing entirely

**Reverted to:** Simple `HTMLAudioElement.play()/pause()` with direct `volume` property

### Breathing Room Gaps

**Problem:** Adding gaps between audio clips without matching gaps in video caused:
- Black frames during gaps (no video playing)
- Audio/video desync

**What happened:**
- Added `VOICE_CLIP_GAP_SEC = 0.1` (100ms) between voice clips
- Videos remained continuous (no gaps)
- **Result:** Visual gaps appeared, timeline positions mismatched

**Reverted to:** Audio clips start exactly when their corresponding video starts

---

## What Still Needs Implementation

### Phase 2: Slip Editing UI

In `TimelineClip.tsx`, add UI for adjusting slipOffset:

1. **Alt+drag detection** - Hold Alt and drag horizontally to slip
2. **Visual indicators** - Show available slip range (0 to 1s for new videos)
3. **Offset limits** - Clamp to available handle range
4. **Callback** - Update scene's slipOffset in parent state

```typescript
// Pseudocode for TimelineClip
const handleSlipDrag = (deltaX: number) => {
  const deltaSeconds = deltaX / pixelsPerSecond;
  const newOffset = Math.max(0, Math.min(1.0, currentSlipOffset + deltaSeconds));
  onSlipOffsetChange(scene.id, newOffset);
};
```

### Phase 3: Audio Click Prevention (Alternative Approach)

The Web Audio API approach was too complex and fragile. Alternative approaches:

**Option A: Volume fade with requestAnimationFrame**
```typescript
const fadeOut = (audioEl: HTMLAudioElement, duration: number) => {
  const startVolume = audioEl.volume;
  const startTime = performance.now();

  const tick = () => {
    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    audioEl.volume = startVolume * (1 - progress);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      audioEl.pause();
      audioEl.volume = startVolume; // Restore for next play
    }
  };

  requestAnimationFrame(tick);
};
```

**Option B: CSS-style easing on volume**
- Simpler but less precise
- May still click on very short fades

**Option C: Pre-process audio files**
- Add fades during TTS generation
- Most reliable but requires backend changes

### Phase 4: Breathing Room (Revisited)

If gaps are still desired, both video AND audio need matching gaps:

```typescript
// In routes.tsx VideoPreviewPage
const GAP_SEC = 0.1;
let timelinePosition = 0;

for (const sentence of sentences) {
  const duration = sentence.audioDuration / 1000;

  // Video clip
  scenes.push({
    ...scene,
    timelineStart: timelinePosition,
    effectiveDuration: duration,
  });

  // Audio clip (same position)
  voiceClips.push({
    ...clip,
    startTime: timelinePosition,
    duration: duration,
  });

  // Both advance by duration + gap
  timelinePosition += duration + GAP_SEC;
}
```

This creates silent gaps in both tracks, keeping them synchronized.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/backend/inngest/functions/generateVideo.ts` | Added `HANDLE_SECONDS`, updated `calculateFrameCount` |
| `types.ts` | Added `slipOffset?: number` to Scene interface |
| `components/VideoEditor/hooks/useTimelinePlayback.ts` | Added slipOffset support in syncVideos |
| `routes.tsx` | Reverted to continuous video/audio alignment |

## Files Removed

| File | Reason |
|------|--------|
| `components/VideoEditor/hooks/useWebAudioManager.ts` | Web Audio approach broke audio playback |

---

## Verification Checklist

**Currently Working:**
- [x] Videos and audio play in sync
- [x] Audio is audible (not silent)
- [x] Videos flow continuously (no gaps)
- [x] New videos generate with 1s extra duration (handles)
- [x] slipOffset field exists on Scene type
- [x] Playback respects slipOffset value

**Not Yet Working:**
- [ ] Audio fades at transitions (clicks may still occur)
- [ ] Breathing room between clips
- [ ] UI for adjusting slip offset
- [ ] Visual feedback for slip range

**Backwards Compatibility:**
- [x] Existing videos (without handles) play correctly (slipOffset defaults to 0)
- [x] Existing audio plays correctly (no Web Audio dependency)
