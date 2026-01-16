import { eq, and, desc } from 'drizzle-orm';
import { db, generationJobs, type GenerationJob, type NewGenerationJob } from '../db/index.js';
import { nanoid } from 'nanoid';

export type JobType = 'script' | 'audio' | 'image' | 'video' | 'export';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface CreateJobParams {
  sentenceId?: string;
  projectId?: string;
  jobType: JobType;
  inngestRunId?: string;
}

interface UpdateJobParams {
  status?: JobStatus;
  progress?: number;
  errorMessage?: string;
  resultFile?: string;
  inngestRunId?: string;
}

/**
 * Service for managing generation job records in the database.
 * Used by Inngest functions to track job status and progress.
 */
export const jobService = {
  /**
   * Create a new job record when queuing a generation task.
   */
  async create(params: CreateJobParams): Promise<GenerationJob> {
    const id = nanoid();
    const now = new Date();

    const job: NewGenerationJob = {
      id,
      sentenceId: params.sentenceId || null,
      projectId: params.projectId || null,
      jobType: params.jobType,
      status: 'queued',
      progress: 0,
      inngestRunId: params.inngestRunId || null,
      createdAt: now,
    };

    await db.insert(generationJobs).values(job);

    return {
      ...job,
      errorMessage: null,
      resultFile: null,
      startedAt: null,
      completedAt: null,
    } as GenerationJob;
  },

  /**
   * Update job status when it starts running.
   */
  async markRunning(jobId: string, inngestRunId?: string): Promise<void> {
    await db.update(generationJobs)
      .set({
        status: 'running',
        startedAt: new Date(),
        ...(inngestRunId && { inngestRunId }),
      })
      .where(eq(generationJobs.id, jobId));
  },

  /**
   * Update job progress during execution.
   */
  async updateProgress(jobId: string, progress: number): Promise<void> {
    await db.update(generationJobs)
      .set({ progress: Math.min(100, Math.max(0, progress)) })
      .where(eq(generationJobs.id, jobId));
  },

  /**
   * Mark job as completed successfully.
   */
  async markCompleted(jobId: string, resultFile?: string): Promise<void> {
    await db.update(generationJobs)
      .set({
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        ...(resultFile && { resultFile }),
      })
      .where(eq(generationJobs.id, jobId));
  },

  /**
   * Mark job as failed with an error message.
   */
  async markFailed(jobId: string, errorMessage: string): Promise<void> {
    await db.update(generationJobs)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(generationJobs.id, jobId));
  },

  /**
   * Get a job by ID.
   */
  async getById(jobId: string): Promise<GenerationJob | null> {
    const result = await db.select()
      .from(generationJobs)
      .where(eq(generationJobs.id, jobId))
      .limit(1);

    return result[0] || null;
  },

  /**
   * Get all jobs for a project.
   */
  async getByProject(projectId: string): Promise<GenerationJob[]> {
    return db.select()
      .from(generationJobs)
      .where(eq(generationJobs.projectId, projectId))
      .orderBy(desc(generationJobs.createdAt));
  },

  /**
   * Get all jobs for a sentence.
   */
  async getBySentence(sentenceId: string): Promise<GenerationJob[]> {
    return db.select()
      .from(generationJobs)
      .where(eq(generationJobs.sentenceId, sentenceId))
      .orderBy(desc(generationJobs.createdAt));
  },

  /**
   * Get the latest job of a specific type for a sentence.
   */
  async getLatestBySentenceAndType(sentenceId: string, jobType: JobType): Promise<GenerationJob | null> {
    const result = await db.select()
      .from(generationJobs)
      .where(and(
        eq(generationJobs.sentenceId, sentenceId),
        eq(generationJobs.jobType, jobType)
      ))
      .orderBy(desc(generationJobs.createdAt))
      .limit(1);

    return result[0] || null;
  },

  /**
   * Get all pending or running jobs for a project (for progress tracking).
   */
  async getActiveJobs(projectId: string): Promise<GenerationJob[]> {
    const result = await db.select()
      .from(generationJobs)
      .where(eq(generationJobs.projectId, projectId));

    return result.filter(job =>
      job.status === 'queued' || job.status === 'running'
    );
  },

  /**
   * Get failed jobs for a project (for retry functionality).
   */
  async getFailedJobs(projectId: string): Promise<GenerationJob[]> {
    return db.select()
      .from(generationJobs)
      .where(and(
        eq(generationJobs.projectId, projectId),
        eq(generationJobs.status, 'failed')
      ))
      .orderBy(desc(generationJobs.createdAt));
  },

  /**
   * Delete all jobs for a project (used when deleting a project).
   */
  async deleteByProject(projectId: string): Promise<void> {
    await db.delete(generationJobs)
      .where(eq(generationJobs.projectId, projectId));
  },

  /**
   * Update job with generic params.
   */
  async update(jobId: string, params: UpdateJobParams): Promise<void> {
    await db.update(generationJobs)
      .set(params)
      .where(eq(generationJobs.id, jobId));
  },
};
