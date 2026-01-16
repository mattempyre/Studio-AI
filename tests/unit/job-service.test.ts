import { describe, it, expect, beforeEach } from 'vitest';
import '../setup.js';
import { jobService } from '../../src/backend/services/jobService.js';
import { db, projects, generationJobs } from '../../src/backend/db/index.js';
import { nanoid } from 'nanoid';

describe('Job Service', () => {
  let testProjectId: string;

  beforeEach(async () => {
    // Create a test project for job tests
    testProjectId = nanoid();
    await db.insert(projects).values({
      id: testProjectId,
      name: 'Test Project',
      targetDuration: 5,
      visualStyle: 'cinematic',
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  describe('create', () => {
    it('should create a new job with default status queued', async () => {
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'audio',
      });

      expect(job.id).toBeDefined();
      expect(job.projectId).toBe(testProjectId);
      expect(job.jobType).toBe('audio');
      expect(job.status).toBe('queued');
      expect(job.progress).toBe(0);
    });

    it('should create a job with inngestRunId', async () => {
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'image',
        inngestRunId: 'test-run-123',
      });

      expect(job.inngestRunId).toBe('test-run-123');
    });

    it('should create a job without sentenceId (project-level job)', async () => {
      // Jobs like 'script' or 'export' are project-level and don't have a sentenceId
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'script',
      });

      expect(job.sentenceId).toBeNull();
      expect(job.projectId).toBe(testProjectId);
      expect(job.jobType).toBe('script');
    });
  });

  describe('markRunning', () => {
    it('should update job status to running and set startedAt', async () => {
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'audio',
      });

      await jobService.markRunning(job.id, 'run-456');

      const updatedJob = await jobService.getById(job.id);
      expect(updatedJob?.status).toBe('running');
      expect(updatedJob?.inngestRunId).toBe('run-456');
      expect(updatedJob?.startedAt).not.toBeNull();
    });
  });

  describe('updateProgress', () => {
    it('should update job progress', async () => {
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'image',
      });

      await jobService.updateProgress(job.id, 50);

      const updatedJob = await jobService.getById(job.id);
      expect(updatedJob?.progress).toBe(50);
    });

    it('should clamp progress between 0 and 100', async () => {
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'image',
      });

      await jobService.updateProgress(job.id, 150);
      let updatedJob = await jobService.getById(job.id);
      expect(updatedJob?.progress).toBe(100);

      await jobService.updateProgress(job.id, -10);
      updatedJob = await jobService.getById(job.id);
      expect(updatedJob?.progress).toBe(0);
    });
  });

  describe('markCompleted', () => {
    it('should update job status to completed and set progress to 100', async () => {
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'video',
      });

      await jobService.markCompleted(job.id, '/path/to/video.mp4');

      const updatedJob = await jobService.getById(job.id);
      expect(updatedJob?.status).toBe('completed');
      expect(updatedJob?.progress).toBe(100);
      expect(updatedJob?.resultFile).toBe('/path/to/video.mp4');
      expect(updatedJob?.completedAt).not.toBeNull();
    });
  });

  describe('markFailed', () => {
    it('should update job status to failed and set error message', async () => {
      const job = await jobService.create({
        projectId: testProjectId,
        jobType: 'audio',
      });

      await jobService.markFailed(job.id, 'TTS service unavailable');

      const updatedJob = await jobService.getById(job.id);
      expect(updatedJob?.status).toBe('failed');
      expect(updatedJob?.errorMessage).toBe('TTS service unavailable');
      expect(updatedJob?.completedAt).not.toBeNull();
    });
  });

  describe('getByProject', () => {
    it('should return all jobs for a project', async () => {
      await jobService.create({ projectId: testProjectId, jobType: 'audio' });
      await jobService.create({ projectId: testProjectId, jobType: 'image' });
      await jobService.create({ projectId: testProjectId, jobType: 'video' });

      const jobs = await jobService.getByProject(testProjectId);

      expect(jobs).toHaveLength(3);
      expect(jobs.every(j => j.projectId === testProjectId)).toBe(true);
    });
  });

  describe('getActiveJobs', () => {
    it('should return only queued and running jobs', async () => {
      const job1 = await jobService.create({ projectId: testProjectId, jobType: 'audio' });
      const job2 = await jobService.create({ projectId: testProjectId, jobType: 'image' });
      const job3 = await jobService.create({ projectId: testProjectId, jobType: 'video' });

      await jobService.markRunning(job1.id);
      await jobService.markCompleted(job2.id);
      // job3 remains queued

      const activeJobs = await jobService.getActiveJobs(testProjectId);

      expect(activeJobs).toHaveLength(2);
      const statuses = activeJobs.map(j => j.status);
      expect(statuses).toContain('queued');
      expect(statuses).toContain('running');
      expect(statuses).not.toContain('completed');
    });
  });

  describe('getFailedJobs', () => {
    it('should return only failed jobs', async () => {
      const job1 = await jobService.create({ projectId: testProjectId, jobType: 'audio' });
      const job2 = await jobService.create({ projectId: testProjectId, jobType: 'image' });
      const job3 = await jobService.create({ projectId: testProjectId, jobType: 'video' });

      await jobService.markCompleted(job1.id);
      await jobService.markFailed(job2.id, 'Error');
      await jobService.markFailed(job3.id, 'Another error');

      const failedJobs = await jobService.getFailedJobs(testProjectId);

      expect(failedJobs).toHaveLength(2);
      expect(failedJobs.every(j => j.status === 'failed')).toBe(true);
    });
  });

  describe('deleteByProject', () => {
    it('should delete all jobs for a project', async () => {
      await jobService.create({ projectId: testProjectId, jobType: 'audio' });
      await jobService.create({ projectId: testProjectId, jobType: 'image' });

      let jobs = await jobService.getByProject(testProjectId);
      expect(jobs).toHaveLength(2);

      await jobService.deleteByProject(testProjectId);

      jobs = await jobService.getByProject(testProjectId);
      expect(jobs).toHaveLength(0);
    });
  });
});
