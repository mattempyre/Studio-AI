# Story 5.1: Video Generation Job

Status: ready-for-dev

## Story

As a **creator**,
I want **images converted to video clips with motion**,
so that **my content has dynamic visual movement**.

## Acceptance Criteria

1. Inngest function `video/generate` handles single sentence
2. Function requires existing imageFile on sentence
3. Loads workflow from model's `workflowFile` or default `workflows/video/wan-2.2.json`
4. Source image injected into workflow (uploaded to ComfyUI input folder)
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

- [x] Task 1: ComfyUI client video methods (AC: 3, 4) - **ALREADY IMPLEMENTED**
  - [x] 1.1: `generateVideo` method exists in ComfyUIClient
  - [x] 1.2: `uploadImage` method for source image upload
  - [x] 1.3: `prepareVideoWorkflow` for parameter injection
  - [x] 1.4: Video result download (MP4/GIF) via `downloadFile`

- [ ] Task 2: Create camera movement mapping (AC: 5, 6)
  - [ ] 2.1: Define CAMERA_MOVEMENTS constants
  - [ ] 2.2: Create getCameraParams function
  - [ ] 2.3: Scale by motion strength

- [ ] Task 3: Create video generation Inngest function (AC: 1, 12, 13, 14)
  - [ ] 3.1: Create `src/backend/inngest/functions/generateVideo.ts`
  - [ ] 3.2: Add `video/generate` event type to Inngest client
  - [ ] 3.3: Configure concurrency limit of 1
  - [ ] 3.4: Implement retry with exponential backoff (60s base)

- [ ] Task 4: Implement duration matching (AC: 7, 8)
  - [ ] 4.1: Read audioDuration from sentence
  - [ ] 4.2: Calculate frame count for target duration
  - [ ] 4.3: Default to 5 seconds if no audio

- [ ] Task 5: Create/configure workflow file (AC: 3)
  - [ ] 5.1: Create `workflows/video/wan-2.2.json` if not exists
  - [ ] 5.2: Configure LoadImage node
  - [ ] 5.3: Configure WanImageToVideo node
  - [ ] 5.4: Configure video encoder output (CreateVideo node)

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for camera movement mapping
  - [ ] 6.2: Unit tests for duration calculation
  - [ ] 6.3: Integration tests (requires ComfyUI)

## Dev Notes

### Architecture Patterns
- GPU-bound: concurrency limit of 1
- Longer processing than images (30-120 seconds)
- Video duration matches audio for lip-sync
- Two-tier model/style system from STORY-038 Style Builder

### Model/Style System Integration (STORY-038)

Video generation uses the same model/style system as image generation:

**GenerationModel for Video:**
```typescript
interface GenerationModel {
  id: string;
  name: string;
  workflowCategory: 'video';              // Filter for video models
  workflowType: 'image-to-video';         // Video generation type
  workflowFile: string | null;            // Path to ComfyUI workflow JSON
  defaultFrames: number;                   // Default frame count
  defaultFps: number;                      // Default FPS (typically 24 or 30)
  isActive: boolean;
}
```

**Workflow Selection:**
1. If `modelId` provided → fetch model and use `model.workflowFile`
2. If no model → fallback to default `workflows/video/wan-2.2.json`
3. Use `model.defaultFrames` and `model.defaultFps` for video settings

### ComfyUI Client Methods (Already Implemented)

The following methods exist in `src/backend/clients/comfyui.ts`:

```typescript
// Upload source image to ComfyUI input folder
async uploadImage(localPath: string, targetFilename?: string): Promise<string>

// Generate video from image
async generateVideo(
  workflowPath: string,
  params: VideoGenerationParams,
  outputPath: string,
  onProgress?: ProgressCallback
): Promise<string>

// Prepare workflow with video parameters
prepareVideoWorkflow(
  workflow: ComfyUIWorkflow,
  params: VideoGenerationParams
): ComfyUIWorkflow
```

**VideoGenerationParams Interface:**
```typescript
interface VideoGenerationParams {
  imageFile: string;           // Source image path
  prompt: string;              // Motion description
  negativePrompt?: string;
  cameraMovement?: 'static' | 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'orbit' | 'truck';
  motionStrength?: number;     // 0.0-1.0
  width?: number;
  height?: number;
  frames?: number;             // Frame count
  fps?: number;                // Frames per second
  seed?: number;
}
```

### Event Data for `video/generate`

```typescript
{
  sentenceId: string;
  projectId: string;
  imageFile: string;           // Required: source image path
  prompt: string;              // Motion/scene description
  modelId?: string;            // Video model ID
  cameraMovement?: string;     // Camera movement type
  motionStrength?: number;     // Movement intensity
  targetDuration?: number;     // Target duration in seconds
  seed?: number;
}
```

### Source Tree Components

**Already Implemented:**
- `src/backend/clients/comfyui.ts` - Full video generation support

**To Be Created:**
- `src/backend/inngest/functions/generateVideo.ts` - Inngest function
- `workflows/video/wan-2.2.json` - Default video workflow

**To Be Modified:**
- `src/backend/inngest/client.ts` - Add video/generate event type
- `src/backend/inngest/functions/index.ts` - Export generateVideoFunction
- `src/backend/inngest/index.ts` - Register function

### References
- [Source: src/backend/clients/comfyui.ts] - ComfyUI client (video methods implemented)
- [Source: src/backend/inngest/functions/generateImage.ts] - Pattern for Inngest function
- [Source: src/backend/api/models.ts] - Models API for video model config

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
