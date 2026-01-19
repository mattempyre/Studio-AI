# Story 4.1: Image Prompt Generation

Status: dev-complete

## Story

As a **creator**,
I want **image prompts automatically generated from my script**,
so that **I don't have to manually write visual descriptions for each sentence**.

## Acceptance Criteria

1. Image prompts generated automatically during script generation
2. Manual trigger: `POST /api/v1/projects/:id/generate-image-prompts`
3. LLM prompt includes: sentence text, section context, selected model/style context (promptPrefix from VisualStyle), cast descriptions
4. Image prompts are 50-150 words describing the visual scene
5. Prompts include composition, lighting, mood, and subject details
6. Cast character appearances described when mentioned in text
7. Batch processing: 10-20 sentences per API call
8. Progress updates via WebSocket
9. Sentence `imagePrompt` field populated on completion
10. Existing prompts can be regenerated with `force: true`
11. Prompts are editable in storyboard scene inspector

## Tasks / Subtasks

- [x] Task 1: Create prompt generation service (AC: 3, 4, 5, 6, 7)
  - [x] 1.1: Create `src/backend/services/promptService.ts`
  - [x] 1.2: Build LLM system prompt with style context (fetch VisualStyle.promptPrefix via styleId) and cast descriptions
  - [x] 1.3: Implement batch processing (10-20 sentences per call)
  - [x] 1.4: Parse JSON response and extract prompts

- [x] Task 2: Extend Deepseek client (AC: 3, 4)
  - [x] 2.1: Add `generateImagePrompts` method to DeepseekClient
  - [x] 2.2: Configure JSON response format
  - [x] 2.3: Handle batch request/response

- [x] Task 3: Create API endpoint (AC: 2, 10)
  - [x] 3.1: Add `POST /api/v1/projects/:id/generate-image-prompts`
  - [x] 3.2: Support optional `sentenceIds` filter
  - [x] 3.3: Support `force` flag for regeneration

- [x] Task 4: Create Inngest function (AC: 8, 9)
  - [x] 4.1: Create `src/backend/inngest/functions/generatePrompts.ts`
  - [x] 4.2: Add `prompts/generate-image` event type
  - [x] 4.3: Broadcast progress via WebSocket

- [x] Task 5: Integrate into script generation (AC: 1)
  - [x] 5.1: Call prompt generation after script creation
  - [x] 5.2: Auto-trigger for new projects

- [x] Task 6: Write tests
  - [x] 6.1: Unit tests for prompt template construction
  - [x] 6.2: Unit tests for batch processing logic
  - [x] 6.3: Integration tests for API endpoint

## Dev Notes

### Architecture Patterns
- Batch processing to reduce API calls (10-20 sentences per call)
- Group sentences by section for context
- Model/Style system provides context for prompt generation (STORY-038 Style Builder)

### Style Builder Integration (STORY-038)
The project now uses a two-tier model/style system:
- **Projects** have `modelId` and `styleId` fields in database
- **GenerationModel** - Workflow configuration for image/video generation
- **VisualStyle** - Contains `promptPrefix` (for prompt-based styles) or LoRA config

**For image prompt generation:**
1. Retrieve project's `styleId` to get the selected visual style
2. Use `VisualStyle.promptPrefix` to inform the LLM about the desired aesthetic
3. Include this style context when generating prompts so images match the intended look
4. Include character descriptions from cast in prompt context (for text-based description)

**Character Reference Images (handled by Story 4-2 Image Generation):**
- When `VisualStyle.requiresCharacterRef: true` AND `GenerationModel.workflowType: 'image-to-image'`
- If a cast character is mentioned in the sentence AND has `referenceImages[]`
- The image generation job (not this story) feeds the reference image to ComfyUI
- This story generates the **text prompt** describing the scene; 4-2 handles the actual image generation with character refs

**Key Types:**
```typescript
interface VisualStyle {
  id: string;
  name: string;
  styleType: 'prompt' | 'lora';
  promptPrefix: string | null;  // Use this for LLM context
  compatibleModels: string[];
}
```

**API Endpoints:**
- `GET /api/v1/styles/:id` - Get style details including promptPrefix
- `GET /api/v1/models/:id` - Get model details

### Source Tree Components

**New Files:**
- `src/backend/services/promptService.ts`
- `src/backend/inngest/functions/generatePrompts.ts`
- `src/backend/api/prompts.ts`

**Modified Files:**
- `src/backend/clients/deepseek.ts` - Add generateImagePrompts method
- `src/backend/inngest/client.ts` - Add prompts/generate-image event
- `src/backend/server.ts` - Mount prompts router

### References
- [Source: docs/stories/STORY-017-image-prompt-generation.md]
- [Source: docs/stories/STORY-038-style-builder-ui.md] - Style Builder implementation
- [Source: src/backend/clients/deepseek.ts] - Existing Deepseek client
- [Source: src/backend/api/styles.ts] - Styles API for retrieving promptPrefix
- [Source: src/backend/api/models.ts] - Models API
- [Source: types.ts] - VisualStyle, GenerationModel interfaces
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-403] - Auto prompt generation

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
N/A - No debug issues encountered

### Completion Notes List
1. Created comprehensive promptService with batch processing support (10-20 sentences per call)
2. Added generateImagePrompts method to DeepseekClient with style context and cast character support
3. Created API endpoint with both sync and async modes (Inngest job queue)
4. Added prompts/generate-image event type to Inngest client
5. Created generatePrompts.ts Inngest function with WebSocket progress broadcasting
6. Integrated into both short-form and long-form script generation - triggers automatically after script completion
7. Added 12 new tests for image prompt generation functionality
8. All 67 Deepseek client tests pass including new image prompt tests

### File List

**New Files:**
- `src/backend/services/promptService.ts` - Image prompt generation service with batch processing
- `src/backend/inngest/functions/generatePrompts.ts` - Inngest function for async prompt generation
- `src/backend/api/prompts.ts` - REST API endpoints for prompt generation

**Modified Files:**
- `src/backend/clients/deepseek.ts` - Added generateImagePrompts method, ImagePromptSentence types
- `src/backend/inngest/client.ts` - Added prompts/generate-image and prompts/generate-image-completed events
- `src/backend/inngest/index.ts` - Registered generateImagePromptsFunction
- `src/backend/inngest/functions/index.ts` - Exported generateImagePromptsFunction
- `src/backend/inngest/functions/generateScript.ts` - Added step to trigger image prompt generation
- `src/backend/inngest/functions/generateLongScript.ts` - Added step to trigger image prompt generation
- `src/backend/server.ts` - Mounted promptsRouter
- `src/backend/services/index.ts` - Exported promptService
- `tests/unit/deepseek-client.test.ts` - Added 12 new tests for image prompt generation
