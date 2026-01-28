import { inngest } from '../client.js';
import { createComfyUIClient } from '../../clients/comfyui.js';
import { jobService } from '../../services/jobService.js';
import { getVideoPath, ensureOutputDir, toMediaUrl, fromMediaUrl } from '../../services/outputPaths.js';
import { db, sentences, generationModels } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import { getVideoWorkflowPath } from '../../../../workflows/config.js';

// Default video settings (exported for testing)
export const DEFAULT_FPS = 24;
export const DEFAULT_DURATION_SECONDS = 5;
const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

// Valid camera movement values
const VALID_CAMERA_MOVEMENTS = ['static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'orbit', 'truck'] as const;
type CameraMovement = typeof VALID_CAMERA_MOVEMENTS[number];

/**
 * Validate and normalize camera movement value.
 * Returns 'static' for invalid values.
 */
function validateCameraMovement(value: string | undefined): CameraMovement {
  if (!value) return 'static';
  const normalized = value.toLowerCase().trim();
  if (VALID_CAMERA_MOVEMENTS.includes(normalized as CameraMovement)) {
    return normalized as CameraMovement;
  }
  console.warn(`Invalid cameraMovement value "${value}", defaulting to "static"`);
  return 'static';
}

/**
 * Calculate frame count based on target duration and FPS.
 *
 * @param durationMs - Target duration in milliseconds (from audioDuration)
 * @param fps - Frames per second (default 16 for Wan 2.2)
 * @returns Frame count for the video
 */
export function calculateFrameCount(durationMs: number | null | undefined, fps: number = DEFAULT_FPS): number {
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

/**
 * Inngest function for generating videos using ComfyUI.
 * Uses Wan 2.2 14B image-to-video workflow.
 *
 * GPU-bound: only one video generation at a time.
 * Video generation takes longer than images (30-120 seconds typically).
 */
export const generateVideoFunction = inngest.createFunction(
  {
    id: 'generate-video',
    name: 'Generate Video',
    concurrency: {
      limit: 1, // GPU-bound - only one at a time
    },
    retries: 3, // Inngest uses exponential backoff automatically
  },
  { event: 'video/generate' },
  async ({ event, step, runId, attempt }) => {
    const {
      sentenceId,
      projectId,
      imageFile,
      prompt,
      cameraMovement,
      motionStrength,
    } = event.data;

    // Check if this is a test run (sentenceId starts with "test-")
    const isTestRun = sentenceId.startsWith('test-');

    // Step 1: Create or Get Job Record
    const job = await step.run('initialize-job', async () => {
      // For test runs, don't look up by sentenceId (would fail FK constraint)
      if (!isTestRun) {
        const existingJob = await jobService.getLatestBySentenceAndType(sentenceId, 'video');

        if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
          await jobService.markRunning(existingJob.id, runId);
          return existingJob;
        }
      }

      const newJob = await jobService.create({
        sentenceId: isTestRun ? undefined : sentenceId,
        projectId: isTestRun ? undefined : projectId,
        jobType: 'video',
        inngestRunId: runId,
      });

      await jobService.markRunning(newJob.id, runId);
      return newJob;
    });

    // Step 2: Fetch sentence data (for audio duration) and model config
    const { sentenceData, modelConfig } = await step.run('fetch-sentence-and-model', async () => {
      let sentence = null;
      let model = null;

      if (!isTestRun) {
        sentence = await db.select().from(sentences).where(eq(sentences.id, sentenceId)).get();
      }

      // Try to get default video model (future: allow model selection)
      // For now, we use the default workflow
      model = await db.select().from(generationModels)
        .where(eq(generationModels.workflowCategory, 'video'))
        .get();

      return {
        sentenceData: sentence,
        modelConfig: model,
      };
    });

    try {
      // Step 3: Validate source image exists
      await step.run('validate-source-image', async () => {
        if (!imageFile) {
          throw new Error('Source image file is required for video generation');
        }

        await jobService.updateProgressWithBroadcast(job.id, 5, {
          projectId: isTestRun ? undefined : projectId,
          jobType: 'video',
          sentenceId: isTestRun ? undefined : sentenceId,
          message: 'Validating source image...',
        });
      });

      // Step 4: Update Sentence Status (skip for test runs)
      await step.run('update-sentence-status-generating', async () => {
        if (!isTestRun) {
          await db.update(sentences)
            .set({ status: 'generating', updatedAt: new Date() })
            .where(eq(sentences.id, sentenceId));
        }

        await jobService.updateProgressWithBroadcast(job.id, 10, {
          projectId: isTestRun ? undefined : projectId,
          jobType: 'video',
          sentenceId: isTestRun ? undefined : sentenceId,
          message: 'Initializing video generation...',
        });
      });

      // Step 5: Ensure output directory exists
      await step.run('ensure-output-dir', async () => {
        await ensureOutputDir(projectId, 'videos');
      });

      // Step 6: Calculate video parameters
      const videoParams = await step.run('calculate-video-params', async () => {
        // Get duration from sentence's audioDuration, or use default
        const audioDuration = sentenceData?.audioDuration ?? null;

        // Get FPS and defaults from model config or use defaults
        const fps = modelConfig?.defaultFps ?? DEFAULT_FPS;
        const frames = calculateFrameCount(audioDuration, fps);

        await jobService.updateProgressWithBroadcast(job.id, 15, {
          projectId: isTestRun ? undefined : projectId,
          jobType: 'video',
          sentenceId: isTestRun ? undefined : sentenceId,
          message: `Preparing video: ${frames} frames at ${fps}fps...`,
        });

        return {
          fps,
          frames,
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        };
      });

      // Step 7: Upload source image to ComfyUI
      const uploadedImageFilename = await step.run('upload-source-image', async () => {
        const comfyui = createComfyUIClient();

        // Convert media URL to filesystem path using the centralized utility
        const localPath = fromMediaUrl(imageFile);

        await jobService.updateProgressWithBroadcast(job.id, 20, {
          projectId: isTestRun ? undefined : projectId,
          jobType: 'video',
          sentenceId: isTestRun ? undefined : sentenceId,
          message: 'Uploading source image to ComfyUI...',
        });

        return await comfyui.uploadImage(localPath);
      });

      // Step 8: Generate Video
      const videoResult = await step.run('generate-video', async () => {
        const comfyui = createComfyUIClient();
        const outputPath = getVideoPath(projectId, sentenceId);

        await jobService.updateProgressWithBroadcast(job.id, 25, {
          projectId,
          jobType: 'video',
          sentenceId,
          message: 'Processing video with ComfyUI (this may take 1-2 minutes)...',
        });

        // Get workflow path from config (LTX-2 Basic by default)
        const workflowPath = getVideoWorkflowPath();

        return await comfyui.generateVideo(
          workflowPath,
          {
            imageFile: uploadedImageFilename,
            prompt: prompt,
            negativePrompt: '', // Using workflow default
            cameraMovement: validateCameraMovement(cameraMovement),
            motionStrength: motionStrength ?? 0.5,
            width: videoParams.width,
            height: videoParams.height,
            frames: videoParams.frames,
            fps: videoParams.fps,
            seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
          },
          outputPath,
          async (progress, message) => {
            // Scale progress: 25-90 during execution
            const scaledProgress = 25 + Math.round(progress * 0.65);
            await jobService.updateProgressWithBroadcast(job.id, scaledProgress, {
              projectId,
              jobType: 'video',
              sentenceId,
              message,
            });
          }
        );
      });

      // Step 9: Finalize - convert filesystem path to media URL
      const mediaUrl = toMediaUrl(videoResult);

      await step.run('finalize-generation', async () => {
        if (!isTestRun) {
          await db.update(sentences)
            .set({
              videoFile: mediaUrl,
              isVideoDirty: false,
              status: 'completed',
              updatedAt: new Date(),
            })
            .where(eq(sentences.id, sentenceId));
        }

        await jobService.markCompletedWithBroadcast(job.id, {
          projectId: isTestRun ? 'test-project' : projectId,
          jobType: 'video',
          sentenceId: isTestRun ? undefined : sentenceId,
          resultFile: mediaUrl,
        });
      });

      return {
        success: true,
        filePath: mediaUrl,
        frames: videoParams.frames,
        fps: videoParams.fps,
        isTestRun,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const maxRetries = 3;
      const isLastAttempt = attempt >= maxRetries;

      // Only mark as failed on the final retry attempt
      if (isLastAttempt) {
        await jobService.markFailedWithBroadcast(job.id, errorMessage, {
          projectId: isTestRun ? 'test-project' : projectId,
          jobType: 'video',
          sentenceId: isTestRun ? undefined : sentenceId,
        });

        if (!isTestRun) {
          await db.update(sentences)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(sentences.id, sentenceId));
        }
      } else {
        // Log retry attempt for debugging
        console.log(`Video generation attempt ${attempt + 1}/${maxRetries + 1} failed for sentence ${sentenceId}, retrying...`);
      }

      throw error;
    }
  }
);
