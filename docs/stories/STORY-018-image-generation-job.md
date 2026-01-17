# STORY-018: Image Generation Job

**Epic:** Image Generation (EPIC-04)
**Priority:** Must Have
**Story Points:** 8
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 3

---

## User Story

As a **creator**
I want **images generated via ComfyUI for each sentence**
So that **I have professional visuals matching my script**

---

## Description

### Background
Each sentence needs a corresponding visual image. ComfyUI with Flux 2 generates high-quality images from text prompts. The system loads a workflow JSON, injects the prompt and parameters, queues execution, polls for completion, and downloads the result.

### Scope
**In scope:**
- Inngest function for image generation
- ComfyUI client with workflow execution
- Load and parameterize Flux 2 workflow
- Inject image prompt, character references, style LoRA
- 16:9 aspect ratio output
- File storage in project directory
- Progress updates via WebSocket
- Retry logic for failures

**Out of scope:**
- Multiple image models (future workflow files)
- Image upscaling
- Image editing/inpainting
- Batch image generation in single workflow

### User Flow
1. Sentence has imagePrompt populated
2. User clicks "Generate Image" or bulk generation triggers
3. System queues image generation job
4. ComfyUI loads Flux 2 workflow
5. Workflow executes with injected parameters
6. Generated image downloaded and saved
7. Sentence imageFile field updated
8. User sees image in storyboard

---

## Acceptance Criteria

- [ ] Inngest function `image/generate` handles single sentence
- [ ] Function loads ComfyUI workflow from `workflows/image/flux-2.json`
- [ ] Workflow parameters injected: prompt, seed, aspect ratio
- [ ] Character reference images injected if available
- [ ] Style LoRA applied from character or project settings
- [ ] Output is 16:9 aspect ratio (1920x1080 or similar)
- [ ] PNG file stored at `data/projects/{projectId}/images/{sentenceId}.png`
- [ ] Sentence `imageFile` field updated with file path
- [ ] Sentence `isImageDirty` flag cleared on success
- [ ] Progress polling via ComfyUI WebSocket API
- [ ] Progress updates broadcast to frontend
- [ ] Retry on failure (max 3 attempts)
- [ ] Concurrency limit: 1 (GPU-bound)
- [ ] Generation time ~10-30 seconds per image

---

## Technical Notes

### Components
- **Inngest Function:** `src/backend/inngest/functions/generateImage.ts`
- **Client:** `src/backend/clients/comfyui.ts`
- **Workflows:** `workflows/image/flux-2.json`

### Inngest Event Type

```typescript
'image/generate': {
  data: {
    projectId: string;
    sentenceId: string;
    imagePrompt: string;
    characterRefs?: string[];  // Reference image paths
    styleLora?: string;
    seed?: number;
  };
};

'image/completed': {
  data: {
    projectId: string;
    sentenceId: string;
    imageFile: string;
  };
};
```

### ComfyUI Client

```typescript
// src/backend/clients/comfyui.ts
import WebSocket from 'ws';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

interface ComfyUIConfig {
  baseUrl: string;
  wsUrl: string;
}

interface WorkflowParams {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  seed?: number;
  characterRefs?: string[];
  styleLora?: string;
}

class ComfyUIClient {
  private config: ComfyUIConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.COMFYUI_URL || 'http://localhost:8188',
      wsUrl: process.env.COMFYUI_WS_URL || 'ws://localhost:8188',
    };
  }

  async generateImage(workflowPath: string, params: WorkflowParams, outputPath: string): Promise<void> {
    // Load workflow
    const workflowJson = await readFile(workflowPath, 'utf-8');
    const workflow = JSON.parse(workflowJson);

    // Inject parameters
    const modified = this.injectParams(workflow, params);

    // Queue workflow
    const promptId = await this.queueWorkflow(modified);

    // Wait for completion
    await this.waitForCompletion(promptId);

    // Download result
    await this.downloadResult(promptId, outputPath);
  }

  private injectParams(workflow: any, params: WorkflowParams): any {
    // Clone workflow
    const modified = JSON.parse(JSON.stringify(workflow));

    // Find and update prompt node
    for (const nodeId of Object.keys(modified)) {
      const node = modified[nodeId];

      // CLIPTextEncode (positive prompt)
      if (node.class_type === 'CLIPTextEncode' && node._meta?.title?.includes('Positive')) {
        node.inputs.text = params.prompt;
      }

      // CLIPTextEncode (negative prompt)
      if (node.class_type === 'CLIPTextEncode' && node._meta?.title?.includes('Negative')) {
        node.inputs.text = params.negativePrompt || 'blurry, low quality, distorted';
      }

      // EmptyLatentImage (dimensions)
      if (node.class_type === 'EmptyLatentImage') {
        node.inputs.width = params.width;
        node.inputs.height = params.height;
      }

      // KSampler (seed)
      if (node.class_type === 'KSampler' && params.seed) {
        node.inputs.seed = params.seed;
      }

      // LoraLoader (style)
      if (node.class_type === 'LoraLoader' && params.styleLora) {
        node.inputs.lora_name = params.styleLora;
      }
    }

    return modified;
  }

  private async queueWorkflow(workflow: any): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow }),
    });

    if (!response.ok) {
      throw new Error(`ComfyUI queue failed: ${await response.text()}`);
    }

    const result = await response.json();
    return result.prompt_id;
  }

  private async waitForCompletion(promptId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.config.wsUrl}/ws`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('ComfyUI timeout'));
      }, 300000); // 5 minute timeout

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'executing' && message.data.prompt_id === promptId) {
          if (message.data.node === null) {
            // Execution complete
            clearTimeout(timeout);
            ws.close();
            resolve();
          }
        }

        if (message.type === 'execution_error' && message.data.prompt_id === promptId) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(message.data.exception_message));
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private async downloadResult(promptId: string, outputPath: string): Promise<void> {
    // Get history to find output
    const historyResponse = await fetch(`${this.config.baseUrl}/history/${promptId}`);
    const history = await historyResponse.json();

    const outputs = history[promptId]?.outputs;
    if (!outputs) throw new Error('No outputs found');

    // Find image output
    let imageInfo: { filename: string; subfolder: string } | null = null;
    for (const nodeOutput of Object.values(outputs) as any[]) {
      if (nodeOutput.images?.[0]) {
        imageInfo = nodeOutput.images[0];
        break;
      }
    }

    if (!imageInfo) throw new Error('No image in outputs');

    // Download image
    const imageUrl = `${this.config.baseUrl}/view?filename=${imageInfo.filename}&subfolder=${imageInfo.subfolder}&type=output`;
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Save to output path
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, imageBuffer);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/system_stats`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const comfyuiClient = new ComfyUIClient();
```

### Inngest Function

```typescript
// src/backend/inngest/functions/generateImage.ts
export const generateImage = inngest.createFunction(
  {
    id: 'image-generate',
    concurrency: { limit: 1 },  // GPU-bound
    retries: 3,
    backoff: { type: 'exponential', base: '30s' },
  },
  { event: 'image/generate' },
  async ({ event, step }) => {
    const { projectId, sentenceId, imagePrompt, characterRefs, styleLora, seed } = event.data;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      return await jobService.createJob({
        projectId,
        sentenceId,
        jobType: 'image',
        status: 'running',
      });
    });

    // Step 2: Update sentence status
    await step.run('update-status', async () => {
      await db.update(sentences)
        .set({ status: 'generating' })
        .where(eq(sentences.id, sentenceId));

      broadcastToProject(projectId, {
        type: 'progress',
        jobId: job.id,
        jobType: 'image',
        sentenceId,
        progress: 10,
        message: 'Starting image generation...',
      });
    });

    // Step 3: Generate image
    const outputPath = await step.run('generate-image', async () => {
      const workflowPath = join(process.cwd(), 'workflows', 'image', 'flux-2.json');
      const imagePath = getImagePath(projectId, sentenceId);

      broadcastToProject(projectId, {
        type: 'progress',
        jobId: job.id,
        jobType: 'image',
        sentenceId,
        progress: 30,
        message: 'ComfyUI processing...',
      });

      await comfyuiClient.generateImage(workflowPath, {
        prompt: imagePrompt,
        width: 1920,
        height: 1080,
        seed: seed || Math.floor(Math.random() * 2147483647),
        characterRefs,
        styleLora,
      }, imagePath);

      return imagePath;
    });

    // Step 4: Update sentence
    await step.run('update-sentence', async () => {
      await db.update(sentences)
        .set({
          imageFile: outputPath,
          isImageDirty: false,
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
        jobType: 'image',
        sentenceId,
        result: { file: outputPath },
      });
    });

    return { success: true, imageFile: outputPath };
  }
);
```

### Workflow File Structure

```json
// workflows/image/flux-2.json (simplified)
{
  "1": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": {
      "ckpt_name": "flux1-dev.safetensors"
    }
  },
  "2": {
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "Positive Prompt" },
    "inputs": {
      "text": "{{PROMPT}}",
      "clip": ["1", 1]
    }
  },
  "3": {
    "class_type": "CLIPTextEncode",
    "_meta": { "title": "Negative Prompt" },
    "inputs": {
      "text": "{{NEGATIVE}}",
      "clip": ["1", 1]
    }
  },
  "4": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": 1920,
      "height": 1080,
      "batch_size": 1
    }
  },
  "5": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 0,
      "steps": 30,
      "cfg": 7.0,
      "sampler_name": "euler",
      "scheduler": "normal",
      "model": ["1", 0],
      "positive": ["2", 0],
      "negative": ["3", 0],
      "latent_image": ["4", 0]
    }
  },
  "6": {
    "class_type": "VAEDecode",
    "inputs": {
      "samples": ["5", 0],
      "vae": ["1", 2]
    }
  },
  "7": {
    "class_type": "SaveImage",
    "inputs": {
      "filename_prefix": "output",
      "images": ["6", 0]
    }
  }
}
```

### Character Reference Injection

When cast has reference images, use IPAdapter or similar for consistency:

```typescript
private injectCharacterRefs(workflow: any, refs: string[]): any {
  if (!refs || refs.length === 0) return workflow;

  // Add IPAdapter nodes for character consistency
  // This is model-specific and may require custom workflow
  // ...
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-002: Inngest Job Queue Integration
- STORY-003: ComfyUI Client Integration
- STORY-017: Image Prompt Generation

**Blocked Stories:**
- STORY-019: Image Regeneration & Override
- STORY-020: Video Generation Job (needs images first)
- STORY-023: Storyboard Table View (displays images)

**External Dependencies:**
- ComfyUI running with Flux 2 model
- GPU with sufficient VRAM (12GB+ recommended)

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Workflow loading and parameter injection
  - [ ] ComfyUI API calls (mocked)
  - [ ] Progress handling
- [ ] Integration tests passing
  - [ ] End-to-end generation (requires ComfyUI)
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Workflow file format
  - [ ] ComfyUI setup instructions
- [ ] Workflow file validated with ComfyUI
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with various prompts

---

## Story Points Breakdown

- **ComfyUI client implementation:** 3 points
- **Workflow parameter injection:** 2 points
- **Inngest function with steps:** 2 points
- **WebSocket progress integration:** 1 point
- **Total:** 8 points

**Rationale:** Complex external service integration. ComfyUI API is not straightforward (WebSocket polling, workflow format). GPU constraints add operational complexity.

---

## Additional Notes

ComfyUI quirks:
- Workflows are node graphs, not simple configs
- WebSocket messages have specific format
- Output file location varies by workflow
- Model loading can add significant latency

Performance tips:
- Keep model loaded between generations
- Use consistent seed for reproducibility
- Consider image caching for identical prompts

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
