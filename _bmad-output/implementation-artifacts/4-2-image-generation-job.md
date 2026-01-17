# Story 4.2: Image Generation Job

Status: ready-for-dev

## Story

As a **creator**,
I want **images generated via ComfyUI for each sentence**,
so that **I have professional visuals matching my script**.

## Acceptance Criteria

1. Inngest function `image/generate` handles single sentence
2. Function loads ComfyUI workflow from `workflows/image/flux-2.json`
3. Workflow parameters injected: prompt, seed, aspect ratio
4. Character reference images injected if available
5. Style LoRA applied from character or project settings
6. Output is 16:9 aspect ratio (1920x1080)
7. PNG file stored at `data/projects/{projectId}/images/{sentenceId}.png`
8. Sentence `imageFile` field updated with file path
9. Sentence `isImageDirty` flag cleared on success
10. Progress polling via ComfyUI WebSocket API
11. Progress updates broadcast to frontend
12. Retry on failure (max 3 attempts)
13. Concurrency limit: 1 (GPU-bound)

## Tasks / Subtasks

- [ ] Task 1: Extend ComfyUI client for image generation (AC: 2, 3, 10)
  - [ ] 1.1: Add `generateImage` method to ComfyUIClient
  - [ ] 1.2: Implement workflow loading and parameter injection
  - [ ] 1.3: Implement WebSocket completion polling
  - [ ] 1.4: Implement result download

- [ ] Task 2: Create image generation Inngest function (AC: 1, 11, 12, 13)
  - [ ] 2.1: Create `src/backend/inngest/functions/generateImage.ts`
  - [ ] 2.2: Add `image/generate` event type
  - [ ] 2.3: Configure concurrency limit of 1
  - [ ] 2.4: Implement retry with exponential backoff

- [ ] Task 3: Implement file storage (AC: 7, 8, 9)
  - [ ] 3.1: Add `getImagePath` to outputPaths service
  - [ ] 3.2: Update sentence record with imageFile
  - [ ] 3.3: Clear isImageDirty flag on success

- [ ] Task 4: Create workflow file (AC: 2, 4, 5, 6)
  - [ ] 4.1: Create `workflows/image/flux-2.json`
  - [ ] 4.2: Configure for 16:9 output
  - [ ] 4.3: Add LoRA loader node
  - [ ] 4.4: Add IPAdapter for character refs (optional)

- [ ] Task 5: Write tests
  - [ ] 5.1: Unit tests for workflow parameter injection
  - [ ] 5.2: Unit tests for ComfyUI API calls (mocked)
  - [ ] 5.3: Integration tests (requires ComfyUI)

## Dev Notes

### Architecture Patterns
- GPU-bound: concurrency limit of 1
- WebSocket polling for ComfyUI progress
- Workflow JSON defines the generation pipeline

### Source Tree Components

**New Files:**
- `src/backend/inngest/functions/generateImage.ts`
- `workflows/image/flux-2.json`

**Modified Files:**
- `src/backend/clients/comfyui.ts` - Add image generation methods
- `src/backend/inngest/client.ts` - Add image/generate event
- `src/backend/inngest/functions/index.ts` - Export new function

### References
- [Source: docs/stories/STORY-018-image-generation-job.md]
- [Source: src/backend/clients/comfyui.ts] - Existing ComfyUI client
- [Source: docs/architecture-videogen-ai-studio-2026-01-17.md] - ComfyUI integration

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
