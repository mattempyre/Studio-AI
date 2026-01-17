/**
 * Script Generation API Routes
 * STORY-006: Long-Form Script Generation
 *
 * Provides endpoints for:
 * - Generating script outlines
 * - Triggering full script generation
 * - SSE progress streaming
 * - Regenerating individual sections
 */

import { Router, type Request, type Response } from 'express';
import { db, projects, scriptOutlines, generationJobs, sections, sentences, type SectionOutline } from '../db/index.js';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { inngest } from '../inngest/client.js';
import { getDeepseekClient } from '../clients/deepseek.js';
import { jobService } from '../services/jobService.js';
import { z } from 'zod';

export const scriptsRouter = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const generateOutlineSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  targetDurationMinutes: z.number().min(1).max(180, 'Duration must be between 1 and 180 minutes'),
  visualStyle: z.string().optional().default('cinematic'),
});

const generateScriptSchema = z.object({
  mode: z.enum(['auto', 'from-outline']),
  outlineId: z.string().optional(),
  topic: z.string().optional(),
  targetDurationMinutes: z.number().min(1).max(180).optional(),
  visualStyle: z.string().optional().default('cinematic'),
});

// Short-form script generation schema (STORY-009)
const generateShortScriptSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(1000, 'Topic must be under 1000 characters'),
  targetDuration: z.number().min(1, 'Duration must be at least 1 minute').max(10, 'Use long-form generation for videos over 10 minutes'),
  useSearchGrounding: z.boolean().optional().default(false),
});

const regenerateSectionSchema = z.object({
  sectionIndex: z.number().min(0),
});

// =============================================================================
// Generate Outline Only (for outline-first workflow)
// =============================================================================

/**
 * POST /api/v1/projects/:projectId/generate-outline
 * Generates an outline for review before full script generation.
 */
scriptsRouter.post('/:projectId/generate-outline', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.projectId as string;

    // Validate request body
    const parsed = generateOutlineSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { topic, targetDurationMinutes, visualStyle } = parsed.data;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Generate outline using Deepseek
    const client = getDeepseekClient();
    const generatedOutline = await client.generateOutline({
      topic,
      targetDurationMinutes,
      visualStyle,
    });

    // Save outline to database
    const outlineId = nanoid();
    const sectionOutlines: SectionOutline[] = generatedOutline.sections.map(s => ({
      index: s.index,
      title: s.title,
      description: s.description,
      targetMinutes: s.targetMinutes,
      keyPoints: s.keyPoints,
      status: 'pending' as const,
    }));

    await db.insert(scriptOutlines).values({
      id: outlineId,
      projectId,
      title: generatedOutline.title,
      topic,
      totalTargetMinutes: targetDurationMinutes,
      visualStyle,
      sections: sectionOutlines,
      status: 'draft',
      runningSummary: null,
      coveredTopics: [],
      currentSectionIndex: 0,
    });

    // Emit outline generated event
    await inngest.send({
      name: 'script/outline-generated',
      data: {
        projectId,
        outlineId,
        sectionCount: generatedOutline.sections.length,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        outlineId,
        title: generatedOutline.title,
        totalTargetMinutes: targetDurationMinutes,
        sections: sectionOutlines,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Generate Short-Form Script (STORY-009)
// =============================================================================

/**
 * POST /api/v1/projects/:projectId/generate-script-short
 * Triggers short-form script generation (<10 minutes).
 * Uses a single Deepseek API call for efficiency.
 */
scriptsRouter.post('/:projectId/generate-script-short', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.projectId as string;

    // Validate request body
    const parsed = generateShortScriptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { topic, targetDuration, useSearchGrounding } = parsed.data;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Create job record
    const job = await jobService.create({
      projectId,
      jobType: 'script',
    });

    // Trigger short-form Inngest function
    await inngest.send({
      name: 'script/generate',
      data: {
        projectId,
        topic,
        targetDuration,
        useSearch: useSearchGrounding,
      },
    });

    // Estimate generation time (~10 seconds for short scripts)
    const estimatedDurationSeconds = 10;

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        message: 'Script generation started',
        estimatedDurationSeconds,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Generate Full Script (Long-Form)
// =============================================================================

/**
 * POST /api/v1/projects/:projectId/generate-script
 * Triggers full script generation (auto mode or from existing outline).
 * For short scripts (<10 min), use /generate-script-short instead.
 */
scriptsRouter.post('/:projectId/generate-script', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.projectId as string;

    // Validate request body
    const parsed = generateScriptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { mode, outlineId, topic, targetDurationMinutes, visualStyle } = parsed.data;

    // Verify project exists
    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
    }

    // Validate mode-specific requirements
    if (mode === 'from-outline') {
      if (!outlineId) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'outlineId is required for from-outline mode' },
        });
      }

      // Verify outline exists
      const outline = await db.select().from(scriptOutlines).where(eq(scriptOutlines.id, outlineId)).get();
      if (!outline) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Outline not found' },
        });
      }

      // Mark outline as approved
      await db.update(scriptOutlines)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(scriptOutlines.id, outlineId));
    } else {
      // Auto mode requires topic and duration
      if (!topic || !targetDurationMinutes) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'topic and targetDurationMinutes are required for auto mode' },
        });
      }
    }

    // Get section count for estimate (from outline or calculate)
    let sectionCount = 1;
    if (mode === 'from-outline' && outlineId) {
      const outline = await db.select().from(scriptOutlines).where(eq(scriptOutlines.id, outlineId)).get();
      sectionCount = (outline?.sections as SectionOutline[])?.length || 1;
    } else if (targetDurationMinutes) {
      sectionCount = Math.max(1, Math.ceil(targetDurationMinutes / 8));
    }

    // Create job record
    const job = await jobService.create({
      projectId,
      jobType: 'script-long',
    });

    // Trigger Inngest function
    await inngest.send({
      name: 'script/generate-long',
      data: {
        projectId,
        outlineId: mode === 'from-outline' ? outlineId : undefined,
        topic: topic || project.topic || 'Untitled Video',
        targetDurationMinutes: targetDurationMinutes || project.targetDuration || 8,
        visualStyle: visualStyle || project.visualStyle || 'cinematic',
        mode,
      },
    });

    // Estimate generation time (~20 seconds per section)
    const estimatedDurationSeconds = sectionCount * 20;

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        totalSections: sectionCount,
        estimatedDurationSeconds,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// SSE Progress Streaming
// =============================================================================

/**
 * GET /api/v1/projects/:projectId/generation-status
 * Server-Sent Events endpoint for real-time generation progress.
 */
scriptsRouter.get('/:projectId/generation-status', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`event: connected\ndata: ${JSON.stringify({ projectId })}\n\n`);

  // Poll for updates (in production, use pub/sub)
  const pollInterval = setInterval(async () => {
    try {
      // Get latest active job for project
      const activeJobs = await jobService.getActiveJobs(projectId);
      const job = activeJobs.find(j => j.jobType === 'script-long');

      if (!job) {
        // Check for completed job
        const allJobs = await jobService.getByProject(projectId);
        const latestJob = allJobs.find(j => j.jobType === 'script-long');

        if (latestJob?.status === 'completed') {
          // Get completion stats from outline
          const outline = await db.select()
            .from(scriptOutlines)
            .where(eq(scriptOutlines.projectId, projectId))
            .orderBy(desc(scriptOutlines.updatedAt))
            .get();

          if (outline) {
            const sectionOutlines = outline.sections as SectionOutline[];
            const sentenceCount = await db.select()
              .from(sentences)
              .innerJoin(sections, eq(sentences.sectionId, sections.id))
              .where(eq(sections.projectId, projectId));

            res.write(`event: complete\ndata: ${JSON.stringify({
              jobId: latestJob.id,
              status: 'completed',
              totalSections: sectionOutlines.length,
              totalSentences: sentenceCount.length,
              totalDurationMinutes: outline.totalTargetMinutes,
            })}\n\n`);
          }

          clearInterval(pollInterval);
          res.end();
          return;
        }

        if (latestJob?.status === 'failed') {
          res.write(`event: error\ndata: ${JSON.stringify({
            jobId: latestJob.id,
            status: 'failed',
            error: latestJob.errorMessage || 'Unknown error',
          })}\n\n`);

          clearInterval(pollInterval);
          res.end();
          return;
        }

        // No job found
        return;
      }

      // Get outline for current status
      const outline = await db.select()
        .from(scriptOutlines)
        .where(eq(scriptOutlines.projectId, projectId))
        .orderBy(desc(scriptOutlines.updatedAt))
        .get();

      if (outline) {
        const sectionOutlines = outline.sections as SectionOutline[];
        const completedSections = sectionOutlines.filter(s => s.status === 'completed');
        const currentSection = sectionOutlines.find(s => s.status === 'generating');

        res.write(`event: progress\ndata: ${JSON.stringify({
          jobId: job.id,
          status: job.status,
          currentSection: (outline.currentSectionIndex ?? 0) + 1,
          totalSections: sectionOutlines.length,
          currentSectionTitle: currentSection?.title || job.stepName,
          percentComplete: job.progress,
          sectionsCompleted: completedSections.map(s => s.title),
        })}\n\n`);
      }
    } catch (error) {
      console.error('[SSE] Error polling status:', error);
    }
  }, 2000); // Poll every 2 seconds

  // Clean up on connection close
  req.on('close', () => {
    clearInterval(pollInterval);
    res.end();
  });
});

// =============================================================================
// Get Outline Details
// =============================================================================

/**
 * GET /api/v1/projects/:projectId/outlines
 * Get all outlines for a project.
 */
scriptsRouter.get('/:projectId/outlines', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.projectId as string;

    const outlines = await db.select()
      .from(scriptOutlines)
      .where(eq(scriptOutlines.projectId, projectId))
      .orderBy(desc(scriptOutlines.createdAt));

    res.json({
      success: true,
      data: outlines,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/outlines/:outlineId
 * Get a specific outline with full details.
 */
scriptsRouter.get('/:projectId/outlines/:outlineId', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.projectId as string;
    const outlineId = req.params.outlineId as string;

    const outline = await db.select()
      .from(scriptOutlines)
      .where(and(
        eq(scriptOutlines.id, outlineId),
        eq(scriptOutlines.projectId, projectId)
      ))
      .get();

    if (!outline) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Outline not found' },
      });
    }

    res.json({
      success: true,
      data: outline,
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Regenerate Section
// =============================================================================

/**
 * POST /api/v1/projects/:projectId/outlines/:outlineId/regenerate-section
 * Regenerate a single section without regenerating the entire script.
 */
scriptsRouter.post('/:projectId/outlines/:outlineId/regenerate-section', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.projectId as string;
    const outlineId = req.params.outlineId as string;

    // Validate request body
    const parsed = regenerateSectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { sectionIndex } = parsed.data;

    // Get outline
    const outline = await db.select()
      .from(scriptOutlines)
      .where(and(
        eq(scriptOutlines.id, outlineId),
        eq(scriptOutlines.projectId, projectId)
      ))
      .get();

    if (!outline) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Outline not found' },
      });
    }

    const sectionOutlines = outline.sections as SectionOutline[];
    if (sectionIndex >= sectionOutlines.length) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid section index' },
      });
    }

    // Get previous sections' data for context
    const projectSections = await db.select()
      .from(sections)
      .where(eq(sections.projectId, projectId))
      .orderBy(sections.order);

    // Find the section to regenerate
    const targetSection = projectSections[sectionIndex];
    if (!targetSection) {
      return res.status(400).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Section not found in database' },
      });
    }

    // Delete existing sentences for this section
    await db.delete(sentences).where(eq(sentences.sectionId, targetSection.id));

    // Build context from previous sections
    let previousSentences: string[] = [];
    for (let i = 0; i < sectionIndex; i++) {
      const prevSection = projectSections[i];
      if (prevSection) {
        const prevSentences = await db.select()
          .from(sentences)
          .where(eq(sentences.sectionId, prevSection.id))
          .orderBy(sentences.order);
        previousSentences = previousSentences.concat(prevSentences.map(s => s.text));
      }
    }

    // Regenerate section using DeepseekClient
    const client = getDeepseekClient();

    // Build context
    const sectionMeta = sectionOutlines[sectionIndex];
    const context = {
      outline: {
        title: outline.title,
        totalTargetMinutes: outline.totalTargetMinutes,
        sections: sectionOutlines.map(s => ({
          index: s.index,
          title: s.title,
          description: s.description,
          targetMinutes: s.targetMinutes,
          keyPoints: s.keyPoints,
        })),
      },
      currentSectionIndex: sectionIndex,
      runningSummary: outline.runningSummary || '',
      previousSectionEnding: previousSentences.length > 0 ? previousSentences[previousSentences.length - 1] : '',
      coveredTopics: (outline.coveredTopics || []) as string[],
      visualStyle: outline.visualStyle,
    };

    const generatedSection = await client.generateSectionWithContext(context);

    // Save new sentences
    const sentenceRecords = generatedSection.sentences.map((s, idx) => ({
      id: nanoid(),
      sectionId: targetSection.id,
      text: s.text,
      order: idx,
      imagePrompt: s.imagePrompt || null,
      videoPrompt: s.videoPrompt || null,
      cameraMovement: 'static',
      motionStrength: 0.5,
      status: 'pending',
    }));

    if (sentenceRecords.length > 0) {
      await db.insert(sentences).values(sentenceRecords);
    }

    res.json({
      success: true,
      data: {
        sectionIndex,
        sectionTitle: generatedSection.title,
        sentenceCount: generatedSection.sentenceCount,
        durationMinutes: generatedSection.durationMinutes,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Update Outline (Edit sections before generation)
// =============================================================================

/**
 * PUT /api/v1/projects/:projectId/outlines/:outlineId
 * Update outline sections (add/remove/reorder/edit).
 */
scriptsRouter.put('/:projectId/outlines/:outlineId', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.projectId as string;
    const outlineId = req.params.outlineId as string;
    const { sections: newSections, title } = req.body;

    // Get existing outline
    const outline = await db.select()
      .from(scriptOutlines)
      .where(and(
        eq(scriptOutlines.id, outlineId),
        eq(scriptOutlines.projectId, projectId)
      ))
      .get();

    if (!outline) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Outline not found' },
      });
    }

    // Only allow editing draft outlines
    if (outline.status !== 'draft') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_STATE', message: 'Can only edit draft outlines' },
      });
    }

    // Update outline
    const updates: {
      title?: string;
      sections?: SectionOutline[];
      totalTargetMinutes?: number;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (title) {
      updates.title = title;
    }

    if (newSections && Array.isArray(newSections)) {
      // Validate and normalize sections
      const normalizedSections: SectionOutline[] = newSections.map((s: Record<string, unknown>, idx: number) => ({
        index: idx,
        title: String(s.title || `Section ${idx + 1}`),
        description: String(s.description || ''),
        targetMinutes: Number(s.targetMinutes) || 8,
        keyPoints: Array.isArray(s.keyPoints) ? (s.keyPoints as unknown[]).map(String) : [],
        status: 'pending' as const,
      }));

      // Recalculate total duration
      const totalMinutes = normalizedSections.reduce((sum, s) => sum + s.targetMinutes, 0);

      updates.sections = normalizedSections;
      updates.totalTargetMinutes = totalMinutes;
    }

    await db.update(scriptOutlines)
      .set(updates)
      .where(eq(scriptOutlines.id, outlineId));

    const updated = await db.select()
      .from(scriptOutlines)
      .where(eq(scriptOutlines.id, outlineId))
      .get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});
