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
    it('should return empty projects array when no projects exist', async () => {
      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toEqual([]);
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
      expect(response.body.data.projects.length).toBe(1);
      expect(response.body.data.projects[0].name).toBe('Test Project');
    });

    it('should include section and sentence counts', async () => {
      // Create a project
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Count Test Project' });

      expect(createResponse.status).toBe(201);

      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      expect(response.body.data.projects[0]).toHaveProperty('sectionCount');
      expect(response.body.data.projects[0]).toHaveProperty('sentenceCount');
      expect(response.body.data.projects[0].sectionCount).toBe(0);
      expect(response.body.data.projects[0].sentenceCount).toBe(0);
    });

    it('should sort projects by updatedAt descending', async () => {
      // Create two projects
      const proj1 = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'First Project' });

      const proj2 = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Second Project' });

      // Wait a bit then update the first project (SQLite timestamp is second precision)
      await new Promise(resolve => setTimeout(resolve, 1100));

      await request(app)
        .put(`/api/v1/projects/${proj1.body.data.id}`)
        .send({ topic: 'Updated topic' });

      const response = await request(app)
        .get('/api/v1/projects')
        .expect(200);

      // First project (updated later) should now be first in the list
      expect(response.body.data.projects[0].name).toBe('First Project');
      expect(response.body.data.projects[1].name).toBe('Second Project');
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
    it('should delete a project and return 204 No Content', async () => {
      // Create a project first
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'To Delete' });

      const projectId = createResponse.body.data.id;

      // Delete should return 204 No Content
      await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .expect(204);

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

    it('should return 400 for invalid project ID format with path traversal', async () => {
      // IDs with special characters that could be used for path traversal
      const response = await request(app)
        .delete('/api/v1/projects/proj..%2F..%2Fetc')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ID');
    });

    it('should return 400 for project ID with dots', async () => {
      const response = await request(app)
        .delete('/api/v1/projects/proj..test')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ID');
    });

    it('should cascade delete related sections and sentences', async () => {
      // Create a project
      const createResponse = await request(app)
        .post('/api/v1/projects')
        .send({ name: 'Cascade Delete Test' });

      const projectId = createResponse.body.data.id;

      // Get project to verify it exists with sections array
      const getResponse = await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(200);

      expect(getResponse.body.data.sections).toEqual([]);

      // Delete the project
      await request(app)
        .delete(`/api/v1/projects/${projectId}`)
        .expect(204);

      // Verify project is deleted
      await request(app)
        .get(`/api/v1/projects/${projectId}`)
        .expect(404);
    });
  });
});
