import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import {
  saveCharacterImage,
  getCharacterImage,
  deleteCharacterImage,
  deleteCharacterImages,
  getImageIndices,
  getImageCount,
  buildImageUrl,
  buildImageUrls,
  MAX_IMAGES_PER_CHARACTER,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
} from '../../src/backend/services/fileStorage.js';

const TEST_DATA_DIR = join(process.cwd(), 'data', 'characters');
const TEST_CHARACTER_ID = 'test-char-123';

// Create a simple PNG image buffer (1x1 transparent pixel)
const createTestPngBuffer = (): Buffer => {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
};

describe('fileStorage service', () => {
  beforeEach(async () => {
    // Clean up test directory before each test
    const testCharDir = join(TEST_DATA_DIR, TEST_CHARACTER_ID);
    if (existsSync(testCharDir)) {
      await rm(testCharDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    // Clean up after each test
    const testCharDir = join(TEST_DATA_DIR, TEST_CHARACTER_ID);
    if (existsSync(testCharDir)) {
      await rm(testCharDir, { recursive: true, force: true });
    }
  });

  describe('constants', () => {
    it('should have correct max images per character', () => {
      expect(MAX_IMAGES_PER_CHARACTER).toBe(5);
    });

    it('should have correct max file size (5MB)', () => {
      expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    });

    it('should allow PNG, JPEG, and WebP', () => {
      expect(ALLOWED_MIME_TYPES['image/png']).toBe('png');
      expect(ALLOWED_MIME_TYPES['image/jpeg']).toBe('jpg');
      expect(ALLOWED_MIME_TYPES['image/webp']).toBe('webp');
    });
  });

  describe('saveCharacterImage', () => {
    it('should save an image and return index 0 for first image', async () => {
      const buffer = createTestPngBuffer();
      const index = await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png');

      expect(index).toBe(0);

      // Verify file exists
      const charDir = join(TEST_DATA_DIR, TEST_CHARACTER_ID);
      expect(existsSync(charDir)).toBe(true);

      const files = await readdir(charDir);
      expect(files).toContain('ref_0.png');
    });

    it('should increment index for subsequent images', async () => {
      const buffer = createTestPngBuffer();

      const index1 = await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png');
      const index2 = await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'jpg');
      const index3 = await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'webp');

      expect(index1).toBe(0);
      expect(index2).toBe(1);
      expect(index3).toBe(2);
    });

    it('should throw error for invalid character ID (path traversal)', async () => {
      const buffer = createTestPngBuffer();

      await expect(
        saveCharacterImage('../../../etc/passwd', buffer, 'png')
      ).rejects.toThrow('Invalid character ID');
    });
  });

  describe('getCharacterImage', () => {
    it('should retrieve a saved image', async () => {
      const originalBuffer = createTestPngBuffer();
      await saveCharacterImage(TEST_CHARACTER_ID, originalBuffer, 'png');

      const result = await getCharacterImage(TEST_CHARACTER_ID, 0);

      expect(result).not.toBeNull();
      expect(result!.extension).toBe('png');
      expect(result!.mimeType).toBe('image/png');
      expect(result!.buffer).toEqual(originalBuffer);
    });

    it('should return null for non-existent image', async () => {
      const result = await getCharacterImage(TEST_CHARACTER_ID, 99);
      expect(result).toBeNull();
    });

    it('should return null for non-existent character', async () => {
      const result = await getCharacterImage('nonexistent', 0);
      expect(result).toBeNull();
    });

    it('should return null for invalid character ID', async () => {
      const result = await getCharacterImage('../etc/passwd', 0);
      expect(result).toBeNull();
    });
  });

  describe('deleteCharacterImage', () => {
    it('should delete a specific image', async () => {
      const buffer = createTestPngBuffer();
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png');
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'jpg');

      const deleted = await deleteCharacterImage(TEST_CHARACTER_ID, 0);
      expect(deleted).toBe(true);

      // Verify first image is gone
      const result0 = await getCharacterImage(TEST_CHARACTER_ID, 0);
      expect(result0).toBeNull();

      // Verify second image still exists
      const result1 = await getCharacterImage(TEST_CHARACTER_ID, 1);
      expect(result1).not.toBeNull();
    });

    it('should return false for non-existent image', async () => {
      const deleted = await deleteCharacterImage(TEST_CHARACTER_ID, 99);
      expect(deleted).toBe(false);
    });

    it('should return false for non-existent character', async () => {
      const deleted = await deleteCharacterImage('nonexistent', 0);
      expect(deleted).toBe(false);
    });
  });

  describe('deleteCharacterImages', () => {
    it('should delete all images for a character', async () => {
      const buffer = createTestPngBuffer();
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png');
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'jpg');

      await deleteCharacterImages(TEST_CHARACTER_ID);

      // Verify directory is gone
      const charDir = join(TEST_DATA_DIR, TEST_CHARACTER_ID);
      expect(existsSync(charDir)).toBe(false);
    });

    it('should not throw for non-existent character', async () => {
      await expect(deleteCharacterImages('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('getImageIndices', () => {
    it('should return empty array for character with no images', async () => {
      const indices = await getImageIndices(TEST_CHARACTER_ID);
      expect(indices).toEqual([]);
    });

    it('should return sorted indices', async () => {
      const buffer = createTestPngBuffer();
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png');
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'jpg');
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'webp');

      const indices = await getImageIndices(TEST_CHARACTER_ID);
      expect(indices).toEqual([0, 1, 2]);
    });

    it('should handle gaps in indices', async () => {
      const buffer = createTestPngBuffer();
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png'); // 0
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'jpg'); // 1
      await deleteCharacterImage(TEST_CHARACTER_ID, 0);

      const indices = await getImageIndices(TEST_CHARACTER_ID);
      expect(indices).toEqual([1]);
    });
  });

  describe('getImageCount', () => {
    it('should return 0 for character with no images', async () => {
      const count = await getImageCount(TEST_CHARACTER_ID);
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      const buffer = createTestPngBuffer();
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png');
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'jpg');

      const count = await getImageCount(TEST_CHARACTER_ID);
      expect(count).toBe(2);
    });
  });

  describe('buildImageUrl', () => {
    it('should build correct URL', () => {
      const url = buildImageUrl('char123', 2);
      expect(url).toBe('/api/v1/characters/char123/images/2');
    });
  });

  describe('buildImageUrls', () => {
    it('should return empty array for character with no images', async () => {
      const urls = await buildImageUrls(TEST_CHARACTER_ID);
      expect(urls).toEqual([]);
    });

    it('should return URLs for all images', async () => {
      const buffer = createTestPngBuffer();
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'png');
      await saveCharacterImage(TEST_CHARACTER_ID, buffer, 'jpg');

      const urls = await buildImageUrls(TEST_CHARACTER_ID);
      expect(urls).toEqual([
        `/api/v1/characters/${TEST_CHARACTER_ID}/images/0`,
        `/api/v1/characters/${TEST_CHARACTER_ID}/images/1`,
      ]);
    });
  });
});
