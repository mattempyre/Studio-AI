import { Router } from 'express';
import { db, sections, sentences, projects } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createSectionSchema, updateSectionSchema } from '../validation/schemas.js';

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
