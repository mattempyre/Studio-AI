/**
 * Inngest function for generating image prompts
 * STORY 4.1: Image Prompt Generation
 *
 * This function handles asynchronous image prompt generation with:
 * - Progress tracking via WebSocket
 * - Batch processing for efficiency
 * - Error handling and recovery
 */

import { inngest } from '../client.js';
import { jobService } from '../../services/jobService.js';
import { generateImagePrompts } from '../../services/promptService.js';

/**
 * Generate image prompts for a project's sentences.
 * Triggered by 'prompts/generate-image' event.
 */
export const generateImagePromptsFunction = inngest.createFunction(
  {
    id: 'generate-image-prompts',
    name: 'Generate Image Prompts',
    concurrency: {
      limit: 2, // Allow 2 concurrent prompt generation jobs (LLM API calls)
    },
    retries: 2,
  },
  { event: 'prompts/generate-image' },
  async ({ event, step, runId }) => {
    const { projectId, sentenceIds, force = false } = event.data;

    // Step 1: Create Job Record
    const job = await step.run('initialize-job', async () => {
      const newJob = await jobService.create({
        projectId,
        jobType: 'script', // Using 'script' type for prompt generation (fits the category)
        inngestRunId: runId,
      });
      await jobService.markRunning(newJob.id, runId);
      return newJob;
    });

    try {
      // Step 2: Generate prompts with progress tracking
      const result = await step.run('generate-prompts', async () => {
        let lastProgress = 0;

        const generationResult = await generateImagePrompts(
          {
            projectId,
            sentenceIds,
            force,
          },
          async (current, total, message) => {
            // Calculate progress percentage
            const progress = total > 0 ? Math.floor((current / total) * 100) : 0;

            // Only broadcast if progress has changed significantly (every 5%)
            if (progress >= lastProgress + 5 || progress === 100) {
              lastProgress = progress;
              await jobService.updateProgressWithBroadcast(job.id, progress, {
                projectId,
                jobType: 'script',
                message: `Image prompts: ${message} (${current}/${total})`,
              });
            }
          }
        );

        return generationResult;
      });

      // Step 3: Handle result
      if (result.success) {
        await step.run('finalize-success', async () => {
          await jobService.markCompletedWithBroadcast(job.id, {
            projectId,
            jobType: 'script',
          });
        });

        // Emit completion event
        await step.sendEvent('emit-completion', {
          name: 'prompts/generate-image-completed',
          data: {
            projectId,
            total: result.total,
            generated: result.generated,
          },
        });

        return {
          success: true,
          projectId,
          total: result.total,
          generated: result.generated,
        };
      } else {
        // Partial failure
        await step.run('finalize-partial-failure', async () => {
          const errorMessage = result.errors?.join('; ') || 'Unknown error';
          await jobService.markFailedWithBroadcast(job.id, errorMessage, {
            projectId,
            jobType: 'script',
          });
        });

        return {
          success: false,
          projectId,
          total: result.total,
          generated: result.generated,
          errors: result.errors,
        };
      }
    } catch (error) {
      // Global error handling
      const errorMessage = error instanceof Error ? error.message : String(error);

      await jobService.markFailedWithBroadcast(job.id, errorMessage, {
        projectId,
        jobType: 'script',
      });

      throw error; // Re-throw for Inngest retry mechanism
    }
  }
);
