import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
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

    it('should return list of characters after creating one', async () => {
      // Create a character first
      const createResponse = await request(app)
        .post('/api/v1/characters')
        .send({ name: 'Alex' });

      expect(createResponse.status).toBe(201);

      const response = await request(app)
        .get('/api/v1/characters')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Alex');
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
    });

    it('should create a character with all fields', async () => {
      const response = await request(app)
        .post('/api/v1/characters')
        .send({
          name: 'Jordan',
          description: 'A tech enthusiast who loves AI',
          referenceImages: ['https://example.com/jordan1.jpg', 'https://example.com/jordan2.jpg'],
          styleLora: 'realistic-portrait-v1',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Jordan');
      expect(response.body.data.description).toBe('A tech enthusiast who loves AI');
      expect(response.body.data.referenceImages).toHaveLength(2);
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
  });

  describe('GET /api/v1/characters/:id', () => {
    it('should return a character by id', async () => {
      // Create a character first
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
      // Create a character first
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
      // Create a character first
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

    it('should return 404 for non-existent character', async () => {
      const response = await request(app)
        .delete('/api/v1/characters/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
