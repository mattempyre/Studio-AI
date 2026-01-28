import { inngest } from '../client.js';
import { jobService } from '../../services/jobService.js';
import { db, sentences } from '../../db/index.js';
import { eq } from 'drizzle-orm';

interface BatchSentenceResult {
  sentenceId: string;
  status: 'queued' | 'failed';
  error?: string;
}

/**
 * Inngest function for batch video generation.
 *
 * This function dispatches individual video/generate events for each sentence,
 * allowing Inngest to handle concurrency, retries, and progress tracking per video.
 *
 * Each video is generated independently, which provides:
 * - Individual progress tracking per video
 * - Automatic retries per video (not entire batch)
 * - Real-time UI updates as each video completes
 * - Better error isolation
 *
 * GPU-bound: Videos are processed one at a time via the single video function's concurrency limit.
 */
export const generateVideoBatchFunction = inngest.createFunction(
  {
    id: 'generate-video-batch',
    name: 'Generate Video Batch',
    retries: 0, // Batch orchestration doesn't need retries - individual videos handle that
  },
  { event: 'video/generate-batch' },
  async ({ event, step, runId }) => {
    const { batchId, projectId, sentences: sentenceList } = event.data;

    // Step 1: Initialize batch job for tracking
    const batchJob = await step.run('init-batch', async () => {
      const job = await jobService.create({
        projectId,
        jobType: 'video-batch',
        inngestRunId: runId,
      });
      await jobService.markRunning(job.id, runId);
      return job;
    });

    // Step 2: Dispatch individual video generation events
    const dispatchResults = await step.run('dispatch-video-events', async () => {
      const results: BatchSentenceResult[] = [];

      for (const sentence of sentenceList) {
        try {
          // Mark sentence as queued
          await db
            .update(sentences)
            .set({ status: 'queued', updatedAt: new Date() })
            .where(eq(sentences.id, sentence.sentenceId));

          results.push({
            sentenceId: sentence.sentenceId,
            status: 'queued',
          });
        } catch (error) {
          console.error(`Failed to prepare sentence ${sentence.sentenceId}:`, error);
          results.push({
            sentenceId: sentence.sentenceId,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return results;
    });

    // Step 3: Send all video generation events at once
    // Inngest will handle concurrency (one at a time due to GPU constraint)
    await step.sendEvent(
      'dispatch-videos',
      sentenceList
        .filter((sentence) =>
          dispatchResults.some(
            (r) => r.sentenceId === sentence.sentenceId && r.status === 'queued'
          )
        )
        .map((sentence) => ({
          name: 'video/generate' as const,
          data: {
            sentenceId: sentence.sentenceId,
            projectId,
            imageFile: sentence.imageFile,
            prompt: sentence.prompt,
            cameraMovement: sentence.cameraMovement || 'static',
            motionStrength: sentence.motionStrength ?? 0.5,
          },
        }))
    );

    // Step 4: Update batch progress
    await step.run('update-batch-progress', async () => {
      const queued = dispatchResults.filter((r) => r.status === 'queued').length;
      const failed = dispatchResults.filter((r) => r.status === 'failed').length;

      await jobService.updateProgressWithBroadcast(batchJob.id, 100, {
        projectId,
        jobType: 'video-batch',
        message: `Dispatched ${queued} videos for generation${failed > 0 ? ` (${failed} failed to queue)` : ''}`,
      });

      // Mark batch job as completed - individual videos are now tracked separately
      await jobService.markCompletedWithBroadcast(batchJob.id, {
        projectId,
        jobType: 'video-batch',
      });
    });

    return {
      success: true,
      batchId,
      dispatched: dispatchResults.filter((r) => r.status === 'queued').length,
      failed: dispatchResults.filter((r) => r.status === 'failed').length,
      total: sentenceList.length,
      results: dispatchResults,
    };
  }
);
