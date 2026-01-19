/**
 * Image Prompt Generation API
 * STORY 4.1: Image Prompt Generation
 *
 * Provides endpoints for generating image prompts from script sentences.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { inngest } from '../inngest/client.js';
import { generateImagePrompts } from '../services/promptService.js';

export const promptsRouter = Router();

// Validation schema for generate-image-prompts request
const generateImagePromptsSchema = z.object({
  sentenceIds: z.array(z.string()).optional(),
  force: z.boolean().optional().default(false),
  async: z.boolean().optional().default(true), // If true, use Inngest job queue
});

/**
 * POST /api/v1/projects/:id/generate-image-prompts
 * Generate image prompts for a project's sentences.
 *
 * Request body:
 * - sentenceIds?: string[] - Optional list of specific sentences to generate prompts for
 * - force?: boolean - If true, regenerate prompts even if they exist (default: false)
 * - async?: boolean - If true (default), queue the job via Inngest for progress tracking
 *
 * Response (async: true):
 * - success: boolean
 * - message: string
 * - eventId: string (Inngest event ID for tracking)
 *
 * Response (async: false):
 * - success: boolean
 * - data: { total, generated, prompts[] }
 */
promptsRouter.post('/:id/generate-image-prompts', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.id as string;

    // Validate request body
    const parsed = generateImagePromptsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { sentenceIds, force, async: useAsync } = parsed.data;

    if (useAsync) {
      // Queue the job via Inngest for progress tracking
      const event = await inngest.send({
        name: 'prompts/generate-image',
        data: {
          projectId,
          sentenceIds,
          force,
        },
      });

      return res.status(202).json({
        success: true,
        message: 'Image prompt generation queued',
        eventId: event.ids[0],
      });
    }

    // Synchronous mode - generate prompts immediately
    const result = await generateImagePrompts({
      projectId,
      sentenceIds,
      force,
    });

    if (!result.success) {
      return res.status(result.errors?.includes('Project not found') ? 404 : 500).json({
        success: false,
        error: {
          code: result.errors?.includes('Project not found') ? 'NOT_FOUND' : 'GENERATION_ERROR',
          message: result.errors?.join('; ') || 'Failed to generate prompts',
        },
      });
    }

    res.json({
      success: true,
      data: {
        total: result.total,
        generated: result.generated,
        prompts: result.prompts,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:id/image-prompts
 * Get all image prompts for a project's sentences.
 * Useful for checking which sentences have prompts generated.
 */
promptsRouter.get('/:id/image-prompts', async (req: Request, res: Response, next) => {
  try {
    const projectId = req.params.id as string;

    // Import db here to avoid circular dependencies
    const { db, sections, sentences } = await import('../db/index.js');
    const { eq, inArray } = await import('drizzle-orm');

    // Get all sections for the project
    const projectSections = await db
      .select()
      .from(sections)
      .where(eq(sections.projectId, projectId))
      .orderBy(sections.order);

    if (projectSections.length === 0) {
      return res.json({
        success: true,
        data: {
          total: 0,
          withPrompts: 0,
          withoutPrompts: 0,
          sentences: [],
        },
      });
    }

    const sectionIds = projectSections.map(s => s.id);

    // Get all sentences
    const allSentences = await db
      .select({
        id: sentences.id,
        text: sentences.text,
        imagePrompt: sentences.imagePrompt,
        sectionId: sentences.sectionId,
        order: sentences.order,
      })
      .from(sentences)
      .where(inArray(sentences.sectionId, sectionIds))
      .orderBy(sentences.order);

    const withPrompts = allSentences.filter(s => s.imagePrompt && s.imagePrompt.trim() !== '').length;

    res.json({
      success: true,
      data: {
        total: allSentences.length,
        withPrompts,
        withoutPrompts: allSentences.length - withPrompts,
        sentences: allSentences.map(s => ({
          id: s.id,
          text: s.text.substring(0, 100) + (s.text.length > 100 ? '...' : ''),
          hasPrompt: !!(s.imagePrompt && s.imagePrompt.trim() !== ''),
          imagePrompt: s.imagePrompt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});
