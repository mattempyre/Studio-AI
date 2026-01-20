import { Router, type Request, type Response } from 'express';
import { db, sentences, sections, characters } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { inngest } from '../inngest/client.js';
import { jobService } from '../services/jobService.js';
import { z } from 'zod';
import { getAllVisualStyles, getVisualStyle, getStylesByWorkflow } from '../config/visualStyles.js';

export const imagesRouter = Router();

/**
 * GET /api/v1/visual-styles
 * List all available visual styles for image generation
 */
imagesRouter.get('/visual-styles', async (_req: Request, res: Response) => {
  const styles = getAllVisualStyles();
  res.json({
    success: true,
    data: {
      styles: styles.map(style => ({
        id: style.id,
        name: style.name,
        description: style.description,
        requiresCharacterRef: style.requiresCharacterRef,
        workflow: style.workflow,
        useCases: style.useCases,
      })),
    },
  });
});

/**
 * GET /api/v1/visual-styles/:styleId
 * Get details for a specific visual style
 */
imagesRouter.get('/visual-styles/:styleId', async (req: Request, res: Response) => {
  const styleId = req.params.styleId as string;
  const style = getVisualStyle(styleId);

  res.json({
    success: true,
    data: {
      id: style.id,
      name: style.name,
      description: style.description,
      promptPrefix: style.promptPrefix,
      requiresCharacterRef: style.requiresCharacterRef,
      workflow: style.workflow,
      useCases: style.useCases,
    },
  });
});

/**
 * GET /api/v1/visual-styles/workflow/:workflowType
 * Get visual styles filtered by workflow type (text-to-image or image-to-image)
 */
imagesRouter.get('/visual-styles/workflow/:workflowType', async (req: Request, res: Response) => {
  const workflowType = req.params.workflowType as 'text-to-image' | 'image-to-image';

  if (workflowType !== 'text-to-image' && workflowType !== 'image-to-image') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_WORKFLOW_TYPE',
        message: 'Workflow type must be "text-to-image" or "image-to-image"',
      },
    });
  }

  const styles = getStylesByWorkflow(workflowType);
  res.json({
    success: true,
    data: {
      workflow: workflowType,
      styles: styles.map(style => ({
        id: style.id,
        name: style.name,
        description: style.description,
        requiresCharacterRef: style.requiresCharacterRef,
        useCases: style.useCases,
      })),
    },
  });
});

// Validation schema for generate-image endpoint
const generateImageSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  characterId: z.string().optional(),
  style: z.string().optional().default('financial-explainer'),
  useImageToImage: z.boolean().optional().default(true),
  seed: z.number().optional(),
  steps: z.number().min(1).max(50).optional(),
  cfg: z.number().min(1).max(20).optional(),
});

/**
 * POST /api/v1/sentences/:sentenceId/generate-image
 * Trigger image generation for a single sentence using ComfyUI
 */
imagesRouter.post('/sentences/:sentenceId/generate-image', async (req: Request, res: Response, next) => {
  try {
    const sentenceId = req.params.sentenceId as string;

    // Validate request body
    const parsed = generateImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { prompt, characterId, style, useImageToImage, seed, steps, cfg } = parsed.data;

    // Get sentence and verify it exists
    const sentence = await db.select().from(sentences).where(eq(sentences.id, sentenceId)).get();
    if (!sentence) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sentence not found' },
      });
    }

    // Get section to find project
    const section = await db.select().from(sections).where(eq(sections.id, sentence.sectionId)).get();
    if (!section) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Section not found' },
      });
    }

    const projectId = section.projectId;

    // Build character refs array
    const characterRefs: string[] = [];
    if (characterId) {
      // Verify character exists
      const character = await db.select().from(characters).where(eq(characters.id, characterId)).get();
      if (character) {
        characterRefs.push(characterId);
      } else {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Character not found' },
        });
      }
    }

    // Create job record
    const job = await jobService.create({
      sentenceId,
      projectId,
      jobType: 'image',
    });

    // Trigger Inngest event
    await inngest.send({
      name: 'image/generate',
      data: {
        sentenceId,
        projectId,
        prompt: prompt || sentence.imagePrompt || sentence.text,
        style,
        characterRefs: characterRefs.length > 0 ? characterRefs : undefined,
        useImageToImage: useImageToImage && characterRefs.length > 0,
        seed,
        steps,
        cfg,
      },
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        message: 'Image generation started',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Validation schema for edit-image endpoint
const editImageSchema = z.object({
  editPrompt: z.string().min(1, 'Edit prompt is required'),
  editMode: z.enum(['full', 'inpaint']),
  maskImage: z.string().optional(), // Base64 PNG for inpaint mode
  seed: z.number().optional(),
  steps: z.number().min(1).max(50).optional(),
});

/**
 * POST /api/v1/sentences/:sentenceId/edit-image
 * Trigger image editing (inpainting) for a single sentence using ComfyUI
 * Uses Flux2 Klein 9B Inpainting workflow
 */
imagesRouter.post('/sentences/:sentenceId/edit-image', async (req: Request, res: Response, next) => {
  try {
    const sentenceId = req.params.sentenceId as string;

    // Validate request body
    const parsed = editImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { editPrompt, editMode, maskImage, seed, steps } = parsed.data;

    // Validate that inpaint mode has a mask
    if (editMode === 'inpaint' && !maskImage) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Mask image is required for inpaint mode',
        },
      });
    }

    // Get sentence and verify it exists and has an image
    const sentence = await db.select().from(sentences).where(eq(sentences.id, sentenceId)).get();
    if (!sentence) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sentence not found' },
      });
    }

    if (!sentence.imageFile) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_IMAGE', message: 'Sentence does not have an image to edit' },
      });
    }

    // Get section to find project
    const section = await db.select().from(sections).where(eq(sections.id, sentence.sectionId)).get();
    if (!section) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Section not found' },
      });
    }

    const projectId = section.projectId;

    // Create job record
    const job = await jobService.create({
      sentenceId,
      projectId,
      jobType: 'image',
    });

    // Trigger Inngest event for image editing
    await inngest.send({
      name: 'image/edit',
      data: {
        sentenceId,
        projectId,
        sourceImagePath: sentence.imageFile,
        editPrompt,
        editMode,
        maskImageBase64: maskImage,
        seed,
        steps,
      },
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        message: 'Image edit started',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/sentences/:sentenceId/image-status
 * Get the status of image generation for a sentence
 */
imagesRouter.get('/sentences/:sentenceId/image-status', async (req: Request, res: Response, next) => {
  try {
    const sentenceId = req.params.sentenceId as string;

    const job = await jobService.getLatestBySentenceAndType(sentenceId, 'image');

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No image generation job found for this sentence' },
      });
    }

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        resultFile: job.resultFile,
        errorMessage: job.errorMessage,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/generate-test
 * Test endpoint to generate an image directly without a sentence
 * Useful for testing the ComfyUI integration
 */
imagesRouter.post('/images/generate-test', async (req: Request, res: Response, next) => {
  try {
    const testSchema = z.object({
      prompt: z.string().min(1, 'Prompt is required'),
      characterId: z.string().min(1, 'Character ID is required'),
      projectId: z.string().optional().default('test-project'),
      seed: z.number().optional(),
      steps: z.number().min(1).max(50).optional(),
      cfg: z.number().min(1).max(20).optional(),
    });

    const parsed = testSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { prompt, characterId, projectId, seed, steps, cfg } = parsed.data;

    // Verify character exists
    const character = await db.select().from(characters).where(eq(characters.id, characterId)).get();
    if (!character) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Character not found' },
      });
    }

    // Generate a test sentence ID
    const testSentenceId = `test-${Date.now()}`;

    // Create job record
    const job = await jobService.create({
      sentenceId: testSentenceId,
      projectId,
      jobType: 'image',
    });

    // Trigger Inngest event
    await inngest.send({
      name: 'image/generate',
      data: {
        sentenceId: testSentenceId,
        projectId,
        prompt,
        style: 'financial-explainer',
        characterRefs: [characterId],
        useImageToImage: true,
        seed,
        steps,
        cfg,
      },
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        testSentenceId,
        status: 'queued',
        message: 'Test image generation started',
        characterUsed: {
          id: character.id,
          name: character.name,
          referenceImages: character.referenceImages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/jobs/:jobId
 * Get job status by job ID
 */
imagesRouter.get('/jobs/:jobId', async (req: Request, res: Response, next) => {
  try {
    const jobId = req.params.jobId as string;

    const job = await jobService.getById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    next(error);
  }
});

// Validation schema for generate-video endpoint
const generateVideoSchema = z.object({
  prompt: z.string().optional(), // Uses sentence.videoPrompt if not provided
  cameraMovement: z.string().optional(),
  motionStrength: z.number().min(0).max(1).optional(),
});

/**
 * POST /api/v1/sentences/:sentenceId/generate-video
 * STORY-5-4: Trigger video generation for a single sentence
 * Requires: sentence must have imageFile (source image required)
 */
imagesRouter.post('/sentences/:sentenceId/generate-video', async (req: Request, res: Response, next) => {
  try {
    const sentenceId = req.params.sentenceId as string;

    // Validate request body
    const parsed = generateVideoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { prompt, cameraMovement, motionStrength } = parsed.data;

    // Get sentence and verify it exists
    const sentence = await db.select().from(sentences).where(eq(sentences.id, sentenceId)).get();
    if (!sentence) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Sentence not found' },
      });
    }

    // AC: 23 - Button disabled if selected sentence has no imageFile
    if (!sentence.imageFile) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_SOURCE_IMAGE', message: 'Sentence must have an image before generating video' },
      });
    }

    // Get section to find project
    const section = await db.select().from(sections).where(eq(sections.id, sentence.sectionId)).get();
    if (!section) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Section not found' },
      });
    }

    const projectId = section.projectId;

    // Use provided prompt or fall back to sentence's videoPrompt/imagePrompt/text
    const videoPrompt = prompt || sentence.videoPrompt || sentence.imagePrompt || sentence.text;

    // Create job record
    const job = await jobService.create({
      sentenceId,
      projectId,
      jobType: 'video',
    });

    // Trigger Inngest event for video generation
    await inngest.send({
      name: 'video/generate',
      data: {
        sentenceId,
        projectId,
        imageFile: sentence.imageFile,
        prompt: videoPrompt,
        cameraMovement: cameraMovement || sentence.cameraMovement || 'static',
        motionStrength: motionStrength ?? sentence.motionStrength ?? 0.5,
      },
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: 'queued',
        message: 'Video generation started',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/sentences/:sentenceId/video-status
 * Get the status of video generation for a sentence
 */
imagesRouter.get('/sentences/:sentenceId/video-status', async (req: Request, res: Response, next) => {
  try {
    const sentenceId = req.params.sentenceId as string;

    const job = await jobService.getLatestBySentenceAndType(sentenceId, 'video');

    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No video generation job found for this sentence' },
      });
    }

    res.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        resultFile: job.resultFile,
        errorMessage: job.errorMessage,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/images/generate-text-to-image
 * Test endpoint to generate an image using text-to-image workflow
 * Useful for testing the z-image-turbo and ms-paint-style workflows
 */
imagesRouter.post('/images/generate-text-to-image', async (req: Request, res: Response, next) => {
  try {
    const textToImageSchema = z.object({
      prompt: z.string().min(1, 'Prompt is required'),
      style: z.enum(['z-image-turbo', 'ms-paint-style', 'cinematic', 'cyberpunk', 'documentary', 'corporate', 'watercolor'])
        .optional()
        .default('z-image-turbo'),
      projectId: z.string().optional().default('test-project'),
      seed: z.number().optional(),
      steps: z.number().min(1).max(50).optional(),
      cfg: z.number().min(0.1).max(20).optional(),
      width: z.number().min(256).max(4096).optional(),
      height: z.number().min(256).max(4096).optional(),
    });

    const parsed = textToImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const { prompt, style, projectId, seed, steps, cfg } = parsed.data;

    // Generate a test sentence ID (used for Inngest tracking, not stored in DB)
    const testSentenceId = `test-t2i-${Date.now()}`;

    // Create job record without sentenceId (null) to avoid FK constraint
    const job = await jobService.create({
      sentenceId: undefined, // Don't set sentenceId to avoid FK constraint
      projectId: undefined,  // Don't set projectId either for test
      jobType: 'image',
    });

    // Trigger Inngest event for text-to-image generation
    await inngest.send({
      name: 'image/generate',
      data: {
        sentenceId: testSentenceId,
        projectId,
        prompt,
        style,
        characterRefs: undefined,      // No character refs for text-to-image
        useImageToImage: false,        // Explicitly use text-to-image
        seed,
        steps,
        cfg,
      },
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        testSentenceId,
        status: 'queued',
        message: 'Text-to-image generation started',
        style,
        prompt,
      },
    });
  } catch (error) {
    next(error);
  }
});
