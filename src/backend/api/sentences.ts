import { Router } from 'express';
import { db, sentences, sections, projects } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createSentenceSchema, updateSentenceSchema } from '../validation/schemas.js';

export const sentencesRouter = Router();

// GET /api/v1/sentences/:id - Get a single sentence
sentencesRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const sentence = await db.select().from(sentences).where(eq(sentences.id, id)).get();

    if (!sentence) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sentence not found',
        },
      });
    }

    res.json({
      success: true,
      data: sentence,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sentences - Create a new sentence
sentencesRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createSentenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    // Verify section exists
    const section = await db.select().from(sections).where(eq(sections.id, parsed.data.sectionId)).get();
    if (!section) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Section not found',
        },
      });
    }

    const newSentence = {
      id: nanoid(),
      sectionId: parsed.data.sectionId,
      text: parsed.data.text,
      order: parsed.data.order,
      imagePrompt: parsed.data.imagePrompt || null,
      videoPrompt: parsed.data.videoPrompt || null,
      cameraMovement: parsed.data.cameraMovement || 'static',
      motionStrength: parsed.data.motionStrength ?? 0.5,
      isAudioDirty: true,
      isImageDirty: true,
      isVideoDirty: true,
      status: 'pending' as const,
    };

    await db.insert(sentences).values(newSentence);

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, section.projectId));

    const created = await db.select().from(sentences).where(eq(sentences.id, newSentence.id)).get();

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/sentences/:id - Update sentence
sentencesRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const parsed = updateSentenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const existing = await db.select().from(sentences).where(eq(sentences.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sentence not found',
        },
      });
    }

    // Determine dirty flags based on what changed
    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };

    // If text changed, mark all assets as dirty
    if (parsed.data.text !== undefined && parsed.data.text !== existing.text) {
      updates.isAudioDirty = true;
      updates.isImageDirty = true;
      updates.isVideoDirty = true;
    }

    // If imagePrompt changed, mark image and video as dirty
    if (parsed.data.imagePrompt !== undefined && parsed.data.imagePrompt !== existing.imagePrompt) {
      updates.isImageDirty = true;
      updates.isVideoDirty = true;
    }

    // If videoPrompt or camera settings changed, mark video as dirty
    if (
      (parsed.data.videoPrompt !== undefined && parsed.data.videoPrompt !== existing.videoPrompt) ||
      (parsed.data.cameraMovement !== undefined && parsed.data.cameraMovement !== existing.cameraMovement) ||
      (parsed.data.motionStrength !== undefined && parsed.data.motionStrength !== existing.motionStrength)
    ) {
      updates.isVideoDirty = true;
    }

    await db.update(sentences).set(updates).where(eq(sentences.id, id));

    // Get section to update project
    const section = await db.select().from(sections).where(eq(sections.id, existing.sectionId)).get();
    if (section) {
      await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, section.projectId));
    }

    const updated = await db.select().from(sentences).where(eq(sentences.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/sentences/:id - Delete a sentence
sentencesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(sentences).where(eq(sentences.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sentence not found',
        },
      });
    }

    // Get section to update project
    const section = await db.select().from(sections).where(eq(sections.id, existing.sectionId)).get();

    await db.delete(sentences).where(eq(sentences.id, id));

    // Update project's updatedAt
    if (section) {
      await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, section.projectId));
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sentences/reorder - Reorder sentences within a section
sentencesRouter.post('/reorder', async (req, res, next) => {
  try {
    const { sectionId, sentenceIds } = req.body;

    if (!sectionId || !Array.isArray(sentenceIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sectionId and sentenceIds array are required',
        },
      });
    }

    // Verify section exists
    const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
    if (!section) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Section not found',
        },
      });
    }

    // Update order for each sentence
    for (let i = 0; i < sentenceIds.length; i++) {
      await db.update(sentences).set({ order: i, updatedAt: new Date() }).where(eq(sentences.id, sentenceIds[i]));
    }

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, section.projectId));

    res.json({
      success: true,
      message: 'Sentences reordered successfully',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sentences/:id/move - Move sentence to a different section
sentencesRouter.post('/:id/move', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetSectionId, targetOrder } = req.body;

    if (!targetSectionId || targetOrder === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'targetSectionId and targetOrder are required',
        },
      });
    }

    const existing = await db.select().from(sentences).where(eq(sentences.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sentence not found',
        },
      });
    }

    // Verify target section exists
    const targetSection = await db.select().from(sections).where(eq(sections.id, targetSectionId)).get();
    if (!targetSection) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Target section not found',
        },
      });
    }

    // Update the sentence to the new section and order
    await db.update(sentences)
      .set({ sectionId: targetSectionId, order: targetOrder, updatedAt: new Date() })
      .where(eq(sentences.id, id));

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, targetSection.projectId));

    const updated = await db.select().from(sentences).where(eq(sentences.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});
