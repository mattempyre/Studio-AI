import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import type { Express } from 'express';

// Mock the Deepseek client for AI expansion tests
vi.mock('../../src/backend/clients/deepseek.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/backend/clients/deepseek.js')>();
  return {
    ...actual,
    getDeepseekClient: vi.fn(() => ({
      expandSection: vi.fn().mockResolvedValue({
        sentences: [
          {
            text: 'This is an AI-generated sentence.',
            imagePrompt: 'A visual representation of the content',
            videoPrompt: 'Slow pan across the scene',
          },
          {
            text: 'Another AI-generated sentence follows.',
            imagePrompt: 'Another visual scene',
            videoPrompt: 'Zoom in on details',
          },
        ],
      }),
    })),
  };
});

let app: Express;
let testProjectId: string;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  // Create a fresh project for each test
  const response = await request(app)
    .post('/api/v1/projects')
    .send({ name: 'Test Project for Sections' });
  testProjectId = response.body.data.id;
});

describe('Sections API', () => {
  describe('POST /api/v1/sections', () => {
    it('should create a new section', async () => {
      const response = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Introduction',
          order: 0,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Introduction');
      expect(response.body.data.projectId).toBe(testProjectId);
      expect(response.body.data.order).toBe(0);
      expect(response.body.data.id).toBeDefined();
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sections')
        .send({
          title: 'No Project',
          order: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when title is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          order: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when project does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: 'nonexistent123',
          title: 'Test',
          order: 0,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/sections/:id', () => {
    it('should return a section with its sentences', async () => {
      // Create a section
      const createResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Get Test Section',
          order: 0,
        });

      const sectionId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/sections/${sectionId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sectionId);
      expect(response.body.data.title).toBe('Get Test Section');
      expect(response.body.data.sentences).toEqual([]);
    });

    it('should return 404 for non-existent section', async () => {
      const response = await request(app)
        .get('/api/v1/sections/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/sections/:id', () => {
    it('should update section title', async () => {
      // Create a section
      const createResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Original Title',
          order: 0,
        });

      const sectionId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/sections/${sectionId}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
    });

    it('should update section order', async () => {
      const createResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Test Order',
          order: 0,
        });

      const sectionId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/sections/${sectionId}`)
        .send({ order: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.order).toBe(5);
    });

    it('should return 404 for non-existent section', async () => {
      const response = await request(app)
        .put('/api/v1/sections/nonexistent123')
        .send({ title: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/sections/:id', () => {
    it('should delete a section', async () => {
      // Create a section
      const createResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'To Delete',
          order: 0,
        });

      const sectionId = createResponse.body.data.id;

      await request(app)
        .delete(`/api/v1/sections/${sectionId}`)
        .expect(204);

      // Verify it's deleted
      await request(app)
        .get(`/api/v1/sections/${sectionId}`)
        .expect(404);
    });

    it('should return 404 for non-existent section', async () => {
      const response = await request(app)
        .delete('/api/v1/sections/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/sections/reorder', () => {
    it('should reorder sections', async () => {
      // Create multiple sections
      const section1 = await request(app)
        .post('/api/v1/sections')
        .send({ projectId: testProjectId, title: 'Section 1', order: 0 });

      const section2 = await request(app)
        .post('/api/v1/sections')
        .send({ projectId: testProjectId, title: 'Section 2', order: 1 });

      const section3 = await request(app)
        .post('/api/v1/sections')
        .send({ projectId: testProjectId, title: 'Section 3', order: 2 });

      // Reorder: 3, 1, 2
      const response = await request(app)
        .post('/api/v1/sections/reorder')
        .send({
          projectId: testProjectId,
          sectionIds: [
            section3.body.data.id,
            section1.body.data.id,
            section2.body.data.id,
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify order by fetching the project
      const projectResponse = await request(app)
        .get(`/api/v1/projects/${testProjectId}`)
        .expect(200);

      expect(projectResponse.body.data.sections[0].title).toBe('Section 3');
      expect(projectResponse.body.data.sections[1].title).toBe('Section 1');
      expect(projectResponse.body.data.sections[2].title).toBe('Section 2');
    });

    it('should return 400 when projectId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sections/reorder')
        .send({ sectionIds: ['a', 'b'] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when project does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/sections/reorder')
        .send({
          projectId: 'nonexistent123',
          sectionIds: ['a', 'b'],
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/sections/:id/ai-expand', () => {
    it('should generate sentences using AI in quick mode', async () => {
      // Create a section first
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'AI Expansion Test Section',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand`)
        .send({
          mode: 'quick',
          sentenceCount: 2,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sectionId).toBe(sectionId);
      expect(response.body.data.generatedSentences).toHaveLength(2);
      expect(response.body.data.generatedSentences[0].text).toBeDefined();
      expect(response.body.data.generatedSentences[0].imagePrompt).toBeDefined();
    });

    it('should generate sentences using AI in guided mode', async () => {
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Guided Mode Test',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand`)
        .send({
          mode: 'guided',
          prompt: 'Add more detail about the topic',
          sentenceCount: 2,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.generatedSentences).toHaveLength(2);
    });

    it('should return 404 for non-existent section', async () => {
      const response = await request(app)
        .post('/api/v1/sections/nonexistent123/ai-expand')
        .send({
          mode: 'quick',
          sentenceCount: 2,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 for invalid mode', async () => {
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Invalid Mode Test',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand`)
        .send({
          mode: 'invalid',
          sentenceCount: 2,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid sentenceCount', async () => {
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Invalid Count Test',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand`)
        .send({
          mode: 'quick',
          sentenceCount: 10, // Max is 5
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/sections/:id/ai-expand/accept', () => {
    it('should accept and save generated sentences', async () => {
      // Create a section
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Accept Test Section',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      // Accept generated sentences
      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand/accept`)
        .send({
          generatedSentences: [
            {
              text: 'First generated sentence',
              imagePrompt: 'Image for first sentence',
              videoPrompt: 'Video for first sentence',
            },
            {
              text: 'Second generated sentence',
              imagePrompt: 'Image for second sentence',
              videoPrompt: 'Video for second sentence',
            },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insertedCount).toBe(2);
      expect(response.body.data.sentences).toHaveLength(2);
      expect(response.body.data.sentences[0].text).toBe('First generated sentence');
      expect(response.body.data.sentences[1].text).toBe('Second generated sentence');

      // Verify sentences were actually saved
      const getResponse = await request(app)
        .get(`/api/v1/sections/${sectionId}`)
        .expect(200);

      expect(getResponse.body.data.sentences).toHaveLength(2);
    });

    it('should insert sentences after a specific sentence', async () => {
      // Create a section with existing sentences
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Insert After Test',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      // Add existing sentences
      const sentence1 = await request(app)
        .post('/api/v1/sentences')
        .send({ sectionId, text: 'First existing sentence', order: 0 });

      const sentence2 = await request(app)
        .post('/api/v1/sentences')
        .send({ sectionId, text: 'Second existing sentence', order: 1 });

      // Insert new sentences after the first one
      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand/accept`)
        .send({
          generatedSentences: [
            { text: 'Inserted sentence', imagePrompt: 'img', videoPrompt: 'vid' },
          ],
          insertAfterSentenceId: sentence1.body.data.id,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.insertedCount).toBe(1);

      // Verify order
      const getResponse = await request(app)
        .get(`/api/v1/sections/${sectionId}`)
        .expect(200);

      expect(getResponse.body.data.sentences).toHaveLength(3);
      expect(getResponse.body.data.sentences[0].text).toBe('First existing sentence');
      expect(getResponse.body.data.sentences[1].text).toBe('Inserted sentence');
      expect(getResponse.body.data.sentences[2].text).toBe('Second existing sentence');
    });

    it('should return 404 for non-existent section', async () => {
      const response = await request(app)
        .post('/api/v1/sections/nonexistent123/ai-expand/accept')
        .send({
          generatedSentences: [{ text: 'Test', imagePrompt: 'img', videoPrompt: 'vid' }],
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 400 when generatedSentences is empty', async () => {
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Empty Sentences Test',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand/accept`)
        .send({
          generatedSentences: [],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when generatedSentences is missing', async () => {
      const sectionResponse = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Missing Sentences Test',
          order: 0,
        });

      const sectionId = sectionResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/sections/${sectionId}/ai-expand/accept`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
