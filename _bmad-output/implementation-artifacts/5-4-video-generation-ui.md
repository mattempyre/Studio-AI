# Story 5.4: Video Generation UI

Status: ready-for-dev

## Story

As a **creator**,
I want **UI controls to edit video prompts and generate videos individually or in bulk**,
so that **I can generate videos after reviewing images and have creative control over motion**.

## Acceptance Criteria

### Video Prompt Editing (Scene Inspector)
1. Video prompt editable in scene inspector video tab
2. Prompt changes auto-save with debounce
3. Editing prompt sets `isVideoDirty: true` on sentence

### Individual Video Generation (Scene Inspector)
4. "Generate Video" button in Scene Inspector's video tab
5. Button disabled if selected sentence has no imageFile
6. Button disabled during active generation for that sentence
7. Click triggers `video/generate` Inngest event for single sentence (NOT Gemini API)
8. Loading spinner/progress shown during generation
9. Generated video preview updates immediately after completion
10. Error state shows with retry option
11. New video does NOT delete old video (preserve for future history feature)

### Bulk Video Generation (Storyboard Header)
12. "Generate All Videos" button visible in Storyboard header toolbar
13. Button only appears when project has at least one sentence with imageFile
14. Button positioned next to existing "Generate All Images" / "Re-Generate Images" button
15. Click triggers bulk video generation via `POST /api/v1/projects/:id/generate-videos`
16. Progress indicator shows during bulk generation: "Generating... (X/Y)"
17. Cancel button available during generation
18. Completion notification displayed (success or with failures)
19. Only queues videos for sentences that have:
    - imageFile exists (source image required)
    - videoPrompt exists (motion description required)
20. "Re-Generate Videos" option available when videos already exist

### WebSocket Integration
21. Real-time progress updates via existing WebSocket connection
22. Video completion events update UI immediately

## Tasks / Subtasks

- [ ] Task 1: Add video prompt editing (AC: 1-3)
  - [ ] 1.1: Video prompt textarea already exists in Storyboard.tsx video tab
  - [ ] 1.2: Add debounced auto-save for videoPrompt field
  - [ ] 1.3: Update sentence API to set isVideoDirty on videoPrompt change

- [ ] Task 2: Fix individual video generation connection (AC: 4-11)
  - [ ] 2.1: Remove `generateVideo` import from geminiService in Storyboard.tsx
  - [ ] 2.2: Create `POST /api/v1/sentences/:id/generate-video` endpoint in sentences.ts
  - [ ] 2.3: Update `handleGenerateVideo` to call backend API instead of Gemini
  - [ ] 2.4: Add job polling for video completion (similar to image regeneration)
  - [ ] 2.5: Add WebSocket listener for video completion events
  - [ ] 2.6: Video file naming should include timestamp to preserve history

- [ ] Task 3: Add bulk video generation button to toolbar (AC: 12-14, 20)
  - [ ] 3.1: Add state for video generation in BulkGenerationToolbar
  - [ ] 3.2: Add "Generate All Videos" button conditionally rendered when images exist
  - [ ] 3.3: Add "Re-Generate Videos" variant when videos already exist
  - [ ] 3.4: Position next to existing image generation buttons

- [ ] Task 4: Implement bulk video generation logic (AC: 15-19)
  - [ ] 4.1: Add `generateAllVideos` function to useSceneGeneration hook
  - [ ] 4.2: Call `POST /api/v1/projects/:id/generate-videos` endpoint
  - [ ] 4.3: Track video generation progress separately from images
  - [ ] 4.4: Implement cancel functionality
  - [ ] 4.5: Display completion notification

- [ ] Task 5: Add video-specific stats to hook (AC: 13, 19)
  - [ ] 5.1: Add `videoEligibleCount` to sceneStats (sentences with imageFile + videoPrompt)
  - [ ] 5.2: Add `existingVideoCount` to sceneStats
  - [ ] 5.3: Update `hasExistingContent` to include video state

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for individual video generation endpoint
  - [ ] 6.2: Unit tests for bulk video button visibility logic
  - [ ] 6.3: Unit tests for video prompt auto-save with dirty flag

## Dev Notes

### Architecture Patterns
- Video generation requires images to exist first (workflow: images -> review -> videos)
- Uses same WebSocket broadcast pattern as image generation
- Bulk endpoint already exists: `POST /api/v1/projects/:id/generate-videos`
- Individual generation queues `video/generate` Inngest event
- **Video History**: Old videos are NOT deleted - use timestamped filenames to preserve generations for future history feature

### Video File Naming for History
Instead of overwriting `{sentenceId}.mp4`, use timestamped names:
```
{sentenceId}_{timestamp}.mp4
```
The `videoFile` field on sentence points to the latest generation.

### Current Bug to Fix

The `handleGenerateVideo` function in `Storyboard.tsx` (lines 197-215) incorrectly calls:
```typescript
import { generateVideo } from '../services/geminiService';
// ...
const videoUrl = await generateVideo(prompt);
```

This should call the backend API endpoint which queues an Inngest event:
```typescript
const response = await fetch(`${API_BASE}/api/v1/sentences/${sceneId}/generate-video`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt }),
});
```

### Existing Backend Support

The following already exists from Story 5-1:
- `POST /api/v1/projects/:id/generate-videos` - Bulk endpoint (in projects.ts)
- `video/generate` Inngest event type
- `generateVideoFunction` Inngest handler
- WebSocket broadcasting via jobService

### Existing UI Elements

The video tab in Scene Inspector already has:
- Video prompt textarea (lines 670-678 in Storyboard.tsx)
- Camera movement dropdown (lines 682-699)
- Motion strength slider (lines 701-704)
- Generate Video button (lines 706-713)

These just need to be wired to the backend properly.

### Source Tree Components

**Modified Files:**
- `components/Storyboard.tsx` - Fix handleGenerateVideo, add debounced auto-save
- `components/Storyboard/BulkGenerationToolbar.tsx` - Add video generation buttons
- `hooks/useSceneGeneration.ts` - Add video generation functions and stats
- `src/backend/api/sentences.ts` - Add individual video generation endpoint, dirty flag on prompt change
- `src/backend/services/outputPaths.ts` - Update video path to include timestamp

### References
- [Source: components/Storyboard.tsx:197-215] - Current incorrect Gemini connection
- [Source: components/Storyboard.tsx:663-720] - Existing video tab UI
- [Source: components/Storyboard/BulkGenerationToolbar.tsx] - Pattern for bulk generation UI
- [Source: src/backend/api/projects.ts] - Bulk video generation endpoint
- [Source: src/backend/inngest/functions/generateVideo.ts] - Video generation Inngest function
- [Source: _bmad-output/implementation-artifacts/5-1-video-generation-job.md] - Backend implementation

### Dependencies
- Story 5-1: Video Generation Job (backend Inngest function) - COMPLETED

### Supersedes
- Story 5-3: Video Regeneration & Override (merged into this story)

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
