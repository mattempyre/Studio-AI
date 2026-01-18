import { Router, type Request, type Response } from 'express';
import { db, visualStyles, type NewVisualStyle } from '../db/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';

export const stylesRouter = Router();

// Validation schemas
const createStyleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  styleType: z.enum(['prompt', 'lora']).default('prompt'),
  promptPrefix: z.string().max(2000).optional(),
  loraFile: z.string().max(255).optional(),
  loraStrength: z.number().min(0).max(2).optional(),
  compatibleModels: z.array(z.string()).optional(),
  requiresCharacterRef: z.boolean().optional(),
});

const updateStyleSchema = createStyleSchema.partial();

/**
 * GET /api/v1/styles
 * List all active visual styles
 * Query params:
 *   - model: Filter by compatible model ID
 */
stylesRouter.get('/', async (req: Request, res: Response, next) => {
  try {
    const modelFilter = req.query.model as string | undefined;

    let styles = await db
      .select()
      .from(visualStyles)
      .where(eq(visualStyles.isActive, true))
      .orderBy(visualStyles.name);

    // Filter by compatible model if specified
    if (modelFilter) {
      styles = styles.filter(style => {
        const models = style.compatibleModels || [];
        // If no compatible models specified, style works with all models
        return models.length === 0 || models.includes(modelFilter);
      });
    }

    res.json({
      success: true,
      data: styles,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/styles
 * Create a new visual style
 */
stylesRouter.post('/', async (req: Request, res: Response, next) => {
  try {
    const parsed = createStyleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    // Validate style type requirements
    if (parsed.data.styleType === 'prompt' && !parsed.data.promptPrefix) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Prompt prefix is required for prompt-based styles',
        },
      });
    }

    if (parsed.data.styleType === 'lora' && !parsed.data.loraFile) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'LoRA file is required for LoRA-based styles',
        },
      });
    }

    const id = nanoid();
    const newStyle: NewVisualStyle = {
      id,
      name: parsed.data.name,
      description: parsed.data.description,
      styleType: parsed.data.styleType,
      promptPrefix: parsed.data.promptPrefix,
      loraFile: parsed.data.loraFile,
      loraStrength: parsed.data.loraStrength ?? 1.0,
      compatibleModels: parsed.data.compatibleModels ?? [],
      requiresCharacterRef: parsed.data.requiresCharacterRef ?? false,
      isActive: true,
    };

    await db.insert(visualStyles).values(newStyle);

    const created = await db.select().from(visualStyles).where(eq(visualStyles.id, id)).get();

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/styles/:id
 * Get a single visual style
 */
stylesRouter.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const style = await db.select().from(visualStyles).where(eq(visualStyles.id, id)).get();

    if (!style) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Style not found' },
      });
    }

    res.json({
      success: true,
      data: style,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/styles/:id
 * Update a visual style
 */
stylesRouter.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const parsed = updateStyleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const existing = await db.select().from(visualStyles).where(eq(visualStyles.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Style not found' },
      });
    }

    // Validate style type requirements after update
    const updatedStyleType = parsed.data.styleType ?? existing.styleType;
    const updatedPromptPrefix = parsed.data.promptPrefix ?? existing.promptPrefix;
    const updatedLoraFile = parsed.data.loraFile ?? existing.loraFile;

    if (updatedStyleType === 'prompt' && !updatedPromptPrefix) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Prompt prefix is required for prompt-based styles',
        },
      });
    }

    if (updatedStyleType === 'lora' && !updatedLoraFile) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'LoRA file is required for LoRA-based styles',
        },
      });
    }

    await db.update(visualStyles).set(parsed.data).where(eq(visualStyles.id, id));

    const updated = await db.select().from(visualStyles).where(eq(visualStyles.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/styles/:id
 * Soft-delete a visual style (set isActive to false)
 */
stylesRouter.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(visualStyles).where(eq(visualStyles.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Style not found' },
      });
    }

    // Soft delete - set isActive to false
    await db.update(visualStyles).set({ isActive: false }).where(eq(visualStyles.id, id));

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/styles/types/prompt
 * Get all prompt-based styles
 */
stylesRouter.get('/types/prompt', async (_req: Request, res: Response, next) => {
  try {
    const styles = await db
      .select()
      .from(visualStyles)
      .where(and(eq(visualStyles.isActive, true), eq(visualStyles.styleType, 'prompt')))
      .orderBy(visualStyles.name);

    res.json({
      success: true,
      data: styles,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/styles/types/lora
 * Get all LoRA-based styles
 */
stylesRouter.get('/types/lora', async (_req: Request, res: Response, next) => {
  try {
    const styles = await db
      .select()
      .from(visualStyles)
      .where(and(eq(visualStyles.isActive, true), eq(visualStyles.styleType, 'lora')))
      .orderBy(visualStyles.name);

    res.json({
      success: true,
      data: styles,
    });
  } catch (error) {
    next(error);
  }
});
