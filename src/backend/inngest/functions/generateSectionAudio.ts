import { inngest } from '../client.js';
import { createChatterboxClient } from '../../clients/chatterbox.js';
import { createWhisperClient } from '../../clients/whisper.js';
import { jobService } from '../../services/jobService.js';
import { getSectionAudioPath, ensureOutputDir } from '../../services/outputPaths.js';
import { alignSentencesToTranscriptionWithWords, validateAlignment, type SentenceTimingWithWords } from '../../services/audioAlignment.js';
import { db, sentences, sections } from '../../db/index.js';
import { eq, and } from 'drizzle-orm';

/**
 * Inngest function for generating audio for an entire section using Chatterbox TTS.
 * This function:
 * 1. Concatenates all sentence texts in the section
 * 2. Generates a single audio file via Chatterbox
 * 3. Transcribes with Whisper for word-level timestamps
 * 4. Aligns timestamps back to individual sentences
 * 5. Updates each sentence with its timing information
 */
export const generateSectionAudioFunction = inngest.createFunction(
  {
    id: 'generate-section-audio',
    name: 'Generate Section Audio',
    concurrency: {
      limit: 1, // Chatterbox TTS is single-threaded - only one request at a time
    },
    retries: 2, // Fewer retries since this is a larger operation
  },
  { event: 'audio/generate-section' },
  async ({ event, step, runId }) => {
    const { sectionId, projectId, voiceId, sentenceTexts } = event.data;

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
      // Step 2: Prepare section text
      const { fullText, sortedSentences } = await step.run('prepare-section-text', async () => {
        // Sort sentences by order
        const sorted = [...sentenceTexts].sort((a, b) => a.order - b.order);

        // Concatenate with single spaces (natural sentence flow)
        const text = sorted
          .map((s) => s.text.trim())
          .filter((t) => t.length > 0)
          .join(' ');

        await jobService.updateProgressWithBroadcast(job.id, 10, {
          projectId,
          jobType: 'audio',
          message: `Preparing section with ${sorted.length} sentences...`,
        });

        return { fullText: text, sortedSentences: sorted };
      });

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('Section has no text to generate audio for');
      }

      // Step 3: Generate TTS audio for entire section
      const audioResult = await step.run('generate-section-tts', async () => {
        await jobService.updateProgressWithBroadcast(job.id, 20, {
          projectId,
          jobType: 'audio',
          message: 'Generating voice audio...',
        });

        const chatterbox = createChatterboxClient();

        // Ensure output directory exists
        await ensureOutputDir(projectId, 'audio');
        const outputPath = getSectionAudioPath(projectId, sectionId);

        const result = await chatterbox.generateSpeech(
          {
            text: fullText,
            voice: voiceId,
          },
          outputPath
        );

        await jobService.updateProgressWithBroadcast(job.id, 50, {
          projectId,
          jobType: 'audio',
          message: 'Audio generated, transcribing for timing...',
        });

        return result;
      });

      // Step 4: Transcribe with Whisper for word-level timestamps
      const transcription = await step.run('transcribe-audio', async () => {
        const whisper = createWhisperClient();

        // Check if Whisper service is available
        const isAvailable = await whisper.healthCheck();
        if (!isAvailable) {
          // Fall back to equal distribution if Whisper is unavailable
          console.warn('Whisper service unavailable, using equal distribution for timing');
          return null;
        }

        try {
          const result = await whisper.transcribe(audioResult.filePath, 'en');

          await jobService.updateProgressWithBroadcast(job.id, 70, {
            projectId,
            jobType: 'audio',
            message: 'Aligning sentences to audio...',
          });

          return result;
        } catch (error) {
          console.error('Whisper transcription failed:', error);
          return null;
        }
      });

      // Step 5: Align sentences to transcription (or use fallback)
      // Returns word-level timings for karaoke highlighting
      const sentenceTimings = await step.run('align-sentences', async (): Promise<SentenceTimingWithWords[]> => {
        if (transcription && transcription.words.length > 0) {
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

          return alignmentResult.sentenceTimings;
        } else {
          // Fallback: distribute time equally across sentences (no word timings)
          const totalDurationMs = audioResult.durationMs;
          const sentenceCount = sortedSentences.length;
          const durationPerSentence = Math.floor(totalDurationMs / sentenceCount);

          return sortedSentences.map((s, index) => ({
            sentenceId: s.sentenceId,
            startMs: index * durationPerSentence,
            endMs: (index + 1) * durationPerSentence,
            confidence: 0.5, // Low confidence for fallback
            words: [], // No word timings without Whisper
          }));
        }
      });

      // Step 6: Update database with timings
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
              sectionAudioFile: audioResult.filePath,
              audioStartMs: timing.startMs,
              audioEndMs: timing.endMs,
              audioDuration: timing.endMs - timing.startMs,
              wordTimings: timing.words, // Store word-level timings for karaoke highlighting
              isAudioDirty: false,
              status: 'completed',
              updatedAt: new Date(),
            })
            .where(eq(sentences.id, timing.sentenceId));
        }

        // Note: sections table doesn't have audio fields yet
        // Future extension could track section-level audio status here
      });

      // Step 7: Mark job complete
      await step.run('finalize-section', async () => {
        await jobService.markCompletedWithBroadcast(job.id, {
          projectId,
          jobType: 'audio',
          resultFile: audioResult.filePath,
          duration: audioResult.durationMs,
        });
      });

      return {
        success: true,
        sectionId,
        audioFile: audioResult.filePath,
        totalDurationMs: audioResult.durationMs,
        sentenceCount: sentenceTimings.length,
        sentenceTimings: sentenceTimings.map((t) => ({
          sentenceId: t.sentenceId,
          startMs: t.startMs,
          endMs: t.endMs,
        })),
      };
    } catch (error) {
      // Global error handling
      const errorMessage = error instanceof Error ? error.message : String(error);

      await jobService.markFailedWithBroadcast(job.id, errorMessage, {
        projectId,
        jobType: 'audio',
      });

      // Mark all sentences in this section as failed
      for (const sentence of sentenceTexts) {
        await db
          .update(sentences)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(sentences.id, sentence.sentenceId));
      }

      throw error; // Re-throw for Inngest retry mechanism
    }
  }
);
