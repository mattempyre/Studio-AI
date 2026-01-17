/**
 * Integration Tests for Long-Form Script Generation API
 * STORY-006: Tests the full generation flow from outline to script
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createTestApp, resetTestDatabase } from '../helpers/app.js';
import { db, projects, scriptOutlines, sections, sentences, generationJobs } from '../../src/backend/db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Express } from 'express';

// Mock the Deepseek client
vi.mock('../../src/backend/clients/deepseek.js', () => ({
  getDeepseekClient: () => ({
    generateOutline: vi.fn().mockResolvedValue({
      title: 'Test Documentary',
      totalTargetMinutes: 30,
      sections: [
        { index: 0, title: 'Introduction', description: 'Opening', targetMinutes: 10, keyPoints: ['Hook'] },
        { index: 1, title: 'Main Content', description: 'Body', targetMinutes: 15, keyPoints: ['Detail'] },
        { index: 2, title: 'Conclusion', description: 'Ending', targetMinutes: 5, keyPoints: ['Summary'] },
      ],
    }),
    generateSectionWithContext: vi.fn().mockResolvedValue({
      sectionIndex: 0,
      title: 'Introduction',
      sentences: [
        { text: 'Welcome to the documentary.', imagePrompt: 'Opening shot', videoPrompt: 'zoom out' },
        { text: 'Today we explore an amazing topic.', imagePrompt: 'Topic visual', videoPrompt: 'pan right' },
      ],
      sentenceCount: 2,
      wordCount: 10,
      durationMinutes: 0.1,
    }),
  }),
  DeepseekError: class DeepseekError extends Error {
    constructor(message: string, public code: string) {
      super(message);
    }
  },
}));

// Mock Inngest to prevent actual event sending
vi.mock('../../src/backend/inngest/client.js', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['test-id'] }),
  },
}));

describe('Scripts API Integration Tests', () => {
  let app: Express;
  let testProjectId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await resetTestDatabase();
  });

  beforeEach(async () => {
    // Clear relevant tables
    await db.delete(generationJobs);
    await db.delete(sentences);
    await db.delete(sections);
    await db.delete(scriptOutlines);
    await db.delete(projects);

    // Create a test project
    testProjectId = nanoid();
    await db.insert(projects).values({
      id: testProjectId,
      name: 'Test Project',
      topic: 'Test Topic',
      targetDuration: 30,
      visualStyle: 'cinematic',
      status: 'draft',
    });
  });

  describe('POST /api/v1/projects/:projectId/generate-outline', () => {
    it('should generate an outline for a valid project', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-outline`)
        .send({
          topic: 'The History of Space Exploration',
          targetDurationMinutes: 30,
          visualStyle: 'cinematic documentary',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.outlineId).toBeDefined();
      expect(response.body.data.title).toBe('Test Documentary');
      expect(response.body.data.sections).toHaveLength(3);
    });

    it('should save outline to database', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-outline`)
        .send({
          topic: 'Space',
          targetDurationMinutes: 30,
        });

      const outlineId = response.body.data.outlineId;
      const savedOutline = await db.select()
        .from(scriptOutlines)
        .where(eq(scriptOutlines.id, outlineId))
        .get();

      expect(savedOutline).toBeDefined();
      expect(savedOutline?.status).toBe('draft');
      expect(savedOutline?.projectId).toBe(testProjectId);
    });

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .post('/api/v1/projects/non-existent/generate-outline')
        .send({
          topic: 'Test',
          targetDurationMinutes: 30,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for invalid duration', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-outline`)
        .send({
          topic: 'Test',
          targetDurationMinutes: 500, // Exceeds max 180
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for missing topic', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-outline`)
        .send({
          targetDurationMinutes: 30,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/projects/:projectId/generate-script', () => {
    it('should queue script generation in auto mode', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-script`)
        .send({
          mode: 'auto',
          topic: 'Space Exploration',
          targetDurationMinutes: 30,
          visualStyle: 'cinematic',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
      expect(response.body.data.status).toBe('queued');
    });

    it('should create job record for generation', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-script`)
        .send({
          mode: 'auto',
          topic: 'Space',
          targetDurationMinutes: 30,
        });

      const jobId = response.body.data.jobId;
      const job = await db.select()
        .from(generationJobs)
        .where(eq(generationJobs.id, jobId))
        .get();

      expect(job).toBeDefined();
      expect(job?.jobType).toBe('script-long');
      expect(job?.projectId).toBe(testProjectId);
    });

    it('should accept from-outline mode with valid outline', async () => {
      // First create an outline
      const outlineResponse = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-outline`)
        .send({
          topic: 'Space',
          targetDurationMinutes: 30,
        });

      const outlineId = outlineResponse.body.data.outlineId;

      // Then generate from outline
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-script`)
        .send({
          mode: 'from-outline',
          outlineId,
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
    });

    it('should return 400 for from-outline mode without outlineId', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-script`)
        .send({
          mode: 'from-outline',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 for auto mode without topic', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-script`)
        .send({
          mode: 'auto',
          targetDurationMinutes: 30,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent outline', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/generate-script`)
        .send({
          mode: 'from-outline',
          outlineId: 'non-existent-outline',
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/projects/:projectId/outlines', () => {
    it('should return all outlines for a project', async () => {
      // Create multiple outlines
      await db.insert(scriptOutlines).values([
        {
          id: nanoid(),
          projectId: testProjectId,
          title: 'Outline 1',
          topic: 'Topic 1',
          totalTargetMinutes: 30,
          visualStyle: 'cinematic',
          sections: [],
          status: 'draft',
        },
        {
          id: nanoid(),
          projectId: testProjectId,
          title: 'Outline 2',
          topic: 'Topic 2',
          totalTargetMinutes: 60,
          visualStyle: 'documentary',
          sections: [],
          status: 'completed',
        },
      ]);

      const response = await request(app)
        .get(`/api/v1/projects/${testProjectId}/outlines`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return empty array for project with no outlines', async () => {
      const response = await request(app)
        .get(`/api/v1/projects/${testProjectId}/outlines`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/v1/projects/:projectId/outlines/:outlineId', () => {
    it('should return specific outline details', async () => {
      const outlineId = nanoid();
      const sectionData = [
        { index: 0, title: 'Intro', description: 'Opening', targetMinutes: 10, keyPoints: ['A'], status: 'pending' as const },
      ];

      await db.insert(scriptOutlines).values({
        id: outlineId,
        projectId: testProjectId,
        title: 'Test Outline',
        topic: 'Test Topic',
        totalTargetMinutes: 30,
        visualStyle: 'cinematic',
        sections: sectionData,
        status: 'draft',
      });

      const response = await request(app)
        .get(`/api/v1/projects/${testProjectId}/outlines/${outlineId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(outlineId);
      expect(response.body.data.title).toBe('Test Outline');
    });

    it('should return 404 for non-existent outline', async () => {
      const response = await request(app)
        .get(`/api/v1/projects/${testProjectId}/outlines/non-existent`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/projects/:projectId/outlines/:outlineId', () => {
    let outlineId: string;

    beforeEach(async () => {
      outlineId = nanoid();
      await db.insert(scriptOutlines).values({
        id: outlineId,
        projectId: testProjectId,
        title: 'Original Title',
        topic: 'Test Topic',
        totalTargetMinutes: 30,
        visualStyle: 'cinematic',
        sections: [
          { index: 0, title: 'Section 1', description: 'Desc', targetMinutes: 30, keyPoints: [], status: 'pending' as const },
        ],
        status: 'draft',
      });
    });

    it('should update outline title', async () => {
      const response = await request(app)
        .put(`/api/v1/projects/${testProjectId}/outlines/${outlineId}`)
        .send({
          title: 'Updated Title',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Updated Title');
    });

    it('should update outline sections', async () => {
      const newSections = [
        { title: 'New Section 1', description: 'New Desc 1', targetMinutes: 15, keyPoints: ['A'] },
        { title: 'New Section 2', description: 'New Desc 2', targetMinutes: 15, keyPoints: ['B'] },
      ];

      const response = await request(app)
        .put(`/api/v1/projects/${testProjectId}/outlines/${outlineId}`)
        .send({
          sections: newSections,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.sections).toHaveLength(2);
      expect(response.body.data.totalTargetMinutes).toBe(30); // Recalculated
    });

    it('should reject update for non-draft outline', async () => {
      // Mark outline as generating
      await db.update(scriptOutlines)
        .set({ status: 'generating' })
        .where(eq(scriptOutlines.id, outlineId));

      const response = await request(app)
        .put(`/api/v1/projects/${testProjectId}/outlines/${outlineId}`)
        .send({
          title: 'Should Fail',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_STATE');
    });
  });

  describe('POST /api/v1/projects/:projectId/outlines/:outlineId/regenerate-section', () => {
    let outlineId: string;
    let sectionId: string;

    beforeEach(async () => {
      outlineId = nanoid();
      sectionId = nanoid();

      // Create outline
      await db.insert(scriptOutlines).values({
        id: outlineId,
        projectId: testProjectId,
        title: 'Test Outline',
        topic: 'Test Topic',
        totalTargetMinutes: 30,
        visualStyle: 'cinematic',
        sections: [
          { index: 0, title: 'Section 1', description: 'Desc', targetMinutes: 30, keyPoints: ['A'], status: 'completed' as const },
        ],
        status: 'completed',
        runningSummary: 'Previous content summary',
      });

      // Create section and sentences
      await db.insert(sections).values({
        id: sectionId,
        projectId: testProjectId,
        title: 'Section 1',
        order: 0,
      });

      await db.insert(sentences).values([
        { id: nanoid(), sectionId, text: 'Old sentence 1', order: 0, status: 'completed' },
        { id: nanoid(), sectionId, text: 'Old sentence 2', order: 1, status: 'completed' },
      ]);
    });

    it('should regenerate a section', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/outlines/${outlineId}/regenerate-section`)
        .send({
          sectionIndex: 0,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.sectionIndex).toBe(0);
    });

    it('should return 400 for invalid section index', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/outlines/${outlineId}/regenerate-section`)
        .send({
          sectionIndex: 99,
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent outline', async () => {
      const response = await request(app)
        .post(`/api/v1/projects/${testProjectId}/outlines/non-existent/regenerate-section`)
        .send({
          sectionIndex: 0,
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/projects/:projectId/generation-status (SSE)', () => {
    // Note: SSE testing with supertest is complex because the connection stays open.
    // The endpoint is tested via manual testing and the underlying logic is
    // covered by other tests.
    it.skip('should establish SSE connection (skipped: requires real browser/EventSource)', async () => {
      // SSE connections are long-lived and supertest waits for response to complete.
      // This test would require browser-level testing or a dedicated SSE test client.
      expect(true).toBe(true);
    });
  });
});

describe('Long-Form Generation Flow', () => {
  let app: Express;
  let testProjectId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await db.delete(generationJobs);
    await db.delete(sentences);
    await db.delete(sections);
    await db.delete(scriptOutlines);
    await db.delete(projects);

    testProjectId = nanoid();
    await db.insert(projects).values({
      id: testProjectId,
      name: 'Flow Test Project',
      topic: 'Flow Test Topic',
      targetDuration: 30,
      visualStyle: 'cinematic',
      status: 'draft',
    });
  });

  it('should complete outline → approve → generate flow', async () => {
    // Step 1: Generate outline
    const outlineResponse = await request(app)
      .post(`/api/v1/projects/${testProjectId}/generate-outline`)
      .send({
        topic: 'Complete Flow Test',
        targetDurationMinutes: 30,
        visualStyle: 'cinematic documentary',
      });

    expect(outlineResponse.status).toBe(201);
    const outlineId = outlineResponse.body.data.outlineId;

    // Verify outline saved
    const savedOutline = await db.select()
      .from(scriptOutlines)
      .where(eq(scriptOutlines.id, outlineId))
      .get();
    expect(savedOutline?.status).toBe('draft');

    // Step 2: Optionally edit outline
    const editResponse = await request(app)
      .put(`/api/v1/projects/${testProjectId}/outlines/${outlineId}`)
      .send({
        title: 'Edited Title for Flow Test',
      });

    expect(editResponse.status).toBe(200);
    expect(editResponse.body.data.title).toBe('Edited Title for Flow Test');

    // Step 3: Trigger generation from outline
    const generateResponse = await request(app)
      .post(`/api/v1/projects/${testProjectId}/generate-script`)
      .send({
        mode: 'from-outline',
        outlineId,
      });

    expect(generateResponse.status).toBe(202);
    expect(generateResponse.body.data.jobId).toBeDefined();

    // Verify outline marked as approved
    const approvedOutline = await db.select()
      .from(scriptOutlines)
      .where(eq(scriptOutlines.id, outlineId))
      .get();
    expect(approvedOutline?.status).toBe('approved');

    // Verify job created
    const job = await db.select()
      .from(generationJobs)
      .where(eq(generationJobs.id, generateResponse.body.data.jobId))
      .get();
    expect(job?.jobType).toBe('script-long');
    expect(job?.projectId).toBe(testProjectId);
  });

  it('should support auto mode (topic → script)', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${testProjectId}/generate-script`)
      .send({
        mode: 'auto',
        topic: 'Auto Mode Test Topic',
        targetDurationMinutes: 15,
        visualStyle: 'educational',
      });

    expect(response.status).toBe(202);
    expect(response.body.success).toBe(true);

    // Job should be created with estimated sections
    expect(response.body.data.totalSections).toBe(2); // 15 min / 8 min per section ≈ 2
    expect(response.body.data.estimatedDurationSeconds).toBeGreaterThan(0);
  });
});
