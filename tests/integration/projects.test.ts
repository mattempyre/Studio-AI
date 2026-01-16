import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

describe('Projects API', () => {
  describe('GET /api/v1/projects', () => {
    it('should return empty array when no projects exist', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('should return list of projects after creating one', async () => {
      // Create a project first
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Test Project' });

      expect(createResponse.status).toBe(201);

      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].name).toBe('Test Project');
    });
  });

  describe('POST /api/v1/projects', () => {
    it('should create a new project with required fields only', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'My New Project' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('My New Project');
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('draft');
    });

    it('should create a project with all optional fields', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({
          name: 'Full Project',
          topic: 'AI Video Generation',
          targetDuration: 15,
          visualStyle: 'documentary',
          voiceId: 'kore',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Full Project');
      expect(response.body.data.topic).toBe('AI Video Generation');
      expect(response.body.data.targetDuration).toBe(15);
      expect(response.body.data.visualStyle).toBe('documentary');
      expect(response.body.data.voiceId).toBe('kore');
    });

    it('should apply default values when not provided', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Defaults Test' })
        .expect(201);

      expect(response.body.data.targetDuration).toBe(8);
      expect(response.body.data.visualStyle).toBe('cinematic');
      expect(response.body.data.voiceId).toBe('puck');
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({ topic: 'No name provided' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when name is empty', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({ name: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when targetDuration is out of range', async () => {
      const response = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Test', targetDuration: 200 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should return a project by id', async () => {
      // Create a project first
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Get Test' });

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(projectId);
      expect(response.body.data.name).toBe('Get Test');
      expect(response.body.data.sections).toEqual([]);
      expect(response.body.data.cast).toEqual([]);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/v1/projects/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    it('should update project name', async () => {
      // Create a project first
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Original Name' });

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
    });

    it('should update multiple fields', async () => {
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Multi Update' });

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .send({
          name: 'New Name',
          topic: 'New Topic',
          targetDuration: 20,
        })
        .expect(200);

      expect(response.body.data.name).toBe('New Name');
      expect(response.body.data.topic).toBe('New Topic');
      expect(response.body.data.targetDuration).toBe(20);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/api/v1/projects/nonexistent123')
        .send({ name: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should validate update data', async () => {
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Validate Test' });

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/projects/${projectId}`)
        .send({ targetDuration: 500 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete a project', async () => {
      // Create a project first
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'To Delete' });

      const projectId = createResponse.body.data.id;

      const response = await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.deleted).toBe(true);

      // Verify it's deleted
      await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(404);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .delete('/api/v1/projects/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
