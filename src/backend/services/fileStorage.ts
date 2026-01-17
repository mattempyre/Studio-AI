import { mkdir, rm, writeFile, readFile, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const CHARACTERS_DIR = join(DATA_DIR, 'characters');

/**
 * Save a character reference image to the filesystem.
 * Images are stored as data/characters/{characterId}/ref_{index}.{ext}
 */
export async function saveCharacterImage(
  characterId: string,
  imageBuffer: Buffer,
  extension: string
): Promise<number> {
  // Sanitize characterId to prevent path traversal
  const sanitizedId = characterId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedId !== characterId) {
    throw new Error('Invalid character ID');
  }

  const charDir = join(CHARACTERS_DIR, characterId);
  await mkdir(charDir, { recursive: true });

  // Find next available index
  let nextIndex = 0;
  try {
    const files = await readdir(charDir);
    const indices = files
      .filter(f => f.startsWith('ref_'))
      .map(f => {
        const match = f.match(/ref_(\d+)\./);
        return match ? parseInt(match[1], 10) : -1;
      })
      .filter(n => n >= 0);

    if (indices.length > 0) {
      nextIndex = Math.max(...indices) + 1;
    }
  } catch {
    // Directory doesn't exist yet, start at 0
  }

  const filename = `ref_${nextIndex}.${extension}`;
  await writeFile(join(charDir, filename), imageBuffer);

  return nextIndex;
}

/**
 * Get a character reference image from the filesystem.
 */
export async function getCharacterImage(
  characterId: string,
  index: number
): Promise<{ buffer: Buffer; extension: string; mimeType: string } | null> {
  // Sanitize characterId to prevent path traversal
  const sanitizedId = characterId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedId !== characterId) {
    return null;
  }

  const charDir = join(CHARACTERS_DIR, characterId);

  try {
    const files = await readdir(charDir);
    const file = files.find(f => f.startsWith(`ref_${index}.`));

    if (!file) return null;

    const buffer = await readFile(join(charDir, file));
    const extension = file.split('.').pop() || 'png';

    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    };

    return {
      buffer,
      extension,
      mimeType: mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
    };
  } catch {
    return null;
  }
}

/**
 * Delete a specific character reference image.
 */
export async function deleteCharacterImage(
  characterId: string,
  index: number
): Promise<boolean> {
  // Sanitize characterId to prevent path traversal
  const sanitizedId = characterId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedId !== characterId) {
    return false;
  }

  const charDir = join(CHARACTERS_DIR, characterId);

  try {
    const files = await readdir(charDir);
    const file = files.find(f => f.startsWith(`ref_${index}.`));

    if (!file) return false;

    await unlink(join(charDir, file));
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete all images for a character (used when deleting a character).
 */
export async function deleteCharacterImages(characterId: string): Promise<void> {
  // Sanitize characterId to prevent path traversal
  const sanitizedId = characterId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedId !== characterId) {
    return;
  }

  const charDir = join(CHARACTERS_DIR, characterId);

  if (existsSync(charDir)) {
    await rm(charDir, { recursive: true, force: true });
  }
}

/**
 * List all reference image indices for a character.
 */
export async function listCharacterImageIndices(characterId: string): Promise<number[]> {
  // Sanitize characterId to prevent path traversal
  const sanitizedId = characterId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedId !== characterId) {
    return [];
  }

  const charDir = join(CHARACTERS_DIR, characterId);

  try {
    const files = await readdir(charDir);
    return files
      .filter(f => f.startsWith('ref_'))
      .map(f => {
        const match = f.match(/ref_(\d+)\./);
        return match ? parseInt(match[1], 10) : -1;
      })
      .filter(n => n >= 0)
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}
