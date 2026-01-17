# STORY-017: Image Prompt Generation

**Epic:** Image Generation (EPIC-04)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 3

---

## User Story

As a **creator**
I want **image prompts automatically generated from my script**
So that **I don't have to manually write visual descriptions for each sentence**

---

## Description

### Background
Each sentence needs an image prompt that describes the visual content for that moment. Writing hundreds of image prompts manually is tedious. The LLM can generate contextually appropriate prompts based on the script text, visual style, and cast characters.

### Scope
**In scope:**
- LLM generates image prompt from sentence text
- Include character descriptions from project cast
- Include visual style from project settings
- Store imagePrompt on sentence record
- Batch processing to reduce API calls
- Editable in UI after generation

**Out of scope:**
- Video prompt generation (separate story)
- Per-scene style variations
- Negative prompts
- Multiple prompt variations per sentence

### User Flow
1. Script is generated with sentences
2. System auto-generates image prompts OR user clicks "Generate Image Prompts"
3. Deepseek processes sentences in batches
4. Each sentence gets an imagePrompt field populated
5. User can review and edit prompts in storyboard
6. Prompts are used when generating images

---

## Acceptance Criteria

- [ ] Image prompts generated automatically during script generation
- [ ] Manual trigger: `POST /api/v1/projects/:id/generate-image-prompts`
- [ ] LLM prompt includes: sentence text, section context, visual style, cast descriptions
- [ ] Image prompts are 50-150 words describing the visual scene
- [ ] Prompts include composition, lighting, mood, and subject details
- [ ] Cast character appearances described when mentioned in text
- [ ] Batch processing: 10-20 sentences per API call
- [ ] Progress updates via WebSocket
- [ ] Sentence `imagePrompt` field populated on completion
- [ ] Existing prompts can be regenerated with `force: true`
- [ ] Prompts are editable in storyboard scene inspector

---

## Technical Notes

### Components
- **API:** `src/backend/api/prompts.ts`
- **Service:** `src/backend/services/promptService.ts`
- **Inngest:** `src/backend/inngest/functions/generatePrompts.ts`

### API Endpoint

```
POST /api/v1/projects/:id/generate-image-prompts
Content-Type: application/json

Request:
{
  "sentenceIds": ["sent_1", "sent_2"],  // Optional, all if omitted
  "force": false  // If true, overwrite existing prompts
}

Response (202):
{
  "message": "Image prompt generation started",
  "sentenceCount": 24
}
```

### Deepseek Prompt Template

```typescript
const systemPrompt = `You are a visual director creating image prompts for a video.
Generate detailed image descriptions for each sentence that can be used to generate images with Flux 2.

VISUAL STYLE: ${visualStyle}

CAST CHARACTERS:
${cast.map(c => `- ${c.name}: ${c.description}`).join('\n')}

For each sentence, create an image prompt that:
1. Describes the visual scene matching the narration
2. Includes specific composition (wide shot, close-up, etc.)
3. Specifies lighting and color palette
4. Mentions relevant characters by name with consistent appearance
5. Captures the mood and emotion
6. Is 50-150 words long

OUTPUT FORMAT (JSON array):
[
  {
    "sentenceId": "sent_001",
    "imagePrompt": "A wide establishing shot of a rustic coffee plantation at golden hour..."
  },
  ...
]`;

const userPrompt = `Generate image prompts for these sentences:

SECTION: ${sectionTitle}

${sentences.map(s => `[${s.id}] "${s.text}"`).join('\n')}`;
```

### Batch Processing

```typescript
// src/backend/services/promptService.ts
const BATCH_SIZE = 15; // Sentences per API call

export async function generateImagePrompts(
  projectId: string,
  sentenceIds?: string[]
): Promise<void> {
  const project = await getProjectWithCast(projectId);
  const sentences = sentenceIds
    ? await getSentencesByIds(sentenceIds)
    : await getSentencesByProject(projectId);

  // Group by section for context
  const sectionMap = groupBySection(sentences);

  for (const [sectionId, sectionSentences] of Object.entries(sectionMap)) {
    const section = await getSection(sectionId);

    // Process in batches
    for (let i = 0; i < sectionSentences.length; i += BATCH_SIZE) {
      const batch = sectionSentences.slice(i, i + BATCH_SIZE);

      const prompts = await deepseekClient.generateImagePrompts({
        sentences: batch,
        sectionTitle: section.title,
        visualStyle: project.visualStyle,
        cast: project.cast,
      });

      // Update sentences with prompts
      for (const prompt of prompts) {
        await db.update(sentences)
          .set({ imagePrompt: prompt.imagePrompt })
          .where(eq(sentences.id, prompt.sentenceId));
      }

      // Broadcast progress
      broadcastToProject(projectId, {
        type: 'progress',
        jobType: 'prompts',
        progress: Math.round(((i + batch.length) / sectionSentences.length) * 100),
      });
    }
  }
}
```

### DeepseekClient Extension

```typescript
// Add to DeepseekClient
interface ImagePromptRequest {
  sentences: { id: string; text: string }[];
  sectionTitle: string;
  visualStyle: string;
  cast: Character[];
}

interface ImagePromptResult {
  sentenceId: string;
  imagePrompt: string;
}

async generateImagePrompts(request: ImagePromptRequest): Promise<ImagePromptResult[]> {
  const response = await this.chat({
    system: buildPromptSystemMessage(request),
    user: buildPromptUserMessage(request.sentences, request.sectionTitle),
    responseFormat: 'json',
  });

  return JSON.parse(response);
}
```

### Character Integration

```typescript
function buildCharacterContext(cast: Character[]): string {
  if (cast.length === 0) return 'No specific characters defined.';

  return cast.map(c => {
    const images = c.referenceImages.length > 0
      ? `(has ${c.referenceImages.length} reference images)`
      : '';
    return `- ${c.name}: ${c.description} ${images}`;
  }).join('\n');
}
```

### Inngest Function

```typescript
export const generateImagePrompts = inngest.createFunction(
  {
    id: 'prompts-generate-image',
    concurrency: { limit: 1 },
  },
  { event: 'prompts/generate-image' },
  async ({ event, step }) => {
    const { projectId, sentenceIds, force } = event.data;

    await step.run('generate-prompts', async () => {
      await promptService.generateImagePrompts(projectId, sentenceIds);
    });

    return { success: true };
  }
);
```

### Visual Style Examples

| Style | Prompt Characteristics |
|-------|----------------------|
| cinematic | "Film grain, anamorphic lens, dramatic lighting, shallow depth of field" |
| documentary | "Natural lighting, realistic colors, observational composition" |
| animated | "Vibrant colors, stylized characters, clean lines, Disney-Pixar aesthetic" |
| noir | "High contrast, deep shadows, monochromatic, moody atmosphere" |
| vintage | "Warm tones, soft focus, film photography look, nostalgic feel" |

### Security Considerations
- Validate sentence IDs belong to project
- Sanitize LLM output before database insert
- Rate limit prompt generation requests

---

## Dependencies

**Prerequisite Stories:**
- STORY-005: Deepseek API Client (LLM calls)
- STORY-009: AI Script Generation (sentences exist)
- STORY-013: Project Cast Management (character context)

**Blocked Stories:**
- STORY-018: Image Generation Job (uses imagePrompt)
- STORY-019: Image Regeneration & Override (edits imagePrompt)

**External Dependencies:**
- Deepseek API

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Prompt template construction
  - [ ] Batch processing logic
  - [ ] Character integration
- [ ] Integration tests passing
  - [ ] End-to-end prompt generation
  - [ ] Batch API calls
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Visual style descriptions
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with various styles

---

## Story Points Breakdown

- **LLM prompt design:** 1 point
- **Batch processing logic:** 1 point
- **Character/style integration:** 0.5 points
- **API endpoint & Inngest:** 0.5 points
- **Total:** 3 points

**Rationale:** Careful prompt engineering required for quality results. Batch processing adds complexity for efficiency.

---

## Additional Notes

Prompt quality tips:
- Be specific about camera angles and composition
- Include lighting direction and quality
- Mention color palette explicitly
- Reference character names for consistency
- Describe emotions and atmosphere

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
