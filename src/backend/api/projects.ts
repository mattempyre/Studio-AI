import { Router } from 'express';
import { db, projects, sections, sentences, projectCast, characters, scriptOutlines, generationJobs, type NewProject } from '../db/index.js';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createProjectSchema, updateProjectSchema, addToCastSchema, addToCastBatchSchema } from '../validation/schemas.js';
import { deleteProjectMedia } from '../services/outputPaths.js';
import { inngest } from '../inngest/client.js';
import { jobService } from '../services/jobService.js';

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
      voiceId: parsed.data.voiceId ?? 'Emily',
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

// POST /api/v1/projects/:id/mark-audio-dirty - Mark sentences as needing audio regeneration
// Optional body: { sectionId } to mark only a specific section
projectsRouter.post('/:id/mark-audio-dirty', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sectionId } = req.body; // Optional: specific section

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    let sectionIds: string[];

    if (sectionId) {
      // Mark specific section only
      const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
      if (!section) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Section not found' },
        });
      }
      sectionIds = [sectionId];
    } else {
      // Mark all sections in the project
      const projectSections = await db.select()
        .from(sections)
        .where(eq(sections.projectId, id));

      if (projectSections.length === 0) {
        return res.json({
          success: true,
          data: { markedCount: 0, message: 'Project has no sections' },
        });
      }

      sectionIds = projectSections.map(s => s.id);
    }

    // Mark sentences in the target sections as audio dirty
    await db.update(sentences)
      .set({ isAudioDirty: true })
      .where(inArray(sentences.sectionId, sectionIds));

    // Count affected sentences
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(sentences)
      .where(inArray(sentences.sectionId, sectionIds));
    const markedCount = countResult[0]?.count ?? 0;

    res.json({
      success: true,
      data: {
        markedCount,
        sectionId: sectionId || null,
        message: sectionId
          ? `Marked ${markedCount} sentences in section for audio regeneration`
          : `Marked ${markedCount} sentences for audio regeneration`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/generate-audio - Queue audio generation for all dirty sentences
projectsRouter.post('/:id/generate-audio', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get all dirty sentences for this project (via sections)
    const projectSections = await db.select()
      .from(sections)
      .where(eq(sections.projectId, id));

    if (projectSections.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_SECTIONS', message: 'Project has no sections' },
      });
    }

    const sectionIds = projectSections.map(s => s.id);

    // Get all sentences that are dirty (need audio regeneration)
    const dirtySentences = await db.select()
      .from(sentences)
      .where(and(
        inArray(sentences.sectionId, sectionIds),
        eq(sentences.isAudioDirty, true)
      ))
      .orderBy(sentences.order);

    if (dirtySentences.length === 0) {
      return res.json({
        success: true,
        data: {
          queued: 0,
          message: 'All sentences already have up-to-date audio',
        },
      });
    }

    // Filter out sentences with empty text
    const validSentences = dirtySentences.filter(s => s.text && s.text.trim().length > 0);

    if (validSentences.length === 0) {
      return res.json({
        success: true,
        data: {
          queued: 0,
          message: 'No sentences with text to generate audio for',
        },
      });
    }

    // Queue audio/generate events for each dirty sentence
    const queuedJobs: { sentenceId: string; jobId: string }[] = [];

    for (const sentence of validSentences) {
      // Create job record for tracking
      const job = await jobService.create({
        sentenceId: sentence.id,
        projectId: id,
        jobType: 'audio',
      });

      // Queue the Inngest event
      await inngest.send({
        name: 'audio/generate',
        data: {
          sentenceId: sentence.id,
          projectId: id,
          text: sentence.text,
          voiceId: project.voiceId || 'Emily',
        },
      });

      queuedJobs.push({ sentenceId: sentence.id, jobId: job.id });
    }

    res.json({
      success: true,
      data: {
        queued: queuedJobs.length,
        total: dirtySentences.length,
        jobs: queuedJobs,
        message: `Queued ${queuedJobs.length} audio generation jobs`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/generate-section-audio - Queue section-based audio generation (batch mode with Whisper)
projectsRouter.post('/:id/generate-section-audio', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sectionId } = req.body; // Optional: specific section, or all sections if not provided

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get sections to process
    let sectionsToProcess;
    if (sectionId) {
      // Process specific section
      const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
      if (!section) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Section not found' },
        });
      }
      sectionsToProcess = [section];
    } else {
      // Process all sections in the project
      sectionsToProcess = await db.select()
        .from(sections)
        .where(eq(sections.projectId, id))
        .orderBy(sections.order);
    }

    if (sectionsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_SECTIONS', message: 'Project has no sections' },
      });
    }

    // Queue section audio generation jobs
    const queuedSections: { sectionId: string; jobId: string; sentenceCount: number }[] = [];

    for (const section of sectionsToProcess) {
      // Get dirty sentences for this section
      const dirtySentences = await db.select()
        .from(sentences)
        .where(and(
          eq(sentences.sectionId, section.id),
          eq(sentences.isAudioDirty, true)
        ))
        .orderBy(sentences.order);

      // Filter out empty sentences
      const validSentences = dirtySentences.filter(s => s.text && s.text.trim().length > 0);

      if (validSentences.length === 0) {
        continue; // Skip sections with no dirty sentences
      }

      // Create job record for tracking
      const job = await jobService.create({
        projectId: id,
        jobType: 'audio',
      });

      // Queue the section audio generation event
      await inngest.send({
        name: 'audio/generate-section',
        data: {
          sectionId: section.id,
          projectId: id,
          voiceId: project.voiceId || 'Emily',
          sentenceTexts: validSentences.map(s => ({
            sentenceId: s.id,
            text: s.text,
            order: s.order,
          })),
        },
      });

      queuedSections.push({
        sectionId: section.id,
        jobId: job.id,
        sentenceCount: validSentences.length,
        sentenceIds: validSentences.map(s => s.id),
      });
    }

    if (queuedSections.length === 0) {
      return res.json({
        success: true,
        data: {
          queued: 0,
          message: 'All sections already have up-to-date audio',
        },
      });
    }

    const totalSentences = queuedSections.reduce((sum, s) => sum + s.sentenceCount, 0);

    res.json({
      success: true,
      data: {
        queued: queuedSections.length,
        totalSentences,
        sections: queuedSections,
        message: `Queued ${queuedSections.length} section(s) with ${totalSentences} sentences for batch audio generation`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/cancel-audio - Cancel queued audio generation jobs
projectsRouter.post('/:id/cancel-audio', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get all queued audio jobs for this project
    const queuedJobs = await db.select()
      .from(generationJobs)
      .where(and(
        eq(generationJobs.projectId, id),
        eq(generationJobs.jobType, 'audio'),
        eq(generationJobs.status, 'queued')
      ));

    if (queuedJobs.length === 0) {
      return res.json({
        success: true,
        data: {
          cancelled: 0,
          message: 'No queued jobs to cancel',
        },
      });
    }

    // Mark all queued jobs as cancelled (using 'failed' status with cancel message)
    const cancelledIds: string[] = [];

    for (const job of queuedJobs) {
      await jobService.markFailed(job.id, 'Cancelled by user');
      cancelledIds.push(job.id);
    }

    res.json({
      success: true,
      data: {
        cancelled: cancelledIds.length,
        jobIds: cancelledIds,
        message: `Cancelled ${cancelledIds.length} queued jobs`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/retroactive-audio-alignment - Align existing section audio to get word timings
projectsRouter.post('/:id/retroactive-audio-alignment', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sectionId } = req.body; // Optional: specific section, or all sections if not provided

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get sections to process
    let sectionsToProcess;
    if (sectionId) {
      // Process specific section
      const section = await db.select().from(sections).where(eq(sections.id, sectionId)).get();
      if (!section) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Section not found' },
        });
      }
      sectionsToProcess = [section];
    } else {
      // Process all sections in the project
      sectionsToProcess = await db.select()
        .from(sections)
        .where(eq(sections.projectId, id))
        .orderBy(sections.order);
    }

    if (sectionsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_SECTIONS', message: 'Project has no sections' },
      });
    }

    // Queue retroactive alignment jobs for sections with audio but missing wordTimings
    const queuedSections: { sectionId: string; jobId: string; sentenceCount: number }[] = [];

    for (const section of sectionsToProcess) {
      // Get sentences for this section that have sectionAudioFile but no wordTimings
      const sentencesNeedingAlignment = await db.select()
        .from(sentences)
        .where(eq(sentences.sectionId, section.id))
        .orderBy(sentences.order);

      // Filter to sentences that have audio but need word timing alignment
      const sentencesWithAudioNoTimings = sentencesNeedingAlignment.filter(s =>
        s.sectionAudioFile && // Has section audio file
        (!s.wordTimings || (Array.isArray(s.wordTimings) && s.wordTimings.length === 0)) && // No word timings
        s.text && s.text.trim().length > 0 // Has text to align
      );

      if (sentencesWithAudioNoTimings.length === 0) {
        continue; // Skip sections that don't need alignment
      }

      // Get the audio file path (should be the same for all sentences in the section)
      const audioFile = sentencesWithAudioNoTimings[0].sectionAudioFile!;

      // Create job record for tracking
      const job = await jobService.create({
        projectId: id,
        jobType: 'audio',
      });

      // Queue the retroactive alignment event
      await inngest.send({
        name: 'audio/retroactive-align',
        data: {
          sectionId: section.id,
          projectId: id,
          audioFile,
          sentenceTexts: sentencesNeedingAlignment
            .filter(s => s.text && s.text.trim().length > 0)
            .map(s => ({
              sentenceId: s.id,
              text: s.text,
              order: s.order,
            })),
        },
      });

      queuedSections.push({
        sectionId: section.id,
        jobId: job.id,
        sentenceCount: sentencesWithAudioNoTimings.length,
      });
    }

    if (queuedSections.length === 0) {
      return res.json({
        success: true,
        data: {
          queued: 0,
          message: 'No sections need retroactive audio alignment (all sentences already have word timings or no audio)',
        },
      });
    }

    const totalSentences = queuedSections.reduce((sum, s) => sum + s.sentenceCount, 0);

    res.json({
      success: true,
      data: {
        queued: queuedSections.length,
        totalSentences,
        sections: queuedSections,
        message: `Queued ${queuedSections.length} section(s) with ${totalSentences} sentences for retroactive audio alignment`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/projects/:id/scene-stats - Get scene generation statistics
// Used by BulkGenerationToolbar to determine button state (Generate vs Re-Generate)
projectsRouter.get('/:id/scene-stats', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get all sections for this project
    const projectSections = await db.select()
      .from(sections)
      .where(eq(sections.projectId, id));

    if (projectSections.length === 0) {
      return res.json({
        success: true,
        data: {
          totalSentences: 0,
          withImages: 0,
          withVideos: 0,
          needingImages: 0,
          needingVideos: 0,
        },
      });
    }

    const sectionIds = projectSections.map(s => s.id);

    // Get all sentences
    const allSentences = await db.select()
      .from(sentences)
      .where(inArray(sentences.sectionId, sectionIds));

    // Calculate stats
    const withImages = allSentences.filter(s => s.imageFile && !s.isImageDirty).length;
    const withVideos = allSentences.filter(s => s.videoFile && !s.isVideoDirty).length;
    const needingImages = allSentences.filter(s =>
      s.imagePrompt && s.imagePrompt.trim().length > 0 &&
      (!s.imageFile || s.isImageDirty)
    ).length;
    const needingVideos = allSentences.filter(s =>
      s.imageFile &&
      s.videoPrompt && s.videoPrompt.trim().length > 0 &&
      (!s.videoFile || s.isVideoDirty)
    ).length;

    res.json({
      success: true,
      data: {
        totalSentences: allSentences.length,
        withImages,
        withVideos,
        needingImages,
        needingVideos,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/generate-scenes - Queue bulk image generation
// STORY-4-4: Bulk Scene Generation
// Note: Videos are generated separately via /generate-videos after image review
projectsRouter.post('/:id/generate-scenes', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { includeVideos = false, force = false } = req.body; // includeVideos: false by default (use /generate-videos instead)

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get all sections for this project
    const projectSections = await db.select()
      .from(sections)
      .where(eq(sections.projectId, id))
      .orderBy(sections.order);

    if (projectSections.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_SECTIONS', message: 'Project has no sections' },
      });
    }

    const sectionIds = projectSections.map(s => s.id);

    // Get all sentences with their prompts and file status
    let allSentences = await db.select()
      .from(sentences)
      .where(inArray(sentences.sectionId, sectionIds))
      .orderBy(sentences.order);

    // If force=true, mark all sentences with prompts as dirty to force regeneration
    if (force) {
      const sentenceIdsToMarkDirty = allSentences
        .filter(s => s.imagePrompt && s.imagePrompt.trim().length > 0)
        .map(s => s.id);

      if (sentenceIdsToMarkDirty.length > 0) {
        await db.update(sentences)
          .set({ isImageDirty: true, isVideoDirty: true })
          .where(inArray(sentences.id, sentenceIdsToMarkDirty));

        // Re-fetch sentences to get updated dirty flags
        allSentences = await db.select()
          .from(sentences)
          .where(inArray(sentences.sectionId, sectionIds))
          .orderBy(sentences.order);
      }
    }

    // Sentences needing images: have imagePrompt but no imageFile (or isImageDirty)
    const sentencesNeedingImages = allSentences.filter(s =>
      s.imagePrompt && s.imagePrompt.trim().length > 0 &&
      (!s.imageFile || s.isImageDirty)
    );

    // Sentences needing videos: have imageFile, videoPrompt, but no videoFile (or isVideoDirty)
    const sentencesNeedingVideos = includeVideos ? allSentences.filter(s =>
      s.imageFile &&
      s.videoPrompt && s.videoPrompt.trim().length > 0 &&
      (!s.videoFile || s.isVideoDirty)
    ) : [];

    if (sentencesNeedingImages.length === 0 && sentencesNeedingVideos.length === 0) {
      return res.json({
        success: true,
        data: {
          queued: { images: 0, videos: 0 },
          message: 'All scenes already have up-to-date images and videos',
        },
      });
    }

    // Group sentences by (modelId, styleId) for batch processing
    // This minimizes ComfyUI model reloads by processing all images with same model together
    const modelId = project.modelId || 'default';
    const styleId = project.styleId || 'default';
    const batchKey = `${modelId}:${styleId}`;

    // For now, all sentences in a project use the same model/style, so we have one batch
    // Future: could support per-sentence model overrides by grouping differently
    const batchGroups = new Map<string, typeof sentencesNeedingImages>();
    batchGroups.set(batchKey, sentencesNeedingImages);

    // Queue batch image generation jobs
    const imageJobs: { sentenceId: string; batchId: string }[] = [];
    const batchJobs: { batchId: string; modelId: string; styleId: string; count: number }[] = [];

    for (const [key, groupSentences] of batchGroups) {
      if (groupSentences.length === 0) continue;

      const [groupModelId, groupStyleId] = key.split(':');
      const batchId = nanoid();

      // Create batch job record for tracking
      const batchJob = await jobService.create({
        projectId: id,
        jobType: 'image-batch',
      });

      // Queue the batch Inngest event
      await inngest.send({
        name: 'image/generate-batch',
        data: {
          batchId: batchJob.id,
          projectId: id,
          modelId: groupModelId,
          styleId: groupStyleId,
          sentences: groupSentences.map(s => ({
            sentenceId: s.id,
            prompt: s.imagePrompt!,
          })),
        },
      });

      // Track all sentences in this batch
      for (const sentence of groupSentences) {
        imageJobs.push({ sentenceId: sentence.id, batchId: batchJob.id });
      }

      batchJobs.push({
        batchId: batchJob.id,
        modelId: groupModelId,
        styleId: groupStyleId,
        count: groupSentences.length,
      });
    }

    // Queue video generation jobs (will run after images complete due to dependency)
    const videoJobs: { sentenceId: string; jobId: string }[] = [];

    for (const sentence of sentencesNeedingVideos) {
      // Create job record for tracking
      const job = await jobService.create({
        sentenceId: sentence.id,
        projectId: id,
        jobType: 'video',
      });

      // Queue the Inngest event
      await inngest.send({
        name: 'video/generate',
        data: {
          sentenceId: sentence.id,
          projectId: id,
          imageFile: sentence.imageFile!,
          prompt: sentence.videoPrompt!,
          cameraMovement: sentence.cameraMovement || 'static',
          motionStrength: sentence.motionStrength || 0.5,
        },
      });

      videoJobs.push({ sentenceId: sentence.id, jobId: job.id });
    }

    res.json({
      success: true,
      data: {
        queued: {
          images: imageJobs.length,
          videos: videoJobs.length,
          batches: batchJobs.length,
        },
        totalSentences: allSentences.length,
        batchJobs,  // Model-aware batch info
        imageJobs,  // Per-sentence tracking (for UI progress)
        videoJobs,
        message: `Queued ${batchJobs.length} image batch(es) with ${imageJobs.length} total images and ${videoJobs.length} video jobs`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/generate-videos - Queue bulk video generation for sentences with images
// STORY-5-1: Video Generation Job
// Requires: sentences must have imageFile and videoPrompt
projectsRouter.post('/:id/generate-videos', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sentenceIds, force = false } = req.body; // sentenceIds: optional array to limit scope

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get all sections for this project
    const projectSections = await db.select()
      .from(sections)
      .where(eq(sections.projectId, id))
      .orderBy(sections.order);

    if (projectSections.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_SECTIONS', message: 'Project has no sections' },
      });
    }

    const sectionIds = projectSections.map(s => s.id);

    // Get all sentences
    let allSentences = await db.select()
      .from(sentences)
      .where(inArray(sentences.sectionId, sectionIds))
      .orderBy(sentences.order);

    // Filter to specific sentences if provided
    if (sentenceIds && Array.isArray(sentenceIds) && sentenceIds.length > 0) {
      allSentences = allSentences.filter(s => sentenceIds.includes(s.id));
    }

    // If force=true, mark matching sentences as video dirty
    if (force) {
      const sentenceIdsToMarkDirty = allSentences
        .filter(s => s.imageFile && s.videoPrompt && s.videoPrompt.trim().length > 0)
        .map(s => s.id);

      if (sentenceIdsToMarkDirty.length > 0) {
        await db.update(sentences)
          .set({ isVideoDirty: true })
          .where(inArray(sentences.id, sentenceIdsToMarkDirty));

        // Re-fetch sentences to get updated dirty flags
        allSentences = await db.select()
          .from(sentences)
          .where(inArray(sentences.sectionId, sectionIds))
          .orderBy(sentences.order);

        if (sentenceIds && Array.isArray(sentenceIds) && sentenceIds.length > 0) {
          allSentences = allSentences.filter(s => sentenceIds.includes(s.id));
        }
      }
    }

    // Sentences eligible for video generation:
    // - Must have imageFile (source for i2v)
    // - Must have videoPrompt
    // - Either no videoFile or isVideoDirty=true
    const sentencesNeedingVideos = allSentences.filter(s =>
      s.imageFile &&
      s.videoPrompt && s.videoPrompt.trim().length > 0 &&
      (!s.videoFile || s.isVideoDirty)
    );

    if (sentencesNeedingVideos.length === 0) {
      return res.json({
        success: true,
        data: {
          queued: 0,
          message: 'No sentences need video generation (check that images and video prompts exist)',
        },
      });
    }

    // Queue video generation jobs
    const videoJobs: { sentenceId: string; jobId: string }[] = [];

    for (const sentence of sentencesNeedingVideos) {
      // Create job record for tracking
      const job = await jobService.create({
        sentenceId: sentence.id,
        projectId: id,
        jobType: 'video',
      });

      // Queue the Inngest event
      await inngest.send({
        name: 'video/generate',
        data: {
          sentenceId: sentence.id,
          projectId: id,
          imageFile: sentence.imageFile!,
          prompt: sentence.videoPrompt!,
          cameraMovement: sentence.cameraMovement || 'static',
          motionStrength: sentence.motionStrength || 0.5,
        },
      });

      videoJobs.push({ sentenceId: sentence.id, jobId: job.id });
    }

    res.json({
      success: true,
      data: {
        queued: videoJobs.length,
        totalEligible: sentencesNeedingVideos.length,
        videoJobs,
        message: `Queued ${videoJobs.length} video generation jobs`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/cancel-scenes - Cancel queued scene generation jobs
// STORY-4-4: Bulk Scene Generation
projectsRouter.post('/:id/cancel-scenes', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get all queued image and video jobs for this project
    const queuedJobs = await db.select()
      .from(generationJobs)
      .where(and(
        eq(generationJobs.projectId, id),
        inArray(generationJobs.jobType, ['image', 'video']),
        eq(generationJobs.status, 'queued')
      ));

    if (queuedJobs.length === 0) {
      return res.json({
        success: true,
        data: {
          cancelled: { images: 0, videos: 0 },
          message: 'No queued jobs to cancel',
        },
      });
    }

    // Mark all queued jobs as cancelled
    const cancelledImages: string[] = [];
    const cancelledVideos: string[] = [];

    for (const job of queuedJobs) {
      await jobService.markFailed(job.id, 'Cancelled by user');
      if (job.jobType === 'image') {
        cancelledImages.push(job.id);
      } else {
        cancelledVideos.push(job.id);
      }
    }

    res.json({
      success: true,
      data: {
        cancelled: {
          images: cancelledImages.length,
          videos: cancelledVideos.length,
        },
        jobIds: [...cancelledImages, ...cancelledVideos],
        message: `Cancelled ${cancelledImages.length} image and ${cancelledVideos.length} video jobs`,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:id/retry-failed-scenes - Retry failed scene generation jobs
// STORY-4-4: Bulk Scene Generation (AC: 9)
projectsRouter.post('/:id/retry-failed-scenes', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sentenceIds } = req.body; // Optional: specific sentences to retry

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Get all sections for this project
    const projectSections = await db.select()
      .from(sections)
      .where(eq(sections.projectId, id));

    const sectionIds = projectSections.map(s => s.id);

    // Get sentences with failed status
    let failedSentences = await db.select()
      .from(sentences)
      .where(and(
        inArray(sentences.sectionId, sectionIds),
        eq(sentences.status, 'failed')
      ));

    // Filter to specific sentences if provided
    if (sentenceIds && sentenceIds.length > 0) {
      failedSentences = failedSentences.filter(s => sentenceIds.includes(s.id));
    }

    if (failedSentences.length === 0) {
      return res.json({
        success: true,
        data: {
          retried: 0,
          message: 'No failed sentences to retry',
        },
      });
    }

    // Retry image generation for sentences with imagePrompt
    const retriedJobs: { sentenceId: string; jobId: string; jobType: string }[] = [];

    for (const sentence of failedSentences) {
      // Reset sentence status
      await db.update(sentences)
        .set({ status: 'pending', updatedAt: new Date() })
        .where(eq(sentences.id, sentence.id));

      // Queue image generation if needed
      if (sentence.imagePrompt && (!sentence.imageFile || sentence.isImageDirty)) {
        const job = await jobService.create({
          sentenceId: sentence.id,
          projectId: id,
          jobType: 'image',
        });

        await inngest.send({
          name: 'image/generate',
          data: {
            sentenceId: sentence.id,
            projectId: id,
            prompt: sentence.imagePrompt,
            modelId: project.modelId || undefined,
            styleId: project.styleId || undefined,
          },
        });

        retriedJobs.push({ sentenceId: sentence.id, jobId: job.id, jobType: 'image' });
      }
      // Queue video generation if has image but no video
      else if (sentence.imageFile && sentence.videoPrompt && (!sentence.videoFile || sentence.isVideoDirty)) {
        const job = await jobService.create({
          sentenceId: sentence.id,
          projectId: id,
          jobType: 'video',
        });

        await inngest.send({
          name: 'video/generate',
          data: {
            sentenceId: sentence.id,
            projectId: id,
            imageFile: sentence.imageFile,
            prompt: sentence.videoPrompt,
            cameraMovement: sentence.cameraMovement || 'static',
            motionStrength: sentence.motionStrength || 0.5,
          },
        });

        retriedJobs.push({ sentenceId: sentence.id, jobId: job.id, jobType: 'video' });
      }
    }

    res.json({
      success: true,
      data: {
        retried: retriedJobs.length,
        jobs: retriedJobs,
        message: `Retried ${retriedJobs.length} failed jobs`,
      },
    });
  } catch (error) {
    next(error);
  }
});
