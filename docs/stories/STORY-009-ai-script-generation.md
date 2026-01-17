# STORY-009: AI Script Generation

**Epic:** Script Management (EPIC-01)
**Priority:** Must Have
**Story Points:** 5
**Status:** Completed
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator**
I want **to enter a topic and have AI generate a segmented script**
So that **I can quickly start production without writing from scratch**

---

## Description

### Background
Script generation is the starting point of the video creation pipeline. Users provide a topic and target duration, and the system generates a structured script organized into sections and sentences. Each sentence becomes a discrete unit for audio/image/video generation.

This story covers **short-form scripts** (under 10 minutes). For long-form scripts (10+ minutes), see STORY-006.

### Scope
**In scope:**
- API endpoint to trigger script generation
- Deepseek integration for script content generation
- Automatic segmentation into sections with titles
- Sentence-level parsing and storage
- Search grounding toggle for fact-checking
- Progress updates via WebSocket
- Background processing via Inngest

**Out of scope:**
- Long-form script generation (STORY-006)
- Script editing (STORY-010)
- Image/video prompt generation (STORY-017)

### User Flow
1. User creates a project with a topic
2. User clicks "Generate Script"
3. System shows "Generating..." with progress
4. Deepseek generates structured script content
5. System parses response into sections/sentences
6. Sentences are stored in database
7. User sees completed script in editor

---

## Acceptance Criteria

- [ ] `POST /api/v1/projects/:id/generate-script` triggers generation
- [ ] Request accepts: `topic` (string), `targetDuration` (minutes), `useSearchGrounding` (boolean)
- [ ] Generation runs as Inngest background job
- [ ] Deepseek prompt includes topic, duration, and style context
- [ ] Response is parsed into sections with titles
- [ ] Each sentence is stored as separate database record
- [ ] Sentences include estimated speaking duration
- [ ] Progress updates sent via WebSocket (0%, 25%, 50%, 75%, 100%)
- [ ] Completed job updates project status to "ready"
- [ ] Failed job updates project status to "failed" with error message
- [ ] Search grounding toggle enables/disables fact-checking
- [ ] Script respects target duration (±20% tolerance)
- [ ] Existing script is replaced if regenerating

---

## Technical Notes

### Components
- **API Route:** `src/backend/api/scripts.ts` - Trigger generation endpoint
- **Inngest Function:** `src/backend/inngest/functions/generateScript.ts`
- **Client:** `src/backend/clients/deepseek.ts` - Deepseek API calls

### API Specification

```
POST /api/v1/projects/:id/generate-script
Content-Type: application/json

Request:
{
  "topic": "The History of Coffee",
  "targetDuration": 8,
  "useSearchGrounding": true
}

Response (202):
{
  "jobId": "job_xyz789",
  "status": "queued",
  "message": "Script generation started"
}
```

### Inngest Event

```typescript
// Event type
'script/generate': {
  data: {
    projectId: string;
    topic: string;
    targetDuration: number;
    visualStyle: string;
    useSearchGrounding: boolean;
  };
};

// Event sending
await inngest.send({
  name: 'script/generate',
  data: {
    projectId: 'proj_abc123',
    topic: 'The History of Coffee',
    targetDuration: 8,
    visualStyle: 'documentary',
    useSearchGrounding: true,
  },
});
```

### Deepseek Prompt Structure

```typescript
const systemPrompt = `You are a professional video script writer. Write an engaging script about the given topic.

OUTPUT FORMAT (JSON):
{
  "title": "Video title",
  "sections": [
    {
      "title": "Section Title",
      "sentences": [
        {
          "text": "One complete sentence of narration.",
          "imagePrompt": "Visual description for this moment",
          "estimatedDuration": 4.5
        }
      ]
    }
  ]
}

GUIDELINES:
- Target duration: ${targetDuration} minutes
- Visual style: ${visualStyle}
- Each sentence should be 10-20 words
- Estimated duration in seconds (assume 150 words/minute)
- Create ${Math.ceil(targetDuration / 2)} sections
- Write engaging, conversational narration
- Include visual transition cues between sections
`;

const userPrompt = `Write a ${targetDuration}-minute video script about: ${topic}`;
```

### Inngest Function

```typescript
export const generateScript = inngest.createFunction(
  {
    id: 'script-generate',
    concurrency: { limit: 1 },
    retries: 2,
  },
  { event: 'script/generate' },
  async ({ event, step }) => {
    const { projectId, topic, targetDuration, visualStyle, useSearchGrounding } = event.data;

    // Step 1: Generate script via Deepseek
    const script = await step.run('generate-content', async () => {
      return await deepseekClient.generateScript({
        topic,
        targetDuration,
        visualStyle,
        useSearchGrounding,
      });
    });

    // Step 2: Clear existing sections/sentences
    await step.run('clear-existing', async () => {
      await db.delete(sentences).where(
        inArray(sentences.sectionId,
          db.select({ id: sections.id }).from(sections).where(eq(sections.projectId, projectId))
        )
      );
      await db.delete(sections).where(eq(sections.projectId, projectId));
    });

    // Step 3: Save sections and sentences
    await step.run('save-script', async () => {
      for (let sectionIndex = 0; sectionIndex < script.sections.length; sectionIndex++) {
        const section = script.sections[sectionIndex];
        const sectionId = nanoid();

        await db.insert(sections).values({
          id: sectionId,
          projectId,
          title: section.title,
          order: sectionIndex,
        });

        for (let sentenceIndex = 0; sentenceIndex < section.sentences.length; sentenceIndex++) {
          const sentence = section.sentences[sentenceIndex];
          await db.insert(sentences).values({
            id: nanoid(),
            sectionId,
            text: sentence.text,
            order: sentenceIndex,
            imagePrompt: sentence.imagePrompt,
          });
        }
      }
    });

    // Step 4: Update project status
    await step.run('update-status', async () => {
      await db.update(projects)
        .set({ status: 'ready', updatedAt: new Date() })
        .where(eq(projects.id, projectId));
    });

    return { success: true, sectionCount: script.sections.length };
  }
);
```

### Duration Calculation

```typescript
function estimateSpeakingDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const wordsPerMinute = 150;
  const durationSeconds = (words / wordsPerMinute) * 60;
  return Math.round(durationSeconds * 10) / 10; // Round to 0.1s
}
```

### Search Grounding

When `useSearchGrounding` is true, include in Deepseek request:
```typescript
const options = {
  // ... other options
  tools: useSearchGrounding ? ['web_search'] : undefined,
};
```

### Security Considerations
- Validate topic length (max 1000 chars)
- Sanitize LLM output before database insertion
- Rate limit generation requests per project

---

## Dependencies

**Prerequisite Stories:**
- STORY-005: Deepseek API Client Integration (API client)
- STORY-007: WebSocket Progress Server (progress updates)
- STORY-008: Project CRUD API (project must exist)
- STORY-002: Inngest Job Queue Integration (job processing)

**Blocked Stories:**
- STORY-010: Script Editor Component (displays generated script)
- STORY-014: Audio Generation Job (needs sentences to exist)
- STORY-017: Image Prompt Generation (processes sentences)

**External Dependencies:**
- Deepseek API key configured
- Inngest server running

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Deepseek prompt construction
  - [ ] Response parsing into sections/sentences
  - [ ] Duration estimation
  - [ ] Search grounding toggle
- [ ] Integration tests passing
  - [ ] End-to-end generation flow
  - [ ] Error handling for API failures
  - [ ] Existing script replacement
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] API endpoint documentation
  - [ ] Prompt format documented
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with various topics

---

## Story Points Breakdown

- **API endpoint & validation:** 1 point
- **Inngest function with steps:** 2 points
- **Deepseek integration & parsing:** 1.5 points
- **WebSocket progress updates:** 0.5 points
- **Total:** 5 points

**Rationale:** Multi-component story requiring API, Inngest, Deepseek, and WebSocket coordination. The Inngest step function pattern adds complexity but ensures durability.

---

## Additional Notes

Consider future enhancements:
- Script templates for common video types
- Tone/style presets (formal, casual, educational)
- Multi-language support
- Script outline review before generation

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
