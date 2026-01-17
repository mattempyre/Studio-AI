import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import type { Express } from 'express';

let app: Express;
let testProjectId: string;
let testSectionId: string;

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  // Create a fresh project for each test
  const projectResponse = await request(app)
    .post('/api/v1/projects')
    .send({ name: 'Test Project for Sentences' });
  testProjectId = projectResponse.body.data.id;

  // Create a section for the project
  const sectionResponse = await request(app)
    .post('/api/v1/sections')
    .send({
      projectId: testProjectId,
      title: 'Test Section',
      order: 0,
    });
  testSectionId = sectionResponse.body.data.id;
});

describe('Sentences API', () => {
  describe('POST /api/v1/sentences', () => {
    it('should create a new sentence', async () => {
      const response = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'This is a test sentence.',
          order: 0,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.text).toBe('This is a test sentence.');
      expect(response.body.data.sectionId).toBe(testSectionId);
      expect(response.body.data.order).toBe(0);
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.isAudioDirty).toBe(true);
      expect(response.body.data.isImageDirty).toBe(true);
      expect(response.body.data.isVideoDirty).toBe(true);
    });

    it('should create a sentence with optional fields', async () => {
      const response = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Test with prompts',
          order: 0,
          imagePrompt: 'A beautiful landscape',
          videoPrompt: 'Pan across the landscape',
          cameraMovement: 'pan_right',
          motionStrength: 0.7,
        })
        .expect(201);

      expect(response.body.data.imagePrompt).toBe('A beautiful landscape');
      expect(response.body.data.videoPrompt).toBe('Pan across the landscape');
      expect(response.body.data.cameraMovement).toBe('pan_right');
      expect(response.body.data.motionStrength).toBe(0.7);
    });

    it('should return 400 when sectionId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sentences')
        .send({
          text: 'No section',
          order: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when text is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          order: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when section does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: 'nonexistent123',
          text: 'Test',
          order: 0,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('GET /api/v1/sentences/:id', () => {
    it('should return a sentence by id', async () => {
      // Create a sentence
      const createResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Get test sentence',
          order: 0,
        });

      const sentenceId = createResponse.body.data.id;

      const response = await request(app)
        .get(`/api/v1/sentences/${sentenceId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(sentenceId);
      expect(response.body.data.text).toBe('Get test sentence');
    });

    it('should return 404 for non-existent sentence', async () => {
      const response = await request(app)
        .get('/api/v1/sentences/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PUT /api/v1/sentences/:id', () => {
    it('should update sentence text and mark assets as dirty', async () => {
      // Create a sentence with clean dirty flags
      const createResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Original text',
          order: 0,
        });

      const sentenceId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/sentences/${sentenceId}`)
        .send({ text: 'Updated text' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.text).toBe('Updated text');
      // Text change should mark all assets as dirty
      expect(response.body.data.isAudioDirty).toBe(true);
      expect(response.body.data.isImageDirty).toBe(true);
      expect(response.body.data.isVideoDirty).toBe(true);
    });

    it('should mark image and video as dirty when imagePrompt changes', async () => {
      const createResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Test sentence',
          order: 0,
          imagePrompt: 'Original prompt',
        });

      const sentenceId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/sentences/${sentenceId}`)
        .send({ imagePrompt: 'New prompt' })
        .expect(200);

      expect(response.body.data.imagePrompt).toBe('New prompt');
      expect(response.body.data.isImageDirty).toBe(true);
      expect(response.body.data.isVideoDirty).toBe(true);
    });

    it('should mark video as dirty when videoPrompt changes', async () => {
      const createResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Test sentence',
          order: 0,
        });

      const sentenceId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/sentences/${sentenceId}`)
        .send({ videoPrompt: 'New video prompt' })
        .expect(200);

      expect(response.body.data.videoPrompt).toBe('New video prompt');
      expect(response.body.data.isVideoDirty).toBe(true);
    });

    it('should mark video as dirty when cameraMovement changes', async () => {
      const createResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Test sentence',
          order: 0,
          cameraMovement: 'static',
        });

      const sentenceId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/sentences/${sentenceId}`)
        .send({ cameraMovement: 'zoom_in' })
        .expect(200);

      expect(response.body.data.cameraMovement).toBe('zoom_in');
      expect(response.body.data.isVideoDirty).toBe(true);
    });

    it('should return 404 for non-existent sentence', async () => {
      const response = await request(app)
        .put('/api/v1/sentences/nonexistent123')
        .send({ text: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('DELETE /api/v1/sentences/:id', () => {
    it('should delete a sentence', async () => {
      const createResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'To Delete',
          order: 0,
        });

      const sentenceId = createResponse.body.data.id;

      await request(app)
        .delete(`/api/v1/sentences/${sentenceId}`)
        .expect(204);

      // Verify it's deleted
      await request(app)
        .get(`/api/v1/sentences/${sentenceId}`)
        .expect(404);
    });

    it('should return 404 for non-existent sentence', async () => {
      const response = await request(app)
        .delete('/api/v1/sentences/nonexistent123')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/sentences/reorder', () => {
    it('should reorder sentences within a section', async () => {
      // Create multiple sentences
      const sentence1 = await request(app)
        .post('/api/v1/sentences')
        .send({ sectionId: testSectionId, text: 'Sentence 1', order: 0 });

      const sentence2 = await request(app)
        .post('/api/v1/sentences')
        .send({ sectionId: testSectionId, text: 'Sentence 2', order: 1 });

      const sentence3 = await request(app)
        .post('/api/v1/sentences')
        .send({ sectionId: testSectionId, text: 'Sentence 3', order: 2 });

      // Reorder: 3, 1, 2
      const response = await request(app)
        .post('/api/v1/sentences/reorder')
        .send({
          sectionId: testSectionId,
          sentenceIds: [
            sentence3.body.data.id,
            sentence1.body.data.id,
            sentence2.body.data.id,
          ],
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify order by fetching the section
      const sectionResponse = await request(app)
        .get(`/api/v1/sections/${testSectionId}`)
        .expect(200);

      expect(sectionResponse.body.data.sentences[0].text).toBe('Sentence 3');
      expect(sectionResponse.body.data.sentences[1].text).toBe('Sentence 1');
      expect(sectionResponse.body.data.sentences[2].text).toBe('Sentence 2');
    });

    it('should return 400 when sectionId is missing', async () => {
      const response = await request(app)
        .post('/api/v1/sentences/reorder')
        .send({ sentenceIds: ['a', 'b'] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when section does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/sentences/reorder')
        .send({
          sectionId: 'nonexistent123',
          sentenceIds: ['a', 'b'],
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/v1/sentences/:id/move', () => {
    it('should move sentence to a different section', async () => {
      // Create another section
      const section2Response = await request(app)
        .post('/api/v1/sections')
        .send({
          projectId: testProjectId,
          title: 'Section 2',
          order: 1,
        });

      const section2Id = section2Response.body.data.id;

      // Create a sentence in the first section
      const sentenceResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Moving sentence',
          order: 0,
        });

      const sentenceId = sentenceResponse.body.data.id;

      // Move sentence to section 2
      const response = await request(app)
        .post(`/api/v1/sentences/${sentenceId}/move`)
        .send({
          targetSectionId: section2Id,
          targetOrder: 0,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sectionId).toBe(section2Id);
      expect(response.body.data.order).toBe(0);

      // Verify sentence is now in section 2
      const section2 = await request(app)
        .get(`/api/v1/sections/${section2Id}`)
        .expect(200);

      expect(section2.body.data.sentences.length).toBe(1);
      expect(section2.body.data.sentences[0].text).toBe('Moving sentence');
    });

    it('should return 400 when targetSectionId is missing', async () => {
      const sentenceResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Test',
          order: 0,
        });

      const response = await request(app)
        .post(`/api/v1/sentences/${sentenceResponse.body.data.id}/move`)
        .send({ targetOrder: 0 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 when sentence does not exist', async () => {
      const response = await request(app)
        .post('/api/v1/sentences/nonexistent123/move')
        .send({
          targetSectionId: testSectionId,
          targetOrder: 0,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 when target section does not exist', async () => {
      const sentenceResponse = await request(app)
        .post('/api/v1/sentences')
        .send({
          sectionId: testSectionId,
          text: 'Test',
          order: 0,
        });

      const response = await request(app)
        .post(`/api/v1/sentences/${sentenceResponse.body.data.id}/move`)
        .send({
          targetSectionId: 'nonexistent123',
          targetOrder: 0,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
