import { inngest } from '../client.js';
import { createWhisperClient } from '../../clients/whisper.js';
import { jobService } from '../../services/jobService.js';
import { alignSentencesToTranscriptionWithWords, validateAlignment, type SentenceTimingWithWords } from '../../services/audioAlignment.js';
import { db, sentences } from '../../db/index.js';
import { eq } from 'drizzle-orm';

/**
 * Inngest function for retroactive audio alignment.
 * This function takes existing section audio files and:
 * 1. Transcribes with Whisper for word-level timestamps
 * 2. Aligns timestamps back to individual sentences
 * 3. Updates each sentence with its timing information and wordTimings
 *
 * Used to add karaoke highlighting to audio generated before this feature existed.
 */
export const retroactiveAudioAlignmentFunction = inngest.createFunction(
  {
    id: 'retroactive-audio-alignment',
    name: 'Retroactive Audio Alignment',
    concurrency: {
      limit: 2, // Allow a couple parallel since we're just transcribing, not generating
    },
    retries: 2,
  },
  { event: 'audio/retroactive-align' },
  async ({ event, step, runId }) => {
    const { sectionId, projectId, audioFile, sentenceTexts } = event.data;

    // Step 1: Create Job Record
    const job = await step.run('initialize-job', async () => {
      const newJob = await jobService.create({
        projectId,
        jobType: 'audio',
        inngestRunId: runId,
      });
      await jobService.markRunning(newJob.id, runId);
      return newJob;
    });

    try {
      // Step 2: Transcribe with Whisper for word-level timestamps
      const transcription = await step.run('transcribe-audio', async () => {
        await jobService.updateProgressWithBroadcast(job.id, 20, {
          projectId,
          jobType: 'audio',
          message: 'Transcribing audio for word timing...',
        });

        const whisper = createWhisperClient();

        // Check if Whisper service is available
        const isAvailable = await whisper.healthCheck();
        if (!isAvailable) {
          throw new Error('Whisper service unavailable - cannot perform alignment');
        }

        try {
          const result = await whisper.transcribe(audioFile, 'en');

          await jobService.updateProgressWithBroadcast(job.id, 50, {
            projectId,
            jobType: 'audio',
            message: 'Aligning sentences to transcription...',
          });

          return result;
        } catch (error) {
          console.error('Whisper transcription failed:', error);
          throw new Error(`Whisper transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });

      // Step 3: Align sentences to transcription
      const sentenceTimings = await step.run('align-sentences', async (): Promise<SentenceTimingWithWords[]> => {
        if (!transcription || transcription.words.length === 0) {
          throw new Error('No transcription words available for alignment');
        }

        // Sort sentences by order
        const sortedSentences = [...sentenceTexts].sort((a, b) => a.order - b.order);

        // Use Whisper alignment with word-level data for karaoke
        const alignmentResult = alignSentencesToTranscriptionWithWords(
          sortedSentences.map((s) => ({
            sentenceId: s.sentenceId,
            text: s.text,
            order: s.order,
          })),
          transcription.words
        );

        // Validate alignment
        const validation = validateAlignment(alignmentResult);
        if (!validation.isValid) {
          console.warn('Alignment validation issues:', validation.issues);
        }

        await jobService.updateProgressWithBroadcast(job.id, 70, {
          projectId,
          jobType: 'audio',
          message: `Aligned ${alignmentResult.sentenceTimings.length} sentences`,
        });

        return alignmentResult.sentenceTimings;
      });

      // Step 4: Update database with timings
      await step.run('update-sentence-timings', async () => {
        await jobService.updateProgressWithBroadcast(job.id, 85, {
          projectId,
          jobType: 'audio',
          message: 'Saving sentence timings...',
        });

        for (const timing of sentenceTimings) {
          await db
            .update(sentences)
            .set({
              sectionAudioFile: audioFile,
              audioStartMs: timing.startMs,
              audioEndMs: timing.endMs,
              audioDuration: timing.endMs - timing.startMs,
              wordTimings: timing.words, // Store word-level timings for karaoke highlighting
              updatedAt: new Date(),
            })
            .where(eq(sentences.id, timing.sentenceId));
        }
      });

      // Step 5: Mark job complete and broadcast per-sentence completions
      await step.run('finalize-alignment', async () => {
        // Mark the job complete with sectionId for frontend refetch trigger
        await jobService.markCompletedWithBroadcast(job.id, {
          projectId,
          jobType: 'audio',
          sectionId,
          resultFile: audioFile,
        });

        // Broadcast individual sentence completion events for frontend state updates
        for (const timing of sentenceTimings) {
          jobService.broadcastSentenceComplete({
            projectId,
            jobType: 'audio',
            sentenceId: timing.sentenceId,
            sectionId,
            file: audioFile,
            startMs: timing.startMs,
            endMs: timing.endMs,
            duration: timing.endMs - timing.startMs,
          });
        }
      });

      return {
        success: true,
        sectionId,
        audioFile,
        sentenceCount: sentenceTimings.length,
        sentenceTimings: sentenceTimings.map((t) => ({
          sentenceId: t.sentenceId,
          startMs: t.startMs,
          endMs: t.endMs,
          wordCount: t.words.length,
        })),
      };
    } catch (error) {
      // Global error handling
      const errorMessage = error instanceof Error ? error.message : String(error);

      await jobService.markFailedWithBroadcast(job.id, errorMessage, {
        projectId,
        jobType: 'audio',
      });

      throw error; // Re-throw for Inngest retry mechanism
    }
  }
);
