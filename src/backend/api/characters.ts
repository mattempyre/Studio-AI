import { Router } from 'express';
import { db, characters, type NewCharacter } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createCharacterSchema, updateCharacterSchema } from '../validation/schemas.js';
import multer from 'multer';
import {
  saveCharacterImage,
  getCharacterImage,
  deleteCharacterImage,
  deleteCharacterImages,
} from '../services/fileStorage.js';

const MAX_IMAGES_PER_CHARACTER = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Configure multer for memory storage with file validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG, JPG, and WebP images are supported'));
    }
  },
});

export const charactersRouter = Router();

// GET /api/v1/characters - List all characters
charactersRouter.get('/', async (req, res, next) => {
  try {
    const allCharacters = await db.select().from(characters).orderBy(characters.createdAt);

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
      referenceImages: parsed.data.referenceImages ?? [],
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

    await db.update(characters)
      .set(parsed.data)
      .where(eq(characters.id, id));

    const updated = await db.select().from(characters).where(eq(characters.id, id)).get();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/characters/:id - Delete character
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

    // Delete character (cascades to project_cast due to foreign key constraints)
    await db.delete(characters).where(eq(characters.id, id));

    // Delete reference images from filesystem
    await deleteCharacterImages(id);

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/characters/:id/images - Upload reference image
charactersRouter.post('/:id/images', upload.single('image'), async (req, res, next) => {
  try {
    const id = req.params.id as string;

    // Check character exists
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

    // Check file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No image file provided',
        },
      });
    }

    // Check max images limit
    const currentImages = character.referenceImages || [];
    if (currentImages.length >= MAX_IMAGES_PER_CHARACTER) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'LIMIT_EXCEEDED',
          message: `Maximum ${MAX_IMAGES_PER_CHARACTER} images allowed per character`,
        },
      });
    }

    // Get file extension from mimetype
    const mimeToExt: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    };
    const extension = mimeToExt[req.file.mimetype] || 'png';

    // Save image to filesystem
    const index = await saveCharacterImage(id, req.file.buffer, extension);
    const imageUrl = `/uploads/characters/${id}/ref_${index}.${extension}`;

    // Update character's referenceImages array
    const updatedImages = [...currentImages, imageUrl];
    await db.update(characters)
      .set({ referenceImages: updatedImages })
      .where(eq(characters.id, id));

    res.status(201).json({
      success: true,
      index,
      url: imageUrl,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/characters/:id/images/:index - Serve reference image
charactersRouter.get('/:id/images/:index', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const indexParam = req.params.index as string;
    const imageIndex = parseInt(indexParam, 10);

    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid image index',
        },
      });
    }

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

    res.set('Content-Type', image.mimeType);
    res.set('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.send(image.buffer);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/characters/:id/images/:index - Delete reference image
charactersRouter.delete('/:id/images/:index', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const indexParam = req.params.index as string;
    const imageIndex = parseInt(indexParam, 10);

    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid image index',
        },
      });
    }

    // Check character exists
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

    // Delete the image file
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

    // Update character's referenceImages array - remove the deleted image
    const currentImages = character.referenceImages || [];
    const imageUrlPattern = `/uploads/characters/${id}/ref_${imageIndex}.`;
    const updatedImages = currentImages.filter(
      (url: string) => !url.startsWith(imageUrlPattern)
    );

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
