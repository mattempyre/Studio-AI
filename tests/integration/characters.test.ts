import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import { rm } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { Express } from 'express';

let app: Express;

// Test data directory for character images
const TEST_DATA_DIR = join(process.cwd(), 'data', 'characters');

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

// Create a simple JPEG image buffer
const createTestJpegBuffer = (): Buffer => {
  // Minimal valid JPEG
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7d,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6,
    0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01,
    0x00, 0x00, 0x3f, 0x00, 0xfb, 0xd5, 0xdb, 0x20, 0xa8, 0xf3, 0xff, 0xd9,
  ]);
};

beforeAll(async () => {
  app = await createTestApp();
});

// Clean up character image directories after each test
afterEach(async () => {
  // Note: This is a best-effort cleanup. In a real scenario,
  // we'd want to track created characters and clean up their directories
});

describe('Characters API', () => {
  describe('GET /api/v1/characters', () => {
    it('should return empty array when no characters exist', async () => {
      const response = await request(app)
        .get('/api/v1/characters')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return list of characters sorted alphabetically by name', async () => {
      // Create characters in non-alphabetical order
      await request(app).post('/api/v1/characters').send({ name: 'Zara' });
      await request(app).post('/api/v1/characters').send({ name: 'Alex' });
      await request(app).post('/api/v1/characters').send({ name: 'Maya' });

      const response = await request(app)
        .get('/api/v1/characters')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(3);
      expect(response.body.data[0].name).toBe('Alex');
      expect(response.body.data[1].name).toBe('Maya');
      expect(response.body.data[2].name).toBe('Zara');
    });
  });

  describe('POST /api/v1/characters', () => {
    it('should create a new character with required fields only', async () => {
      const response = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Alex' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Alex');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.referenceImages).toEqual([]);
    });

    it('should create a character with all fields', async () => {
      const response = await request(app)
        .post('/api/v1/characters')
        .send({
          name: 'Jordan',
          description: 'A tech enthusiast who loves AI',
          styleLora: 'realistic-portrait-v1',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Jordan');
      expect(response.body.data.description).toBe('A tech enthusiast who loves AI');
      expect(response.body.data.styleLora).toBe('realistic-portrait-v1');
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/characters')
        .send({ description: 'No name provided' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is empty', async () => {
      const response = await request(app)
        .post('/api/v1/characters')
        .send({ name: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name exceeds 100 characters', async () => {
      const longName = 'A'.repeat(101);
      const response = await request(app)
        .post('/api/v1/characters')
        .send({ name: longName })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when description exceeds 2000 characters', async () => {
      const longDesc = 'A'.repeat(2001);
      const response = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Test', description: longDesc })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/characters/:id', () => {
    it('should return a character by id', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Get Test Character' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/characters/${characterId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(characterId);
      expect(response.body.data.name).toBe('Get Test Character');
    });

    it('should return 404 for non-existent character', async () => {
      const response = await request(app)
        .get('/api/v1/characters/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/characters/:id', () => {
    it('should update character name', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Original Name' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/characters/${characterId}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should update multiple fields', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Multi Update' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/characters/${characterId}`)
        .send({
          name: 'New Name',
          description: 'New Description',
          styleLora: 'new-style-lora',
        })
        .expect(200);

      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.description).toBe('New Description');
      expect(response.body.data.styleLora).toBe('new-style-lora');
    });

    it('should not allow direct update of referenceImages', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Image Update Test' });

      const characterId = createResponse.body.data.id;

      // Try to update referenceImages directly
      await request(app)
        .put(`/api/v1/characters/${characterId}`)
        .send({ referenceImages: ['http://example.com/fake.jpg'] })
        .expect(200);

      // Verify referenceImages was NOT updated
      const getResponse = await request(app)
        .get(`/api/v1/characters/${characterId}`)
        .expect(200);

      expect(getResponse.body.data.referenceImages).toEqual([]);
    });

    it('should return 404 for non-existent character', async () => {
      const response = await request(app)
        .put('/api/v1/characters/nonexistent123')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/characters/:id', () => {
    it('should delete a character', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'To Delete' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/v1/characters/${characterId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);

      // Verify it's deleted
      await request(app)
        .get(`/api/v1/characters/${characterId}`)
        .expect(404);
    });

    it('should delete character images when character is deleted', async () => {
      // Create character
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'With Images' });

      const characterId = createResponse.body.data.id;

      // Upload an image
      await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestPngBuffer(), 'test.png')
        .expect(201);

      // Delete the character
      await request(app)
        .delete(`/api/v1/characters/${characterId}`)
        .expect(200);

      // Verify image directory is cleaned up
      const charDir = join(TEST_DATA_DIR, characterId);
      expect(existsSync(charDir)).toBe(false);
    });

    it('should return 404 for non-existent character', async () => {
      const response = await request(app)
        .delete('/api/v1/characters/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/characters/:id/images', () => {
    it('should upload a PNG image', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Image Upload Test' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestPngBuffer(), 'test.png')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.index).toBe(0);
      expect(response.body.data.url).toBe(`/api/v1/characters/${characterId}/images/0`);

      // Verify referenceImages was updated
      const getResponse = await request(app)
        .get(`/api/v1/characters/${characterId}`)
        .expect(200);

      expect(getResponse.body.data.referenceImages).toHaveLength(1);
      expect(getResponse.body.data.referenceImages[0]).toBe(`/api/v1/characters/${characterId}/images/0`);

      // Cleanup
      await rm(join(TEST_DATA_DIR, characterId), { recursive: true, force: true });
    });

    it('should upload a JPEG image', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'JPEG Upload Test' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestJpegBuffer(), 'test.jpg')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.index).toBe(0);

      // Cleanup
      await rm(join(TEST_DATA_DIR, characterId), { recursive: true, force: true });
    });

    it('should upload multiple images', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Multiple Images Test' });

      const characterId = createResponse.body.data.id;

      // Upload first image
      const response1 = await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestPngBuffer(), 'test1.png')
        .expect(201);

      expect(response1.body.data.index).toBe(0);

      // Upload second image
      const response2 = await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestPngBuffer(), 'test2.png')
        .expect(201);

      expect(response2.body.data.index).toBe(1);

      // Verify referenceImages array
      const getResponse = await request(app)
        .get(`/api/v1/characters/${characterId}`)
        .expect(200);

      expect(getResponse.body.data.referenceImages).toHaveLength(2);

      // Cleanup
      await rm(join(TEST_DATA_DIR, characterId), { recursive: true, force: true });
    });

    it('should reject upload when maximum images reached', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Max Images Test' });

      const characterId = createResponse.body.data.id;

      // Upload 5 images
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post(`/api/v1/characters/${characterId}/images`)
          .attach('image', createTestPngBuffer(), `test${i}.png`)
          .expect(201);
      }

      // Try to upload 6th image
      const response = await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestPngBuffer(), 'test6.png')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LIMIT_EXCEEDED');

      // Cleanup
      await rm(join(TEST_DATA_DIR, characterId), { recursive: true, force: true });
    });

    it('should return 404 for non-existent character', async () => {
      const response = await request(app)
        .post('/api/v1/characters/nonexistent123/images')
        .attach('image', createTestPngBuffer(), 'test.png')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when no image provided', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'No Image Test' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid file type', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Invalid Type Test' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', Buffer.from('not an image'), { filename: 'test.txt', contentType: 'text/plain' })
        .expect(500); // Multer error becomes 500

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/characters/:id/images/:index', () => {
    it('should retrieve an uploaded image', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Get Image Test' });

      const characterId = createResponse.body.data.id;
      const originalBuffer = createTestPngBuffer();

      // Upload an image
      await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', originalBuffer, 'test.png')
        .expect(201);

      // Retrieve the image
      const response = await request(app)
        .get(`/api/v1/characters/${characterId}/images/0`)
        .expect(200);

      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['cache-control']).toBe('public, max-age=86400');
      expect(response.body).toEqual(originalBuffer);

      // Cleanup
      await rm(join(TEST_DATA_DIR, characterId), { recursive: true, force: true });
    });

    it('should return 404 for non-existent image', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'No Image Here' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/characters/${characterId}/images/0`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for non-existent character', async () => {
      const response = await request(app)
        .get('/api/v1/characters/nonexistent123/images/0')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid index', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Invalid Index Test' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/characters/${characterId}/images/invalid`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for negative index', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Negative Index Test' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/characters/${characterId}/images/-1`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/characters/:id/images/:index', () => {
    it('should delete a specific image', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Delete Image Test' });

      const characterId = createResponse.body.data.id;

      // Upload two images
      await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestPngBuffer(), 'test1.png')
        .expect(201);

      await request(app)
        .post(`/api/v1/characters/${characterId}/images`)
        .attach('image', createTestPngBuffer(), 'test2.png')
        .expect(201);

      // Delete first image
      const response = await request(app)
        .delete(`/api/v1/characters/${characterId}/images/0`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);

      // Verify first image is gone
      await request(app)
        .get(`/api/v1/characters/${characterId}/images/0`)
        .expect(404);

      // Verify second image still exists
      await request(app)
        .get(`/api/v1/characters/${characterId}/images/1`)
        .expect(200);

      // Verify referenceImages array was updated
      const getResponse = await request(app)
        .get(`/api/v1/characters/${characterId}`)
        .expect(200);

      expect(getResponse.body.data.referenceImages).toHaveLength(1);
      expect(getResponse.body.data.referenceImages[0]).toBe(`/api/v1/characters/${characterId}/images/1`);

      // Cleanup
      await rm(join(TEST_DATA_DIR, characterId), { recursive: true, force: true });
    });

    it('should return 404 for non-existent image', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'No Image To Delete' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/v1/characters/${characterId}/images/0`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for non-existent character', async () => {
      const response = await request(app)
        .delete('/api/v1/characters/nonexistent123/images/0')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid index', async () => {
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Invalid Delete Index' });

      const characterId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/v1/characters/${characterId}/images/invalid`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
