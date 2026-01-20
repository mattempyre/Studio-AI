import { inngest } from '../client.js';
import { createComfyUIClient } from '../../clients/comfyui.js';
import { jobService } from '../../services/jobService.js';
import { getVideoPath, ensureOutputDir, toMediaUrl, fromMediaUrl } from '../../services/outputPaths.js';
import { db, sentences } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import * as path from 'path';

// Batch workflow path (optimized for batch queue processing)
const BATCH_VIDEO_WORKFLOW = path.join(
  process.cwd(),
  'workflows',
  'video',
  'video_wan2_2_14B_i2v_batch.json'
);

// Default video settings
const DEFAULT_FPS = 24;
const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

/**
 * Calculate frame count based on target duration and FPS.
 * Matches the logic in generateVideo.ts for consistency.
 */
function calculateFrameCount(durationMs: number | null | undefined, fps: number = DEFAULT_FPS): number {
  if (!durationMs || durationMs <= 0) {
    // Default to 5 seconds if no audio duration
    return Math.round(DEFAULT_DURATION_SECONDS * fps);
  }

  // Convert ms to seconds and calculate frames
  const durationSeconds = durationMs / 1000;

  // Clamp to reasonable bounds (5-15 seconds for video generation)
  // Minimum 5 seconds ensures short narrations still have adequate video
  const clampedDuration = Math.max(5, Math.min(15, durationSeconds));

  return Math.round(clampedDuration * fps);
}

// Timeout per video in milliseconds (5 minutes per video)
const TIMEOUT_PER_VIDEO_MS = 5 * 60 * 1000;

// Valid camera movement values
const VALID_CAMERA_MOVEMENTS = ['static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'orbit', 'truck'] as const;
type CameraMovement = typeof VALID_CAMERA_MOVEMENTS[number];

/**
 * Validate and normalize camera movement value.
 */
function validateCameraMovement(value: string | undefined): CameraMovement {
  if (!value) return 'static';
  const normalized = value.toLowerCase().trim();
  if (VALID_CAMERA_MOVEMENTS.includes(normalized as CameraMovement)) {
    return normalized as CameraMovement;
  }
  return 'static';
}

interface BatchSentenceResult {
  sentenceId: string;
  status: 'completed' | 'failed';
  videoFile?: string;
  error?: string;
}

interface QueuedPrompt {
  promptId: string;
  sentenceId: string;
  outputPath: string;
  prompt: string;
}

/**
 * Inngest function for batch video generation using ComfyUI.
 *
 * Key optimization: All videos are queued to ComfyUI at once, then we wait for
 * all completions. This keeps models loaded in VRAM throughout the entire batch
 * because ComfyUI's queue processor doesn't unload models between queue items.
 *
 * GPU-bound: only one batch at a time.
 */
export const generateVideoBatchFunction = inngest.createFunction(
  {
    id: 'generate-video-batch',
    name: 'Generate Video Batch',
    concurrency: {
      limit: 1, // GPU-bound - only one batch at a time
    },
    retries: 0, // Handle retries internally per-video
  },
  { event: 'video/generate-batch' },
  async ({ event, step, runId }) => {
    const { batchId, projectId, sentences: sentenceList } = event.data;

    // Step 1: Initialize batch job
    const batchJob = await step.run('init-batch', async () => {
      const job = await jobService.create({
        projectId,
        jobType: 'video-batch',
        inngestRunId: runId,
      });
      await jobService.markRunning(job.id, runId);
      return job;
    });

    // Step 2: Ensure output directory exists
    await step.run('ensure-output-dir', async () => {
      await ensureOutputDir(projectId, 'videos');
    });

    // Step 3: Upload all source images to ComfyUI upfront
    const uploadedImages = await step.run('upload-all-images', async () => {
      const comfyui = createComfyUIClient();
      const uploaded: Record<string, string> = {};

      for (const sentence of sentenceList) {
        try {
          const localPath = fromMediaUrl(sentence.imageFile);
          const uploadedFilename = await comfyui.uploadImage(localPath);
          uploaded[sentence.sentenceId] = uploadedFilename;
        } catch (error) {
          console.error(`Failed to upload image for sentence ${sentence.sentenceId}:`, error);
        }
      }

      await jobService.updateProgressWithBroadcast(batchJob.id, 10, {
        projectId,
        jobType: 'video-batch',
        message: `Uploaded ${Object.keys(uploaded).length}/${sentenceList.length} images to ComfyUI`,
      });

      return uploaded;
    });

    // Step 4: Queue ALL videos to ComfyUI at once
    // This ensures models stay loaded in VRAM between videos
    const queuedPrompts = await step.run('queue-all-videos', async () => {
      const comfyui = createComfyUIClient();
      const prompts: QueuedPrompt[] = [];
      const failedSentences: string[] = [];

      for (const sentence of sentenceList) {
        const uploadedImageFilename = uploadedImages[sentence.sentenceId];
        if (!uploadedImageFilename) {
          failedSentences.push(sentence.sentenceId);
          continue;
        }

        try {
          // Mark sentence as generating
          await db
            .update(sentences)
            .set({ status: 'generating', updatedAt: new Date() })
            .where(eq(sentences.id, sentence.sentenceId));

          const outputPath = getVideoPath(projectId, sentence.sentenceId);

          // Queue workflow without waiting for completion
          const { promptId } = await comfyui.queueVideoWorkflow(
            BATCH_VIDEO_WORKFLOW,
            {
              imageFile: uploadedImageFilename,
              prompt: sentence.prompt,
              negativePrompt: '',
              cameraMovement: validateCameraMovement(sentence.cameraMovement),
              motionStrength: sentence.motionStrength ?? 0.5,
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
              // Calculate frames from audio duration (matches single video behavior)
              frames: calculateFrameCount(sentence.audioDuration, DEFAULT_FPS),
              fps: DEFAULT_FPS,
              seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            }
          );

          prompts.push({
            promptId,
            sentenceId: sentence.sentenceId,
            outputPath,
            prompt: sentence.prompt,
          });
        } catch (error) {
          console.error(`Failed to queue video for sentence ${sentence.sentenceId}:`, error);
          failedSentences.push(sentence.sentenceId);

          await db
            .update(sentences)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(sentences.id, sentence.sentenceId));
        }
      }

      await jobService.updateProgressWithBroadcast(batchJob.id, 15, {
        projectId,
        jobType: 'video-batch',
        message: `Queued ${prompts.length}/${sentenceList.length} videos to ComfyUI`,
      });

      return { prompts, failedSentences };
    });

    // Step 5: Wait for ALL videos to complete
    // ComfyUI processes the queue sequentially, keeping models loaded
    const batchResults = await step.run('wait-for-batch', async () => {
      const comfyui = createComfyUIClient();
      const { prompts, failedSentences } = queuedPrompts;

      if (prompts.length === 0) {
        return { completedResults: [], failedResults: failedSentences };
      }

      const promptIds = prompts.map((p) => p.promptId);
      const outputPaths = prompts.map((p) => p.outputPath);
      const completedResults: BatchSentenceResult[] = [];
      const failedResults: string[] = [...failedSentences];

      // Calculate dynamic timeout based on number of videos
      const batchTimeout = prompts.length * TIMEOUT_PER_VIDEO_MS;

      try {
        await comfyui.waitForPromptBatch(
          promptIds,
          outputPaths,
          // onEachComplete callback - fires when each video finishes
          async (index, savedPath) => {
            const queuedPrompt = prompts[index];
            const mediaUrl = toMediaUrl(savedPath);

            // Update database for this video
            await db
              .update(sentences)
              .set({
                videoFile: mediaUrl,
                isVideoDirty: false,
                status: 'completed',
                updatedAt: new Date(),
              })
              .where(eq(sentences.id, queuedPrompt.sentenceId));

            // Broadcast per-video completion
            jobService.broadcastSentenceComplete({
              projectId,
              jobType: 'video',
              sentenceId: queuedPrompt.sentenceId,
              file: mediaUrl,
            });

            completedResults.push({
              sentenceId: queuedPrompt.sentenceId,
              status: 'completed',
              videoFile: mediaUrl,
            });
          },
          // onProgress callback - fires after each completion
          async (completed, total) => {
            const progressPercent = 15 + Math.round((completed / total) * 75);
            await jobService.updateProgressWithBroadcast(batchJob.id, progressPercent, {
              projectId,
              jobType: 'video-batch',
              message: `Generated ${completed}/${total} videos`,
            });
          },
          batchTimeout
        );
      } catch (error) {
        console.error('Batch processing error:', error);
        // Mark any remaining prompts as failed
        for (const queuedPrompt of prompts) {
          const isCompleted = completedResults.some((r) => r.sentenceId === queuedPrompt.sentenceId);
          if (!isCompleted) {
            failedResults.push(queuedPrompt.sentenceId);
            await db
              .update(sentences)
              .set({ status: 'failed', updatedAt: new Date() })
              .where(eq(sentences.id, queuedPrompt.sentenceId));
          }
        }
      }

      return { completedResults, failedResults };
    });

    // Step 6: Finalize batch
    const summary = await step.run('finalize-batch', async () => {
      const { completedResults, failedResults } = batchResults;

      // Build final results array
      const results: BatchSentenceResult[] = [
        ...completedResults,
        ...failedResults.map((sentenceId) => ({
          sentenceId,
          status: 'failed' as const,
          error: 'Generation failed or timed out',
        })),
      ];

      await jobService.markCompletedWithBroadcast(batchJob.id, {
        projectId,
        jobType: 'video-batch',
      });

      return {
        completed: completedResults.length,
        failed: failedResults.length,
        total: sentenceList.length,
        results,
      };
    });

    return {
      success: true,
      batchId,
      ...summary,
    };
  }
);
