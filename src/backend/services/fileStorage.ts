import { mkdir, rm, writeFile, readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Base directory for character images
const DATA_DIR = join(process.cwd(), 'data');
const CHARACTERS_DIR = join(DATA_DIR, 'characters');

// Maximum images per character
export const MAX_IMAGES_PER_CHARACTER = 5;

// Allowed mime types and their extensions
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

// Maximum file size in bytes (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Ensures the characters data directory exists
 */
export async function ensureCharactersDir(): Promise<void> {
  await mkdir(CHARACTERS_DIR, { recursive: true });
}

/**
 * Saves a character reference image
 * @param characterId - The character's ID
 * @param imageBuffer - The image data as a Buffer
 * @param extension - File extension (png, jpg, webp)
 * @returns The index of the saved image
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
  const existingIndices = await getImageIndices(characterId);
  const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 0;

  if (nextIndex >= MAX_IMAGES_PER_CHARACTER) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_CHARACTER} images allowed per character`);
  }

  const filename = `ref_${nextIndex}.${extension}`;
  await writeFile(join(charDir, filename), imageBuffer);

  return nextIndex;
}

/**
 * Gets the indices of existing images for a character
 */
export async function getImageIndices(characterId: string): Promise<number[]> {
  const charDir = join(CHARACTERS_DIR, characterId);

  if (!existsSync(charDir)) {
    return [];
  }

  const files = await readdir(charDir);
  return files
    .filter(f => f.startsWith('ref_'))
    .map(f => {
      const match = f.match(/^ref_(\d+)\./);
      return match ? parseInt(match[1], 10) : NaN;
    })
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b);
}

/**
 * Gets the count of images for a character
 */
export async function getImageCount(characterId: string): Promise<number> {
  const indices = await getImageIndices(characterId);
  return indices.length;
}

/**
 * Retrieves a character reference image
 * @param characterId - The character's ID
 * @param index - The image index
 * @returns The image buffer and extension, or null if not found
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

  if (!existsSync(charDir)) {
    return null;
  }

  const files = await readdir(charDir);
  const file = files.find(f => f.match(new RegExp(`^ref_${index}\\.`)));

  if (!file) {
    return null;
  }

  const buffer = await readFile(join(charDir, file));
  const extension = file.split('.').pop() || 'png';

  // Map extension to mime type
  const mimeTypeMap: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
  };

  return {
    buffer,
    extension,
    mimeType: mimeTypeMap[extension] || 'application/octet-stream'
  };
}

/**
 * Deletes a specific character reference image
 * @param characterId - The character's ID
 * @param index - The image index to delete
 * @returns true if deleted, false if not found
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

  if (!existsSync(charDir)) {
    return false;
  }

  const files = await readdir(charDir);
  const file = files.find(f => f.match(new RegExp(`^ref_${index}\\.`)));

  if (!file) {
    return false;
  }

  await rm(join(charDir, file));
  return true;
}

/**
 * Deletes all images for a character
 * @param characterId - The character's ID
 */
export async function deleteCharacterImages(characterId: string): Promise<void> {
  // Sanitize characterId to prevent path traversal
  const sanitizedId = characterId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitizedId !== characterId) {
    return;
  }

  const charDir = join(CHARACTERS_DIR, characterId);
  await rm(charDir, { recursive: true, force: true });
}

/**
 * Builds the API URL for an image
 */
export function buildImageUrl(characterId: string, index: number): string {
  return `/api/v1/characters/${characterId}/images/${index}`;
}

/**
 * Builds an array of image URLs from indices
 */
export async function buildImageUrls(characterId: string): Promise<string[]> {
  const indices = await getImageIndices(characterId);
  return indices.map(index => buildImageUrl(characterId, index));
}
