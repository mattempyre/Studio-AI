import { Router } from 'express';
import { db, characters, type NewCharacter } from '../db/index.js';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import multer from 'multer';
import { createCharacterSchema, updateCharacterSchema } from '../validation/schemas.js';
import {
  saveCharacterImage,
  getCharacterImage,
  deleteCharacterImage,
  deleteCharacterImages,
  getImageCount,
  buildImageUrl,
  buildImageUrls,
  MAX_IMAGES_PER_CHARACTER,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from '../services/fileStorage.js';

export const charactersRouter = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`));
    }
  },
});

// GET /api/v1/characters - List all characters (sorted alphabetically by name)
charactersRouter.get('/', async (req, res, next) => {
  try {
    const allCharacters = await db
      .select()
      .from(characters)
      .orderBy(asc(characters.name));

    res.json({
      success: true,
      data: allCharacters,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/characters - Create a new character
charactersRouter.post('/', async (req, res, next) => {
  try {
    const parsed = createCharacterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const newCharacter: NewCharacter = {
      id: nanoid(),
      name: parsed.data.name,
      description: parsed.data.description,
      referenceImages: [], // Images are added via separate upload endpoint
      styleLora: parsed.data.styleLora,
    };

    await db.insert(characters).values(newCharacter);

    const created = await db.select().from(characters).where(eq(characters.id, newCharacter.id)).get();

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/characters/:id - Get a single character
charactersRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const character = await db.select().from(characters).where(eq(characters.id, id)).get();

    if (!character) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found',
        },
      });
    }

    res.json({
      success: true,
      data: character,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/characters/:id - Update character
charactersRouter.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const parsed = updateCharacterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors.map(e => e.message).join(', '),
        },
      });
    }

    const existing = await db.select().from(characters).where(eq(characters.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found',
        },
      });
    }

    // Don't allow updating referenceImages directly - use image upload endpoints
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { referenceImages, ...updateData } = parsed.data;

    // Only update if there's something to update
    if (Object.keys(updateData).length > 0) {
      await db.update(characters)
        .set(updateData)
        .where(eq(characters.id, id));
    }

    const updated = await db.select().from(characters).where(eq(characters.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/characters/:id - Delete character and all associated images
charactersRouter.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await db.select().from(characters).where(eq(characters.id, id)).get();
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found',
        },
      });
    }

    // Delete character from database (cascades to project_cast due to foreign key constraints)
    await db.delete(characters).where(eq(characters.id, id));

    // Delete all reference images from filesystem
    await deleteCharacterImages(id);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/characters/:id/images - Upload a reference image
charactersRouter.post('/:id/images', upload.single('image'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if character exists
    const character = await db.select().from(characters).where(eq(characters.id, id)).get();
    if (!character) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found',
        },
      });
    }

    // Check if file was provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No image file provided',
        },
      });
    }

    // Check current image count
    const currentCount = await getImageCount(id);
    if (currentCount >= MAX_IMAGES_PER_CHARACTER) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: `Maximum ${MAX_IMAGES_PER_CHARACTER} images allowed per character`,
        },
      });
    }

    // Get file extension from mime type
    const extension = ALLOWED_MIME_TYPES[req.file.mimetype];
    if (!extension) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid file type',
        },
      });
    }

    // Save the image
    const index = await saveCharacterImage(id, req.file.buffer, extension);
    const url = buildImageUrl(id, index);

    // Update character's referenceImages array in database
    const updatedImages = await buildImageUrls(id);
    await db.update(characters)
      .set({ referenceImages: updatedImages })
      .where(eq(characters.id, id));

    res.status(201).json({
      success: true,
      data: {
        index,
        url,
      },
    });
  } catch (error) {
    // Handle multer errors
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          },
        });
      }
    }
    next(error);
  }
});

// GET /api/v1/characters/:id/images/:index - Get a specific reference image
charactersRouter.get('/:id/images/:index', async (req, res, next) => {
  try {
    const { id, index } = req.params;
    const imageIndex = parseInt(index, 10);

    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid image index',
        },
      });
    }

    // Check if character exists
    const character = await db.select().from(characters).where(eq(characters.id, id)).get();
    if (!character) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found',
        },
      });
    }

    // Get the image
    const image = await getCharacterImage(id, imageIndex);
    if (!image) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Image not found',
        },
      });
    }

    // Set appropriate headers and send image
    res.set('Content-Type', image.mimeType);
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.send(image.buffer);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/characters/:id/images/:index - Delete a specific reference image
charactersRouter.delete('/:id/images/:index', async (req, res, next) => {
  try {
    const { id, index } = req.params;
    const imageIndex = parseInt(index, 10);

    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid image index',
        },
      });
    }

    // Check if character exists
    const character = await db.select().from(characters).where(eq(characters.id, id)).get();
    if (!character) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Character not found',
        },
      });
    }

    // Delete the image
    const deleted = await deleteCharacterImage(id, imageIndex);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Image not found',
        },
      });
    }

    // Update character's referenceImages array in database
    const updatedImages = await buildImageUrls(id);
    await db.update(characters)
      .set({ referenceImages: updatedImages })
      .where(eq(characters.id, id));

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});
