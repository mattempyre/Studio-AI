# STORY-031: Dependency Tracking

**Epic:** Cascading Updates (EPIC-08)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 3

---

## User Story

As a **system**
I want **to track dependencies between assets**
So that **changes cascade correctly through the pipeline**

---

## Description

### Background
In the video generation pipeline, assets have dependencies: audio depends on text, images depend on image prompts, and videos depend on images. When an upstream asset changes, downstream assets become "dirty" and need regeneration. This story implements the dependency tracking and dirty flag system.

### Scope
**In scope:**
- Dirty flag fields on sentences
- Automatic dirty marking when text/prompts change
- API to query dirty assets
- Dirty status in WebSocket updates
- Clear dirty flags after regeneration

**Out of scope:**
- Automatic regeneration (separate story)
- Complex dependency graphs
- Version history

### Dependency Chain
```
text → audio → (timeline duration)
     ↘
imagePrompt → image → video
     ↗
videoPrompt
```

When text changes: audio becomes dirty
When imagePrompt changes: image becomes dirty, video becomes dirty
When videoPrompt changes: video becomes dirty
When image changes: video becomes dirty

---

## Acceptance Criteria

- [ ] Sentences table has dirty flag fields: `isAudioDirty`, `isImageDirty`, `isVideoDirty`
- [ ] Text edit marks `isAudioDirty = true`
- [ ] Image prompt edit marks `isImageDirty = true`, `isVideoDirty = true`
- [ ] Video prompt edit marks `isVideoDirty = true`
- [ ] Image regeneration marks `isVideoDirty = true`
- [ ] Audio regeneration clears `isAudioDirty`
- [ ] Image regeneration clears `isImageDirty`
- [ ] Video regeneration clears `isVideoDirty`
- [ ] API returns dirty status with sentence data
- [ ] WebSocket broadcasts dirty status changes
- [ ] Storyboard UI shows dirty indicators

---

## Technical Notes

### Components
- **Schema:** `src/backend/db/schema.ts` (add dirty fields)
- **Service:** `src/backend/services/dependencyService.ts`
- **API:** Update sentence endpoints

### Schema Update

```typescript
// src/backend/db/schema.ts
export const sentences = sqliteTable('sentences', {
  id: text('id').primaryKey(),
  sectionId: text('section_id').notNull().references(() => sections.id),
  order: integer('order').notNull(),
  text: text('text').notNull(),

  // Prompts
  imagePrompt: text('image_prompt'),
  videoPrompt: text('video_prompt'),
  cameraMovement: text('camera_movement').default('static'),
  motionStrength: real('motion_strength').default(0.5),

  // Generated assets
  audioFile: text('audio_file'),
  audioDuration: integer('audio_duration'),
  imageFile: text('image_file'),
  videoFile: text('video_file'),

  // Dirty flags (NEW)
  isAudioDirty: integer('is_audio_dirty', { mode: 'boolean' }).default(false),
  isImageDirty: integer('is_image_dirty', { mode: 'boolean' }).default(false),
  isVideoDirty: integer('is_video_dirty', { mode: 'boolean' }).default(false),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
```

### Dependency Service

```typescript
// src/backend/services/dependencyService.ts
import { db } from '../db';
import { sentences } from '../db/schema';
import { eq } from 'drizzle-orm';
import { broadcastToProject } from '../websocket';

type DirtyField = 'isAudioDirty' | 'isImageDirty' | 'isVideoDirty';

interface DirtyUpdate {
  sentenceId: string;
  projectId: string;
  fields: DirtyField[];
  value: boolean;
}

class DependencyService {
  /**
   * Mark downstream assets as dirty when source changes
   */
  async markDirty({ sentenceId, projectId, fields, value }: DirtyUpdate): Promise<void> {
    const updates: Partial<Record<DirtyField, boolean>> = {};
    for (const field of fields) {
      updates[field] = value;
    }

    await db
      .update(sentences)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(sentences.id, sentenceId));

    // Broadcast dirty status change
    broadcastToProject(projectId, {
      type: 'sentence_dirty_changed',
      sentenceId,
      dirty: updates,
    });
  }

  /**
   * Handle text change - marks audio as dirty
   */
  async onTextChanged(sentenceId: string, projectId: string): Promise<void> {
    await this.markDirty({
      sentenceId,
      projectId,
      fields: ['isAudioDirty'],
      value: true,
    });
  }

  /**
   * Handle image prompt change - marks image and video as dirty
   */
  async onImagePromptChanged(sentenceId: string, projectId: string): Promise<void> {
    await this.markDirty({
      sentenceId,
      projectId,
      fields: ['isImageDirty', 'isVideoDirty'],
      value: true,
    });
  }

  /**
   * Handle video prompt change - marks video as dirty
   */
  async onVideoPromptChanged(sentenceId: string, projectId: string): Promise<void> {
    await this.markDirty({
      sentenceId,
      projectId,
      fields: ['isVideoDirty'],
      value: true,
    });
  }

  /**
   * Handle image regeneration - marks video as dirty
   */
  async onImageRegenerated(sentenceId: string, projectId: string): Promise<void> {
    // Clear image dirty flag
    await this.markDirty({
      sentenceId,
      projectId,
      fields: ['isImageDirty'],
      value: false,
    });

    // Mark video as dirty (since image changed)
    await this.markDirty({
      sentenceId,
      projectId,
      fields: ['isVideoDirty'],
      value: true,
    });
  }

  /**
   * Clear dirty flag after successful regeneration
   */
  async clearDirtyFlag(
    sentenceId: string,
    projectId: string,
    field: DirtyField
  ): Promise<void> {
    await this.markDirty({
      sentenceId,
      projectId,
      fields: [field],
      value: false,
    });
  }

  /**
   * Get all dirty sentences for a project
   */
  async getDirtySentences(projectId: string): Promise<{
    audioDirty: string[];
    imageDirty: string[];
    videoDirty: string[];
  }> {
    const projectSentences = await db
      .select()
      .from(sentences)
      .innerJoin(sections, eq(sentences.sectionId, sections.id))
      .where(eq(sections.projectId, projectId));

    return {
      audioDirty: projectSentences
        .filter(s => s.sentences.isAudioDirty)
        .map(s => s.sentences.id),
      imageDirty: projectSentences
        .filter(s => s.sentences.isImageDirty)
        .map(s => s.sentences.id),
      videoDirty: projectSentences
        .filter(s => s.sentences.isVideoDirty)
        .map(s => s.sentences.id),
    };
  }
}

export const dependencyService = new DependencyService();
```

### Update Sentence API

```typescript
// In sentences API endpoint
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { text, imagePrompt, videoPrompt, ...otherFields } = req.body;

  // Get current sentence to compare
  const current = await db.select().from(sentences).where(eq(sentences.id, id)).get();
  if (!current) {
    return res.status(404).json({ error: 'Sentence not found' });
  }

  // Get project ID for broadcasting
  const section = await db.select().from(sections).where(eq(sections.id, current.sectionId)).get();
  const projectId = section?.projectId;

  // Update sentence
  await db.update(sentences).set({
    text: text ?? current.text,
    imagePrompt: imagePrompt ?? current.imagePrompt,
    videoPrompt: videoPrompt ?? current.videoPrompt,
    ...otherFields,
    updatedAt: new Date(),
  }).where(eq(sentences.id, id));

  // Mark dirty based on what changed
  if (text && text !== current.text && projectId) {
    await dependencyService.onTextChanged(id, projectId);
  }

  if (imagePrompt && imagePrompt !== current.imagePrompt && projectId) {
    await dependencyService.onImagePromptChanged(id, projectId);
  }

  if (videoPrompt && videoPrompt !== current.videoPrompt && projectId) {
    await dependencyService.onVideoPromptChanged(id, projectId);
  }

  const updated = await db.select().from(sentences).where(eq(sentences.id, id)).get();
  res.json(updated);
});
```

### Update Job Completion Handlers

```typescript
// In audio generation completion handler
await step.run('clear-dirty-flag', async () => {
  await dependencyService.clearDirtyFlag(sentenceId, projectId, 'isAudioDirty');
});

// In image generation completion handler
await step.run('mark-video-dirty', async () => {
  await dependencyService.onImageRegenerated(sentenceId, projectId);
});

// In video generation completion handler
await step.run('clear-dirty-flag', async () => {
  await dependencyService.clearDirtyFlag(sentenceId, projectId, 'isVideoDirty');
});
```

### Frontend Dirty Indicators

```tsx
// In SceneRow.tsx or similar
function DirtyIndicator({ sentence }: { sentence: Sentence }) {
  const hasDirty = sentence.isAudioDirty || sentence.isImageDirty || sentence.isVideoDirty;

  if (!hasDirty) return null;

  return (
    <div className="flex gap-1">
      {sentence.isAudioDirty && (
        <span className="text-xs px-1 bg-yellow-100 text-yellow-700 rounded" title="Audio needs regeneration">
          🔊
        </span>
      )}
      {sentence.isImageDirty && (
        <span className="text-xs px-1 bg-yellow-100 text-yellow-700 rounded" title="Image needs regeneration">
          🖼️
        </span>
      )}
      {sentence.isVideoDirty && (
        <span className="text-xs px-1 bg-yellow-100 text-yellow-700 rounded" title="Video needs regeneration">
          🎬
        </span>
      )}
    </div>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-008: Project CRUD API (database structure)
- STORY-007: WebSocket Progress Server (broadcasting)

**Blocked Stories:**
- STORY-032: Sentence Edit Regeneration
- STORY-033: Prompt Edit Regeneration

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Dirty flag setting
  - [ ] Cascade logic
  - [ ] Clear on regeneration
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Database migration created
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of dirty flow

---

## Story Points Breakdown

- **Schema updates:** 0.5 points
- **Dependency service:** 1.5 points
- **API integration:** 0.5 points
- **Frontend indicators:** 0.5 points
- **Total:** 3 points

**Rationale:** Core dirty flag logic is straightforward. Main complexity is ensuring all edit paths correctly mark dependencies.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
