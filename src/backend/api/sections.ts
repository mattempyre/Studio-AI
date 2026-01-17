import { Router } from 'express';
import { db, sections, sentences, projects } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { createSectionSchema, updateSectionSchema } from '../validation/schemas.js';
import { getDeepseekClient } from '../clients/deepseek.js';

export const sectionsRouter = Router();

// GET /api/v1/sections/:id - Get a single section with its sentences
sectionsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const section = await db.select().from(sections).where(eq(sections.id, id)).get();

    if (!section) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Section not found',
        },
      });
    }

    // Get sentences for this section
    const sectionSentences = await db
      .select()
      .from(sentences)
      .where(eq(sentences.sectionId, id))
      .orderBy(asc(sentences.order));

    res.json({
      success: true,
      data: {
        ...section,
        sentences: sectionSentences,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sections - Create a new section
sectionsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createSectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, parsed.data.projectId)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    const newSection = {
      id: nanoid(),
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      order: parsed.data.order,
    };

    await db.insert(sections).values(newSection);

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, parsed.data.projectId));

    const created = await db.select().from(sections).where(eq(sections.id, newSection.id)).get();

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/sections/:id - Update section (title, order)
sectionsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const parsed = updateSectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const existing = await db.select().from(sections).where(eq(sections.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Section not found',
        },
      });
    }

    await db.update(sections).set(parsed.data).where(eq(sections.id, id));

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, existing.projectId));

    const updated = await db.select().from(sections).where(eq(sections.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/sections/:id - Delete a section and its sentences
sectionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(sections).where(eq(sections.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Section not found',
        },
      });
    }

    // Delete section (sentences cascade delete due to foreign key)
    await db.delete(sections).where(eq(sections.id, id));

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, existing.projectId));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sections/reorder - Reorder sections within a project
sectionsRouter.post('/reorder', async (req, res, next) => {
  try {
    const { projectId, sectionIds } = req.body;

    if (!projectId || !Array.isArray(sectionIds)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'projectId and sectionIds array are required',
        },
      });
    }

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    // Update order for each section
    for (let i = 0; i < sectionIds.length; i++) {
      await db.update(sections).set({ order: i }).where(eq(sections.id, sectionIds[i]));
    }

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));

    res.json({
      success: true,
      message: 'Sections reordered successfully',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// AI Section Expansion
// =============================================================================

const aiExpandSchema = z.object({
  mode: z.enum(['quick', 'guided']),
  prompt: z.string().optional(),
  sentenceCount: z.number().int().min(1).max(5).default(2),
  insertAfterSentenceId: z.string().optional(), // null/undefined = end of section
});

/**
 * POST /api/v1/sections/:id/ai-expand
 * Generate new sentences for a section using AI.
 * Supports quick (automatic) and guided (user-prompted) modes.
 */
sectionsRouter.post('/:id/ai-expand', async (req, res, next) => {
  try {
    const { id: sectionId } = req.params;

    // Validate request body
    const parsed = aiExpandSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { mode, prompt, sentenceCount, insertAfterSentenceId } = parsed.data;

    // Verify section exists and get its data
    const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
    if (!section) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Section not found' },
      });
    }

    // Get the project for context
    const project = await db.select().from(projects).where(eq(projects.id, section.projectId)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get existing sentences in this section
    const existingSentences = await db
      .select()
      .from(sentences)
      .where(eq(sentences.sectionId, sectionId))
      .orderBy(asc(sentences.order));

    const existingTexts = existingSentences.map(s => s.text);

    // Determine insertion index
    let insertAfterIndex: number | undefined;
    if (insertAfterSentenceId) {
      const targetIndex = existingSentences.findIndex(s => s.id === insertAfterSentenceId);
      if (targetIndex !== -1) {
        insertAfterIndex = targetIndex;
      }
    }

    // Call Deepseek to generate sentences
    const client = getDeepseekClient();
    const result = await client.expandSection({
      sectionTitle: section.title,
      existingSentences: existingTexts,
      projectTopic: project.topic || project.name || 'Untitled Project',
      visualStyle: project.visualStyle || 'cinematic',
      mode,
      userPrompt: prompt,
      sentenceCount,
      insertAfterIndex,
    });

    // Return the generated sentences for preview (don't save yet)
    res.json({
      success: true,
      data: {
        sectionId,
        sectionTitle: section.title,
        generatedSentences: result.sentences,
        insertPosition: insertAfterIndex !== undefined ? insertAfterIndex + 1 : existingSentences.length,
      },
    });
  } catch (error) {
    console.error('[AI Expand] Error:', error);
    next(error);
  }
});

/**
 * POST /api/v1/sections/:id/ai-expand/accept
 * Accept and save the generated sentences from AI expansion.
 */
sectionsRouter.post('/:id/ai-expand/accept', async (req, res, next) => {
  try {
    const { id: sectionId } = req.params;
    const { generatedSentences, insertAfterSentenceId } = req.body;

    if (!Array.isArray(generatedSentences) || generatedSentences.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'generatedSentences array is required',
        },
      });
    }

    // Verify section exists
    const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
    if (!section) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Section not found' },
      });
    }

    // Get existing sentences
    const existingSentences = await db
      .select()
      .from(sentences)
      .where(eq(sentences.sectionId, sectionId))
      .orderBy(asc(sentences.order));

    // Determine insertion point
    let insertIndex = existingSentences.length;
    if (insertAfterSentenceId) {
      const targetIndex = existingSentences.findIndex(s => s.id === insertAfterSentenceId);
      if (targetIndex !== -1) {
        insertIndex = targetIndex + 1;
      }
    }

    // Shift existing sentences that come after the insertion point
    for (let i = insertIndex; i < existingSentences.length; i++) {
      const sentence = existingSentences[i];
      await db.update(sentences)
        .set({ order: sentence.order + generatedSentences.length })
        .where(eq(sentences.id, sentence.id));
    }

    // Insert the new sentences
    const newSentences = [];
    for (let i = 0; i < generatedSentences.length; i++) {
      const gen = generatedSentences[i];
      const newSentence = {
        id: nanoid(),
        sectionId,
        text: gen.text,
        order: insertIndex + i,
        imagePrompt: gen.imagePrompt || null,
        videoPrompt: gen.videoPrompt || null,
        cameraMovement: 'static' as const,
        motionStrength: 0.5,
        status: 'pending' as const,
        isAudioDirty: true,
        isImageDirty: true,
        isVideoDirty: true,
      };

      await db.insert(sentences).values(newSentence);
      newSentences.push(newSentence);
    }

    // Update project's updatedAt
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, section.projectId));

    res.status(201).json({
      success: true,
      data: {
        sectionId,
        insertedCount: newSentences.length,
        sentences: newSentences,
      },
    });
  } catch (error) {
    console.error('[AI Expand Accept] Error:', error);
    next(error);
  }
});
