# Story 4.1: Image Prompt Generation

Status: ready-for-dev

## Story

As a **creator**,
I want **image prompts automatically generated from my script**,
so that **I don't have to manually write visual descriptions for each sentence**.

## Acceptance Criteria

1. Image prompts generated automatically during script generation
2. Manual trigger: `POST /api/v1/projects/:id/generate-image-prompts`
3. LLM prompt includes: sentence text, section context, visual style, cast descriptions
4. Image prompts are 50-150 words describing the visual scene
5. Prompts include composition, lighting, mood, and subject details
6. Cast character appearances described when mentioned in text
7. Batch processing: 10-20 sentences per API call
8. Progress updates via WebSocket
9. Sentence `imagePrompt` field populated on completion
10. Existing prompts can be regenerated with `force: true`
11. Prompts are editable in storyboard scene inspector

## Tasks / Subtasks

- [ ] Task 1: Create prompt generation service (AC: 3, 4, 5, 6, 7)
  - [ ] 1.1: Create `src/backend/services/promptService.ts`
  - [ ] 1.2: Build LLM system prompt with visual style and cast context
  - [ ] 1.3: Implement batch processing (10-20 sentences per call)
  - [ ] 1.4: Parse JSON response and extract prompts

- [ ] Task 2: Extend Deepseek client (AC: 3, 4)
  - [ ] 2.1: Add `generateImagePrompts` method to DeepseekClient
  - [ ] 2.2: Configure JSON response format
  - [ ] 2.3: Handle batch request/response

- [ ] Task 3: Create API endpoint (AC: 2, 10)
  - [ ] 3.1: Add `POST /api/v1/projects/:id/generate-image-prompts`
  - [ ] 3.2: Support optional `sentenceIds` filter
  - [ ] 3.3: Support `force` flag for regeneration

- [ ] Task 4: Create Inngest function (AC: 8, 9)
  - [ ] 4.1: Create `src/backend/inngest/functions/generatePrompts.ts`
  - [ ] 4.2: Add `prompts/generate-image` event type
  - [ ] 4.3: Broadcast progress via WebSocket

- [ ] Task 5: Integrate into script generation (AC: 1)
  - [ ] 5.1: Call prompt generation after script creation
  - [ ] 5.2: Auto-trigger for new projects

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for prompt template construction
  - [ ] 6.2: Unit tests for batch processing logic
  - [ ] 6.3: Integration tests for API endpoint

## Dev Notes

### Architecture Patterns
- Batch processing to reduce API calls (10-20 sentences per call)
- Group sentences by section for context
- Visual style applied consistently across all prompts

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
- [Source: src/backend/clients/deepseek.ts] - Existing Deepseek client
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-403] - Auto prompt generation

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
