# Story 5.1: Video Generation Job

Status: ready-for-dev

## Story

As a **creator**,
I want **images converted to video clips with motion**,
so that **my content has dynamic visual movement**.

## Acceptance Criteria

1. Inngest function `video/generate` handles single sentence
2. Function requires existing imageFile on sentence
3. Loads workflow from `workflows/video/wan-2.2.json`
4. Source image injected into workflow
5. Camera movement parameter applied (static, pan_left, pan_right, zoom_in, zoom_out, orbit, truck)
6. Motion strength (0.0-1.0) controls movement intensity
7. Output is MP4 video file
8. Video duration approximately matches audio duration (or default 5 seconds)
9. MP4 stored at `data/projects/{projectId}/videos/{sentenceId}.mp4`
10. Sentence `videoFile` field updated
11. Sentence `isVideoDirty` flag cleared
12. Concurrency limit: 1 (GPU-bound)
13. Progress updates broadcast via WebSocket
14. Retry on failure (max 3 attempts)

## Tasks / Subtasks

- [ ] Task 1: Extend ComfyUI client for video generation (AC: 3, 4)
  - [ ] 1.1: Add `generateVideo` method to ComfyUIClient
  - [ ] 1.2: Implement image upload to ComfyUI
  - [ ] 1.3: Implement video workflow parameter injection
  - [ ] 1.4: Implement video result download (MP4/GIF)

- [ ] Task 2: Create camera movement mapping (AC: 5, 6)
  - [ ] 2.1: Define CAMERA_MOVEMENTS constants
  - [ ] 2.2: Create getCameraParams function
  - [ ] 2.3: Scale by motion strength

- [ ] Task 3: Create video generation Inngest function (AC: 1, 12, 13, 14)
  - [ ] 3.1: Create `src/backend/inngest/functions/generateVideo.ts`
  - [ ] 3.2: Add `video/generate` event type
  - [ ] 3.3: Configure concurrency limit of 1
  - [ ] 3.4: Implement retry with exponential backoff (60s base)

- [ ] Task 4: Implement duration matching (AC: 7, 8)
  - [ ] 4.1: Read audioDuration from sentence
  - [ ] 4.2: Calculate frame count for target duration
  - [ ] 4.3: Default to 5 seconds if no audio

- [ ] Task 5: Create workflow file (AC: 3)
  - [ ] 5.1: Create `workflows/video/wan-2.2.json`
  - [ ] 5.2: Configure LoadImage node
  - [ ] 5.3: Configure camera motion nodes
  - [ ] 5.4: Configure video encoder output

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for camera movement mapping
  - [ ] 6.2: Unit tests for duration calculation
  - [ ] 6.3: Integration tests (requires ComfyUI)

## Dev Notes

### Architecture Patterns
- GPU-bound: concurrency limit of 1
- Longer processing than images (30-120 seconds)
- Video duration matches audio for lip-sync

### Source Tree Components

**New Files:**
- `src/backend/inngest/functions/generateVideo.ts`
- `workflows/video/wan-2.2.json`

**Modified Files:**
- `src/backend/clients/comfyui.ts` - Add video generation methods
- `src/backend/inngest/client.ts` - Add video/generate event
- `src/backend/inngest/functions/index.ts` - Export new function

### References
- [Source: docs/stories/STORY-020-video-generation-job.md]
- [Source: src/backend/clients/comfyui.ts] - Existing ComfyUI client

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
