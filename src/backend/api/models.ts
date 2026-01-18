import { Router, type Request, type Response } from 'express';
import { db, generationModels, type NewGenerationModel } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

export const modelsRouter = Router();

// Configure multer for workflow JSON uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max for JSON workflows
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  },
});

// Validation schemas
const createModelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  workflowCategory: z.enum(['image', 'video']).default('image'),
  workflowType: z.enum(['text-to-image', 'image-to-image', 'image-to-video']).default('text-to-image'),
  defaultSteps: z.number().int().min(1).max(100).optional(),
  defaultCfg: z.number().min(0.1).max(30).optional(),
  defaultFrames: z.number().int().min(1).max(1000).optional(),
  defaultFps: z.number().int().min(1).max(120).optional(),
});

const updateModelSchema = createModelSchema.partial();

/**
 * GET /api/v1/models
 * List all active generation models
 * Query params:
 *   - category: 'image' | 'video' - filter by workflow category
 */
modelsRouter.get('/', async (req: Request, res: Response, next) => {
  try {
    const { category } = req.query;

    let query = db
      .select()
      .from(generationModels)
      .where(eq(generationModels.isActive, true))
      .orderBy(generationModels.name);

    // If category filter is provided, filter results after query
    // (SQLite doesn't support compound where clauses easily with drizzle)
    let models = await query;

    if (category && (category === 'image' || category === 'video')) {
      models = models.filter(m => m.workflowCategory === category);
    }

    res.json({
      success: true,
      data: models,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/models
 * Create a new generation model
 */
modelsRouter.post('/', async (req: Request, res: Response, next) => {
  try {
    const parsed = createModelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const id = nanoid();
    const newModel: NewGenerationModel = {
      id,
      name: parsed.data.name,
      description: parsed.data.description,
      workflowCategory: parsed.data.workflowCategory,
      workflowType: parsed.data.workflowType,
      defaultSteps: parsed.data.defaultSteps ?? 4,
      defaultCfg: parsed.data.defaultCfg ?? 1.0,
      defaultFrames: parsed.data.defaultFrames,
      defaultFps: parsed.data.defaultFps,
      isActive: true,
    };

    await db.insert(generationModels).values(newModel);

    const created = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/models/:id
 * Get a single generation model
 */
modelsRouter.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const model = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();

    if (!model) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model not found' },
      });
    }

    res.json({
      success: true,
      data: model,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/models/:id
 * Update a generation model
 */
modelsRouter.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const parsed = updateModelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const existing = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model not found' },
      });
    }

    await db.update(generationModels).set(parsed.data).where(eq(generationModels.id, id));

    const updated = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/models/:id
 * Soft-delete a generation model (set isActive to false)
 */
modelsRouter.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model not found' },
      });
    }

    // Soft delete - set isActive to false
    await db.update(generationModels).set({ isActive: false }).where(eq(generationModels.id, id));

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/models/:id/workflow
 * Upload a ComfyUI workflow JSON file for a model
 */
modelsRouter.post('/:id/workflow', upload.single('workflow'), async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    // Check model exists
    const model = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();
    if (!model) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model not found' },
      });
    }

    // Check file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'No workflow file provided' },
      });
    }

    // Validate JSON content
    let workflowJson;
    try {
      workflowJson = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON file' },
      });
    }

    // Basic ComfyUI workflow validation
    if (!workflowJson || typeof workflowJson !== 'object') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid ComfyUI workflow structure' },
      });
    }

    // Save workflow to workflows/models/ directory
    const workflowsDir = path.join(process.cwd(), 'workflows', 'models');
    await fs.mkdir(workflowsDir, { recursive: true });

    const filename = `${id}.json`;
    const workflowPath = path.join(workflowsDir, filename);
    await fs.writeFile(workflowPath, JSON.stringify(workflowJson, null, 2));

    // Update model with workflow file path
    const relativePath = `workflows/models/${filename}`;
    await db.update(generationModels).set({ workflowFile: relativePath }).where(eq(generationModels.id, id));

    const updated = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();

    res.json({
      success: true,
      data: updated,
      message: 'Workflow uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/models/:id/workflow
 * Get the workflow JSON for a model
 */
modelsRouter.get('/:id/workflow', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    const model = await db.select().from(generationModels).where(eq(generationModels.id, id)).get();
    if (!model) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Model not found' },
      });
    }

    if (!model.workflowFile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'No workflow file configured for this model' },
      });
    }

    const workflowPath = path.join(process.cwd(), model.workflowFile);
    try {
      const workflowContent = await fs.readFile(workflowPath, 'utf-8');
      const workflowJson = JSON.parse(workflowContent);

      res.json({
        success: true,
        data: workflowJson,
      });
    } catch {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Workflow file not found on disk' },
      });
    }
  } catch (error) {
    next(error);
  }
});
