import { Router } from 'express';
import { db, projects, sections, sentences, projectCast, characters, scriptOutlines, generationJobs, type NewProject } from '../db/index.js';
import { eq, desc, sql, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createProjectSchema, updateProjectSchema, addToCastSchema, addToCastBatchSchema } from '../validation/schemas.js';
import { deleteProjectMedia } from '../services/outputPaths.js';

export const projectsRouter = Router();

// GET /api/v1/projects - List all projects with section/sentence counts
projectsRouter.get('/', async (req, res, next) => {
  try {
    // Get all projects sorted by updatedAt descending (most recent first)
    const allProjects = await db.select().from(projects).orderBy(desc(projects.updatedAt));

    // Get counts for each project
    const projectsWithCounts = await Promise.all(
      allProjects.map(async (project) => {
        // Count sections
        const sectionCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(sections)
          .where(eq(sections.projectId, project.id));
        const sectionCount = sectionCountResult[0]?.count ?? 0;

        // Count sentences (via sections)
        const sentenceCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(sentences)
          .innerJoin(sections, eq(sentences.sectionId, sections.id))
          .where(eq(sections.projectId, project.id));
        const sentenceCount = sentenceCountResult[0]?.count ?? 0;

        return {
          ...project,
          sectionCount,
          sentenceCount,
        };
      })
    );

    res.json({
      success: true,
      data: {
        projects: projectsWithCounts,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects - Create a new project
projectsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const newProject: NewProject = {
      id: nanoid(),
      name: parsed.data.name,
      topic: parsed.data.topic,
      targetDuration: parsed.data.targetDuration ?? 8,
      visualStyle: parsed.data.visualStyle ?? 'cinematic',
      voiceId: parsed.data.voiceId ?? 'puck',
      status: 'draft',
    };

    await db.insert(projects).values(newProject);

    const created = await db.select().from(projects).where(eq(projects.id, newProject.id)).get();

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/projects/:id - Get project with sections and sentences
projectsRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await db.select().from(projects).where(eq(projects.id, id)).get();

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    // Get sections with their sentences
    const projectSections = await db.select().from(sections)
      .where(eq(sections.projectId, id))
      .orderBy(sections.order);

    const sectionsWithSentences = await Promise.all(
      projectSections.map(async (section) => {
        const sectionSentences = await db.select().from(sentences)
          .where(eq(sentences.sectionId, section.id))
          .orderBy(sentences.order);

        return {
          ...section,
          sentences: sectionSentences,
        };
      })
    );

    // Get project cast
    // Get project cast with full details
    const cast = await db.select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      referenceImages: characters.referenceImages,
      styleLora: characters.styleLora,
      createdAt: characters.createdAt,
    })
      .from(projectCast)
      .innerJoin(characters, eq(projectCast.characterId, characters.id))
      .where(eq(projectCast.projectId, id));

    res.json({
      success: true,
      data: {
        ...project,
        sections: sectionsWithSentences,
        cast,
      },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/projects/:id - Update project metadata
projectsRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const existing = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    await db.update(projects)
      .set({
        ...parsed.data,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id));

    const updated = await db.select().from(projects).where(eq(projects.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/cast - Add character to cast
projectsRouter.post('/:id/cast', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = addToCastSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { characterId } = parsed.data;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    // Verify character exists
    const character = await db.select().from(characters).where(eq(characters.id, characterId)).get();
    if (!character) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Character not found' } });
    }

    // Check if already in cast
    const existing = await db.select().from(projectCast)
      .where(and(eq(projectCast.projectId, id), eq(projectCast.characterId, characterId)))
      .get();

    if (existing) {
      return res.status(400).json({ success: false, error: { code: 'DUPLICATE', message: 'Character already in cast' } });
    }

    // Add to cast
    await db.insert(projectCast).values({ projectId: id, characterId });

    // Return updated cast list
    const updatedCast = await db.select({
      id: characters.id,
      name: characters.name,
      description: characters.description,
      referenceImages: characters.referenceImages,
      styleLora: characters.styleLora,
      createdAt: characters.createdAt,
    })
      .from(projectCast)
      .innerJoin(characters, eq(projectCast.characterId, characters.id))
      .where(eq(projectCast.projectId, id));

    res.status(201).json({
      success: true,
      data: updatedCast,
      message: 'Character added to cast'
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/cast/batch - Add multiple characters to cast
projectsRouter.post('/:id/cast/batch', async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = addToCastBatchSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { characterIds } = parsed.data;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    const added: string[] = [];
    const skipped: string[] = [];

    for (const charId of characterIds) {
      // Check existence
      const character = await db.select().from(characters).where(eq(characters.id, charId)).get();
      if (!character) {
        continue;
      }

      // Check duplicate
      const existing = await db.select().from(projectCast)
        .where(and(eq(projectCast.projectId, id), eq(projectCast.characterId, charId)))
        .get();

      if (!existing) {
        await db.insert(projectCast).values({ projectId: id, characterId: charId });
        added.push(charId);
      } else {
        skipped.push(charId);
      }
    }

    res.status(201).json({
      success: true,
      data: { added, skipped },
      message: `${added.length} characters added to cast`
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/projects/:id/cast/:characterId - Remove character from cast
projectsRouter.delete('/:id/cast/:characterId', async (req, res, next) => {
  try {
    const { id, characterId } = req.params;

    // Check if it exists in cast
    const existing = await db.select().from(projectCast)
      .where(and(eq(projectCast.projectId, id), eq(projectCast.characterId, characterId)))
      .get();

    if (!existing) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Character not in cast' } });
    }

    await db.delete(projectCast)
      .where(and(eq(projectCast.projectId, id), eq(projectCast.characterId, characterId)));

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/projects/:id - Delete project and all assets
projectsRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate project ID format to prevent path traversal attacks
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID',
          message: 'Invalid project ID format',
        },
      });
    }

    const existing = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      });
    }

    // Delete project (cascades to sections, sentences, cast, script_outlines, generation_jobs
    // due to foreign key constraints with onDelete: 'cascade')
    await db.delete(projects).where(eq(projects.id, id));

    // Delete associated files from filesystem
    await deleteProjectMedia(id);

    // Return 204 No Content on successful delete
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
