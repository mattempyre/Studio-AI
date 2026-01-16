import { inngest } from '../client.js';

/**
 * Test function to verify Inngest integration is working.
 * Triggered by the 'test/hello' event.
 */
export const helloFunction = inngest.createFunction(
  {
    id: 'test-hello',
    name: 'Test Hello Function',
  },
  { event: 'test/hello' },
  async ({ event, step }) => {
    // Log the received message
    console.log(`[Inngest] Hello from Inngest! Received message: ${event.data.message}`);

    // Simulate a step (useful for demonstrating durable execution)
    const result = await step.run('process-message', async () => {
      console.log('[Inngest] Processing message in step...');
      return {
        originalMessage: event.data.message,
        processedAt: new Date().toISOString(),
        status: 'processed',
      };
    });

    console.log('[Inngest] Function completed successfully');

    return {
      success: true,
      message: `Hello from Inngest! Your message was: "${event.data.message}"`,
      result,
    };
  }
);
