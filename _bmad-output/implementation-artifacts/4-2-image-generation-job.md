# Story 4.2: Image Generation Job

Status: dev-complete

## Story

As a **creator**,
I want **images generated via ComfyUI for each sentence**,
so that **I have professional visuals matching my script**.

## Acceptance Criteria

1. Inngest function `image/generate` handles single sentence
2. Function loads ComfyUI workflow from model's `workflowFile` or default workflows
3. Workflow parameters injected: prompt, seed, aspect ratio, steps, cfg
4. Character reference images injected for image-to-image workflows
5. Style prompt prefix applied from `VisualStyle.promptPrefix`
6. Output is 16:9 aspect ratio (1920x1088)
7. PNG file stored at `data/projects/{projectId}/images/{sentenceId}.png`
8. Sentence `imageFile` field updated with file path
9. Sentence `isImageDirty` flag cleared on success
10. Progress polling via ComfyUI WebSocket API
11. Progress updates broadcast to frontend via WebSocket
12. Retry on failure (max 3 attempts)
13. Concurrency limit: 1 (GPU-bound)

## Tasks / Subtasks

- [x] Task 1: Extend ComfyUI client for image generation (AC: 2, 3, 10)
  - [x] 1.1: Add `generateImage` method to ComfyUIClient
  - [x] 1.2: Add `generateImageWithReference` method for image-to-image
  - [x] 1.3: Implement workflow loading and parameter injection
  - [x] 1.4: Implement WebSocket completion polling
  - [x] 1.5: Implement result download

- [x] Task 2: Create image generation Inngest function (AC: 1, 11, 12, 13)
  - [x] 2.1: Create `src/backend/inngest/functions/generateImage.ts`
  - [x] 2.2: Add `image/generate` event type to Inngest client
  - [x] 2.3: Configure concurrency limit of 1
  - [x] 2.4: Implement retry with exponential backoff

- [x] Task 3: Integrate Model/Style system (AC: 2, 4, 5)
  - [x] 3.1: Fetch `GenerationModel` from database by `modelId`
  - [x] 3.2: Fetch `VisualStyle` from database by `styleId`
  - [x] 3.3: Use `model.workflowFile` for workflow path
  - [x] 3.4: Use `style.promptPrefix` for prompt enhancement
  - [x] 3.5: Support legacy style fallback for backwards compatibility

- [x] Task 4: Implement file storage (AC: 7, 8, 9)
  - [x] 4.1: Add `getImagePath` to outputPaths service
  - [x] 4.2: Update sentence record with imageFile
  - [x] 4.3: Clear isImageDirty flag on success

- [x] Task 5: Support character reference images (AC: 4)
  - [x] 5.1: Implement `getCharacterReferencePath` helper
  - [x] 5.2: Upload reference images to ComfyUI input folder
  - [x] 5.3: Use image-to-image workflow when character refs available

## Dev Notes

### Architecture Patterns
- GPU-bound: concurrency limit of 1
- WebSocket polling for ComfyUI progress
- Workflow JSON defines the generation pipeline
- Two-tier model/style system from STORY-038 Style Builder

### Model/Style System Integration (STORY-038)

The project uses a two-tier model/style system for image generation:

**GenerationModel** - Defines the ComfyUI workflow:
```typescript
interface GenerationModel {
  id: string;
  name: string;
  workflowCategory: 'image' | 'video';
  workflowType: 'text-to-image' | 'image-to-image' | 'image-to-video';
  workflowFile: string | null;      // Path to ComfyUI workflow JSON
  defaultSteps: number;              // Default sampling steps
  defaultCfg: number;                // Default CFG scale
  isActive: boolean;
}
```

**VisualStyle** - Defines the visual aesthetic:
```typescript
interface VisualStyle {
  id: string;
  name: string;
  styleType: 'prompt' | 'lora';
  promptPrefix: string | null;       // Prepended to image prompts
  loraFile: string | null;           // LoRA checkpoint file
  loraStrength: number;              // LoRA strength (0-2)
  compatibleModels: string[];        // Model IDs this style works with
  requiresCharacterRef: boolean;     // Whether character ref images needed
  isActive: boolean;
}
```

**Workflow Selection Logic:**
1. If `modelId` provided → fetch model and use `model.workflowFile`
2. If no model → fallback to default workflows in `workflows/` folder
3. Workflow type determines which client method to use:
   - `text-to-image` → `comfyui.generateImage()`
   - `image-to-image` → `comfyui.generateImageWithReference()`

**Style Application:**
1. If `styleId` provided → fetch style and prepend `style.promptPrefix` to prompt
2. For LoRA styles → inject LoRA loader node (future enhancement)
3. Legacy `style` parameter supported for backwards compatibility

### Default Workflows
```typescript
const WORKFLOWS = {
  imageToImage: 'workflows/image/image_flux2_klein_image_edit_4b_base.json',
  textToImage: 'workflows/image/text-to-image-image_z_image_turbo.json',
};
```

### Source Tree Components

**Existing Files (already implemented):**
- `src/backend/inngest/functions/generateImage.ts` - Main Inngest function
- `src/backend/clients/comfyui.ts` - Full ComfyUI client with image/video methods
- `src/backend/services/outputPaths.ts` - Path utilities
- `src/backend/config/visualStyles.ts` - Legacy style configuration

**Database Tables:**
- `generation_models` - Model configurations with workflow paths
- `visual_styles` - Style configurations with prompt prefixes
- `sentences` - Stores imageFile, isImageDirty fields

### API Endpoints

**Trigger Image Generation:**
```
POST /api/v1/projects/:projectId/generate-images
{
  sentenceIds?: string[],   // Specific sentences (optional)
  modelId?: string,         // Generation model ID
  styleId?: string,         // Visual style ID
  force?: boolean           // Regenerate even if image exists
}
```

**Event Data for `image/generate`:**
```typescript
{
  sentenceId: string;
  projectId: string;
  prompt: string;
  modelId?: string;           // New model/style system
  styleId?: string;           // New model/style system
  style?: string;             // Legacy fallback
  characterRefs?: string[];   // Character IDs for reference images
  useImageToImage?: boolean;  // Use image-to-image workflow
  seed?: number;
  steps?: number;
  cfg?: number;
}
```

### References
- [Source: src/backend/inngest/functions/generateImage.ts] - Implementation
- [Source: src/backend/clients/comfyui.ts] - ComfyUI client
- [Source: src/backend/api/models.ts] - Models API
- [Source: src/backend/api/styles.ts] - Styles API
- [Source: docs/stories/STORY-038-style-builder-ui.md] - Style Builder

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
N/A - Implementation completed in earlier development phase

### Completion Notes List
1. ComfyUI client fully implemented with text-to-image and image-to-image support
2. WebSocket progress polling for real-time updates
3. Image upload to ComfyUI input folder for reference images
4. Inngest function with concurrency limit of 1, 3 retries
5. Full model/style system integration with database lookup
6. Legacy style fallback for backwards compatibility
7. Output path management with automatic directory creation
8. Sentence status updates (generating → completed/failed)
9. Job service integration for progress broadcasting

### File List

**Existing Files:**
- `src/backend/inngest/functions/generateImage.ts` - Inngest function
- `src/backend/clients/comfyui.ts` - ComfyUI client
- `src/backend/inngest/client.ts` - Contains image/generate event type
- `src/backend/services/outputPaths.ts` - Path utilities
- `src/backend/config/visualStyles.ts` - Legacy styles
- `workflows/image/*.json` - Default workflow files
