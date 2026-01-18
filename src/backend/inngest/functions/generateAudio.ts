import { inngest } from '../client.js';
import { createChatterboxClient } from '../../clients/chatterbox.js';
import { jobService } from '../../services/jobService.js';
import { getAudioPath } from '../../services/outputPaths.js';
import { db, sentences } from '../../db/index.js';
import { eq } from 'drizzle-orm';

/**
 * Inngest function for generating audio for a single sentence using Chatterbox TTS.
 * This function handles job tracking, database updates, and progress broadcasting.
 */
export const generateAudioFunction = inngest.createFunction(
    {
        id: 'generate-audio',
        name: 'Generate Audio',
        concurrency: {
            limit: 1, // Chatterbox TTS is single-threaded - only one request at a time
        },
        retries: 3,
    },
    { event: 'audio/generate' },
    async ({ event, step, runId }) => {
        const { sentenceId, projectId, text, voiceId } = event.data;

        // Step 1: Create or Get Job Record
        const job = await step.run('initialize-job', async () => {
            // Check if there's already an active job for this sentence
            const existingJob = await jobService.getLatestBySentenceAndType(sentenceId, 'audio');

            if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
                // Reuse existing job ID
                await jobService.markRunning(existingJob.id, runId);
                return existingJob;
            }

            // Create a fresh job record
            const newJob = await jobService.create({
                sentenceId,
                projectId,
                jobType: 'audio',
                inngestRunId: runId,
            });

            await jobService.markRunning(newJob.id, runId);
            return newJob;
        });

        try {
            // Step 2: Update Sentence Status
            await step.run('update-sentence-status-generating', async () => {
                await db.update(sentences)
                    .set({ status: 'generating', updatedAt: new Date() })
                    .where(eq(sentences.id, sentenceId));

                await jobService.updateProgressWithBroadcast(job.id, 10, {
                    projectId,
                    jobType: 'audio',
                    sentenceId,
                    message: 'Initializing voice engine...',
                });
            });

            // Step 3: Generate Audio
            const audioResult = await step.run('generate-tts-audio', async () => {
                const chatterbox = createChatterboxClient();
                const outputPath = getAudioPath(projectId, sentenceId);

                await jobService.updateProgressWithBroadcast(job.id, 30, {
                    projectId,
                    jobType: 'audio',
                    sentenceId,
                    message: 'Converting text to speech...',
                });

                const result = await chatterbox.generateSpeech(
                    {
                        text,
                        voice: voiceId,
                    },
                    outputPath
                );

                return result;
            });

            // Step 4: Finalize Sentence and Job
            await step.run('finalize-generation', async () => {
                // Update sentence with asset info
                await db.update(sentences)
                    .set({
                        audioFile: audioResult.filePath,
                        audioDuration: audioResult.durationMs,
                        isAudioDirty: false,
                        status: 'completed',
                        updatedAt: new Date(),
                    })
                    .where(eq(sentences.id, sentenceId));

                // Mark job as completed and broadcast
                await jobService.markCompletedWithBroadcast(job.id, {
                    projectId,
                    jobType: 'audio',
                    sentenceId,
                    resultFile: audioResult.filePath,
                    duration: audioResult.durationMs,
                });
            });

            return {
                success: true,
                filePath: audioResult.filePath,
                durationMs: audioResult.durationMs,
            };
        } catch (error) {
            // Global error handling for the function
            const errorMessage = error instanceof Error ? error.message : String(error);

            await jobService.markFailedWithBroadcast(job.id, errorMessage, {
                projectId,
                jobType: 'audio',
                sentenceId,
            });

            await db.update(sentences)
                .set({ status: 'failed', updatedAt: new Date() })
                .where(eq(sentences.id, sentenceId));

            throw error; // Re-throw for Inngest retry mechanism
        }
    }
);
