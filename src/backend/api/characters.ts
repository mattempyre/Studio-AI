import { Router } from 'express';
import { db, characters, type NewCharacter } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createCharacterSchema, updateCharacterSchema } from '../validation/schemas.js';

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

    // TODO: Delete reference images from filesystem

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    next(error);
  }
});
