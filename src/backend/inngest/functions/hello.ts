import { inngest } from '../client.js';
import { jobService } from '../../services/jobService.js';

/**
 * Test function to verify Inngest integration is working.
 * Triggered by the 'test/hello' event.
 *
 * This function demonstrates:
 * 1. Event handling
 * 2. Step-based durable execution
 * 3. Job status tracking in the database
 */
export const helloFunction = inngest.createFunction(
  {
    id: 'test-hello',
    name: 'Test Hello Function',
    retries: 3,
  },
  { event: 'test/hello' },
  async ({ event, step, runId }) => {
    // Log the received message
    console.log(`[Inngest] Hello from Inngest! Received message: ${event.data.message}`);
    console.log(`[Inngest] Run ID: ${runId}`);

    // Create a job record to track this execution
    const job = await step.run('create-job-record', async () => {
      console.log('[Inngest] Creating job record in database...');
      const job = await jobService.create({
        jobType: 'script', // Using 'script' type for the test
        inngestRunId: runId,
      });
      return job;
    });

    // Mark job as running
    await step.run('mark-job-running', async () => {
      console.log('[Inngest] Marking job as running...');
      await jobService.markRunning(job.id, runId);
    });

    // Simulate processing with progress updates
    const result = await step.run('process-message', async () => {
      console.log('[Inngest] Processing message in step...');

      // Update progress to 50%
      await jobService.updateProgress(job.id, 50);

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        originalMessage: event.data.message,
        processedAt: new Date().toISOString(),
        status: 'processed',
      };
    });

    // Mark job as completed
    await step.run('mark-job-completed', async () => {
      console.log('[Inngest] Marking job as completed...');
      await jobService.markCompleted(job.id);
    });

    console.log('[Inngest] Function completed successfully');

    return {
      success: true,
      message: `Hello from Inngest! Your message was: "${event.data.message}"`,
      jobId: job.id,
      result,
    };
  }
);
