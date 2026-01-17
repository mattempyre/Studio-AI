# STORY-020: Video Generation Job

**Epic:** Video Generation (EPIC-05)
**Priority:** Must Have
**Story Points:** 8
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 4

---

## User Story

As a **creator**
I want **images converted to video clips with motion**
So that **my content has dynamic visual movement**

---

## Description

### Background
Static images need motion to become engaging video content. Image-to-video generation uses the generated image as a starting frame and adds camera movement or subject animation. ComfyUI with WAN 2.2 (or similar) creates short video clips that match audio duration.

### Scope
**In scope:**
- Inngest function for video generation
- ComfyUI client with video workflow execution
- Load and parameterize WAN 2.2 workflow
- Image-to-video conversion
- Camera movement parameter
- Motion strength control
- MP4 file output
- Progress updates via WebSocket

**Out of scope:**
- Text-to-video (without source image)
- Video transitions between clips
- Audio synchronization in clip
- Video concatenation

### User Flow
1. Sentence has generated image
2. User sets camera movement and motion strength
3. User clicks "Generate Video" or bulk generation triggers
4. System queues video generation job
5. ComfyUI loads video workflow with source image
6. Video generates with specified motion
7. MP4 downloaded and saved
8. User sees video in storyboard

---

## Acceptance Criteria

- [ ] Inngest function `video/generate` handles single sentence
- [ ] Function requires existing imageFile on sentence
- [ ] Loads workflow from `workflows/video/wan-2.2.json`
- [ ] Source image injected into workflow
- [ ] Camera movement parameter applied (static, pan_left, pan_right, zoom_in, zoom_out, orbit, truck)
- [ ] Motion strength (0.0-1.0) controls movement intensity
- [ ] Output is MP4 video file
- [ ] Video duration approximately matches audio duration (or default 5 seconds)
- [ ] MP4 stored at `data/projects/{projectId}/videos/{sentenceId}.mp4`
- [ ] Sentence `videoFile` field updated
- [ ] Sentence `isVideoDirty` flag cleared
- [ ] Concurrency limit: 1 (GPU-bound)
- [ ] Progress updates broadcast via WebSocket
- [ ] Retry on failure (max 3 attempts)

---

## Technical Notes

### Components
- **Inngest Function:** `src/backend/inngest/functions/generateVideo.ts`
- **Client:** `src/backend/clients/comfyui.ts` (extended)
- **Workflows:** `workflows/video/wan-2.2.json`

### Inngest Event Type

```typescript
'video/generate': {
  data: {
    projectId: string;
    sentenceId: string;
    imageFile: string;
    videoPrompt?: string;
    cameraMovement: string;
    motionStrength: number;
    targetDuration?: number;  // milliseconds
  };
};

'video/completed': {
  data: {
    projectId: string;
    sentenceId: string;
    videoFile: string;
    duration: number;
  };
};
```

### Camera Movement Mapping

```typescript
const CAMERA_MOVEMENTS = {
  static: { x: 0, y: 0, z: 0, rotation: 0 },
  pan_left: { x: -50, y: 0, z: 0, rotation: 0 },
  pan_right: { x: 50, y: 0, z: 0, rotation: 0 },
  zoom_in: { x: 0, y: 0, z: 30, rotation: 0 },
  zoom_out: { x: 0, y: 0, z: -30, rotation: 0 },
  orbit: { x: 20, y: 10, z: 0, rotation: 15 },
  truck: { x: 30, y: 0, z: 10, rotation: 0 },
} as const;

function getCameraParams(movement: string, strength: number) {
  const base = CAMERA_MOVEMENTS[movement] || CAMERA_MOVEMENTS.static;
  return {
    x: base.x * strength,
    y: base.y * strength,
    z: base.z * strength,
    rotation: base.rotation * strength,
  };
}
```

### ComfyUI Client Extension

```typescript
// Add to ComfyUIClient
interface VideoWorkflowParams {
  sourceImage: string;  // Path to PNG
  prompt?: string;
  cameraMovement: { x: number; y: number; z: number; rotation: number };
  motionStrength: number;
  duration: number;  // frames or seconds
}

async generateVideo(workflowPath: string, params: VideoWorkflowParams, outputPath: string): Promise<void> {
  // Load workflow
  const workflowJson = await readFile(workflowPath, 'utf-8');
  const workflow = JSON.parse(workflowJson);

  // Upload source image to ComfyUI
  const uploadedImageName = await this.uploadImage(params.sourceImage);

  // Inject parameters
  const modified = this.injectVideoParams(workflow, {
    ...params,
    sourceImageName: uploadedImageName,
  });

  // Queue and wait
  const promptId = await this.queueWorkflow(modified);
  await this.waitForCompletion(promptId);

  // Download video
  await this.downloadVideoResult(promptId, outputPath);
}

private async uploadImage(imagePath: string): Promise<string> {
  const imageBuffer = await readFile(imagePath);
  const formData = new FormData();
  formData.append('image', new Blob([imageBuffer]), 'input.png');

  const response = await fetch(`${this.config.baseUrl}/upload/image`, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  return result.name;  // Returns filename in ComfyUI's input directory
}

private injectVideoParams(workflow: any, params: VideoWorkflowParams & { sourceImageName: string }): any {
  const modified = JSON.parse(JSON.stringify(workflow));

  for (const nodeId of Object.keys(modified)) {
    const node = modified[nodeId];

    // LoadImage node (source)
    if (node.class_type === 'LoadImage') {
      node.inputs.image = params.sourceImageName;
    }

    // Camera motion node (varies by model)
    if (node.class_type === 'CameraMotion' || node._meta?.title?.includes('Camera')) {
      node.inputs.x_translation = params.cameraMovement.x;
      node.inputs.y_translation = params.cameraMovement.y;
      node.inputs.z_translation = params.cameraMovement.z;
      node.inputs.rotation = params.cameraMovement.rotation;
    }

    // Motion strength (varies by model)
    if (node.class_type === 'MotionStrength' || node._meta?.title?.includes('Motion')) {
      node.inputs.strength = params.motionStrength;
    }

    // Frame count / duration
    if (node.class_type === 'EmptyVideoLatent' || node._meta?.title?.includes('Duration')) {
      node.inputs.frame_count = Math.ceil(params.duration * 24);  // Assuming 24fps
    }

    // Optional text prompt
    if (params.prompt && node.class_type === 'CLIPTextEncode' && node._meta?.title?.includes('Positive')) {
      node.inputs.text = params.prompt;
    }
  }

  return modified;
}

private async downloadVideoResult(promptId: string, outputPath: string): Promise<void> {
  const historyResponse = await fetch(`${this.config.baseUrl}/history/${promptId}`);
  const history = await historyResponse.json();

  const outputs = history[promptId]?.outputs;
  if (!outputs) throw new Error('No outputs found');

  // Find video output (GIF or MP4)
  let videoInfo: { filename: string; subfolder: string } | null = null;
  for (const nodeOutput of Object.values(outputs) as any[]) {
    if (nodeOutput.gifs?.[0]) {
      videoInfo = nodeOutput.gifs[0];
      break;
    }
    if (nodeOutput.videos?.[0]) {
      videoInfo = nodeOutput.videos[0];
      break;
    }
  }

  if (!videoInfo) throw new Error('No video in outputs');

  const videoUrl = `${this.config.baseUrl}/view?filename=${videoInfo.filename}&subfolder=${videoInfo.subfolder}&type=output`;
  const videoResponse = await fetch(videoUrl);
  const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, videoBuffer);
}
```

### Inngest Function

```typescript
// src/backend/inngest/functions/generateVideo.ts
export const generateVideo = inngest.createFunction(
  {
    id: 'video-generate',
    concurrency: { limit: 1 },  // GPU-bound
    retries: 3,
    backoff: { type: 'exponential', base: '60s' },  // Longer backoff for GPU
  },
  { event: 'video/generate' },
  async ({ event, step }) => {
    const { projectId, sentenceId, imageFile, videoPrompt, cameraMovement, motionStrength, targetDuration } = event.data;

    // Validate image exists
    if (!imageFile) {
      throw new Error('No source image for video generation');
    }

    // Step 1: Create job
    const job = await step.run('create-job', async () => {
      return await jobService.createJob({
        projectId,
        sentenceId,
        jobType: 'video',
        status: 'running',
      });
    });

    // Step 2: Update status
    await step.run('update-status', async () => {
      await db.update(sentences)
        .set({ status: 'generating' })
        .where(eq(sentences.id, sentenceId));

      broadcastToProject(projectId, {
        type: 'progress',
        jobId: job.id,
        jobType: 'video',
        sentenceId,
        progress: 10,
        message: 'Starting video generation...',
      });
    });

    // Step 3: Generate video
    const outputPath = await step.run('generate-video', async () => {
      const workflowPath = join(process.cwd(), 'workflows', 'video', 'wan-2.2.json');
      const videoPath = getVideoPath(projectId, sentenceId);

      // Get audio duration for video length
      const sentence = await getSentence(sentenceId);
      const durationSeconds = (sentence.audioDuration || 5000) / 1000;

      broadcastToProject(projectId, {
        type: 'progress',
        jobId: job.id,
        jobType: 'video',
        sentenceId,
        progress: 30,
        message: 'ComfyUI processing video...',
      });

      await comfyuiClient.generateVideo(workflowPath, {
        sourceImage: imageFile,
        prompt: videoPrompt,
        cameraMovement: getCameraParams(cameraMovement, motionStrength),
        motionStrength,
        duration: durationSeconds,
      }, videoPath);

      return videoPath;
    });

    // Step 4: Update sentence
    await step.run('update-sentence', async () => {
      await db.update(sentences)
        .set({
          videoFile: outputPath,
          isVideoDirty: false,
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(sentences.id, sentenceId));
    });

    // Step 5: Complete job
    await step.run('complete-job', async () => {
      await jobService.completeJob(job.id, { resultFile: outputPath });

      broadcastToProject(projectId, {
        type: 'job_complete',
        jobId: job.id,
        jobType: 'video',
        sentenceId,
        result: { file: outputPath },
      });
    });

    return { success: true, videoFile: outputPath };
  }
);
```

### Workflow File Structure

Video workflows are more complex than image workflows. Key nodes:
- LoadImage (source frame)
- VideoModel (WAN 2.2, LTX, etc.)
- CameraMotion/MotionModule
- Sampler
- VideoEncoder (MP4 output)

---

## Dependencies

**Prerequisite Stories:**
- STORY-002: Inngest Job Queue Integration
- STORY-003: ComfyUI Client Integration
- STORY-018: Image Generation Job (source images)

**Blocked Stories:**
- STORY-021: Camera Movement Controls
- STORY-022: Video Regeneration & Override
- STORY-023: Storyboard Table View (displays videos)

**External Dependencies:**
- ComfyUI with WAN 2.2 or similar video model
- Sufficient VRAM (video generation needs more than images)

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Camera movement mapping
  - [ ] Workflow parameter injection
  - [ ] Video download handling
- [ ] Integration tests passing
  - [ ] End-to-end generation (requires ComfyUI)
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Video workflow format
  - [ ] Camera movement options
- [ ] Workflow file validated with ComfyUI
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with various movements

---

## Story Points Breakdown

- **ComfyUI video client:** 3 points
- **Workflow parameter injection:** 2 points
- **Inngest function:** 2 points
- **Camera movement mapping:** 1 point
- **Total:** 8 points

**Rationale:** Video generation is more complex than image - longer processing time, different output format, camera motion parameters. Same complexity level as image generation.

---

## Additional Notes

Video generation considerations:
- Longer processing time (30-120 seconds per clip)
- Higher VRAM requirements
- May need to unload other models
- Output format varies by workflow (GIF, MP4)

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
