import { inngest } from '../client.js';
import { createComfyUIClient } from '../../clients/comfyui.js';
import { jobService } from '../../services/jobService.js';
import { getImagePath, ensureOutputDir, toMediaUrl, fromMediaUrl } from '../../services/outputPaths.js';
import { db, sentences } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Inpainting workflow path
const WORKFLOWS = {
  inpaint: path.join(process.cwd(), 'workflows', 'image', 'flux2_klein_9b_Inpainting.json'),
};

// Default inpainting settings
const DEFAULT_INPAINT_SETTINGS = {
  steps: 4,  // LanPaint KSampler default
  cfg: 1,
};

/**
 * Inngest function for editing images using ComfyUI inpainting.
 * Uses Flux2 Klein 9B Inpainting workflow with red-channel mask.
 */
export const generateImageEditFunction = inngest.createFunction(
  {
    id: 'generate-image-edit',
    name: 'Edit Image (Inpainting)',
    concurrency: {
      limit: 1, // GPU-bound - only one at a time
    },
    retries: 3,
  },
  { event: 'image/edit' },
  async ({ event, step, runId }) => {
    const {
      sentenceId,
      projectId,
      sourceImagePath,
      editPrompt,
      editMode,
      maskImageBase64,
      seed,
      steps,
    } = event.data;

    // Step 1: Create or Get Job Record
    const job = await step.run('initialize-job', async () => {
      const existingJob = await jobService.getLatestBySentenceAndType(sentenceId, 'image');

      if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
        await jobService.markRunning(existingJob.id, runId);
        return existingJob;
      }

      const newJob = await jobService.create({
        sentenceId,
        projectId,
        jobType: 'image',
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
          jobType: 'image',
          sentenceId,
          message: 'Initializing image edit...',
        });
      });

      // Step 3: Resolve source image path (convert media URL to filesystem path)
      const resolvedSourcePath = await step.run('resolve-source-image', async () => {
        // Convert media URL to filesystem path using the centralized utility
        return fromMediaUrl(sourceImagePath);
      });

      // Step 4: Save mask image to temp file (for inpaint mode)
      const maskFilePath = await step.run('save-mask-image', async () => {
        if (editMode !== 'inpaint' || !maskImageBase64) {
          return null;
        }

        await jobService.updateProgressWithBroadcast(job.id, 20, {
          projectId,
          jobType: 'image',
          sentenceId,
          message: 'Preparing mask image...',
        });

        // Extract base64 data (remove data:image/png;base64, prefix if present)
        const base64Data = maskImageBase64.includes(',')
          ? maskImageBase64.split(',')[1]
          : maskImageBase64;

        // Save to temp file
        const tempDir = os.tmpdir();
        const maskPath = path.join(tempDir, `mask_${sentenceId}_${Date.now()}.png`);
        const maskBuffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(maskPath, maskBuffer);

        return maskPath;
      });

      // Step 5: Ensure output directory exists
      await step.run('ensure-output-dir', async () => {
        await ensureOutputDir(projectId, 'images');
      });

      // Step 6: Generate Edited Image
      const imageResult = await step.run('generate-edited-image', async () => {
        const comfyui = createComfyUIClient();
        const outputPath = getImagePath(projectId, sentenceId);

        await jobService.updateProgressWithBroadcast(job.id, 30, {
          projectId,
          jobType: 'image',
          sentenceId,
          message: 'Processing with ComfyUI...',
        });

        // Use inpainting workflow
        return await comfyui.generateInpaint(
          WORKFLOWS.inpaint,
          {
            sourceImage: resolvedSourcePath,
            maskImage: maskFilePath!,
            prompt: editPrompt,
            negativePrompt: '',
            seed: seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
            steps: steps ?? DEFAULT_INPAINT_SETTINGS.steps,
          },
          outputPath,
          async (progress, message) => {
            await jobService.updateProgressWithBroadcast(job.id, 30 + Math.round(progress * 0.6), {
              projectId,
              jobType: 'image',
              sentenceId,
              message,
            });
          }
        );
      });

      // Step 7: Cleanup temp mask file
      await step.run('cleanup-temp-files', async () => {
        if (maskFilePath) {
          try {
            await fs.unlink(maskFilePath);
          } catch {
            // Ignore cleanup errors
          }
        }
      });

      // Step 8: Finalize - convert filesystem path to media URL
      const mediaUrl = toMediaUrl(imageResult);

      await step.run('finalize-generation', async () => {
        await db.update(sentences)
          .set({
            imageFile: mediaUrl,
            isImageDirty: false,
            isVideoDirty: true, // Video needs regeneration since image changed
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(sentences.id, sentenceId));

        await jobService.markCompletedWithBroadcast(job.id, {
          projectId,
          jobType: 'image',
          sentenceId,
          resultFile: mediaUrl,
        });
      });

      return {
        success: true,
        filePath: mediaUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await jobService.markFailedWithBroadcast(job.id, errorMessage, {
        projectId,
        jobType: 'image',
        sentenceId,
      });

      await db.update(sentences)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(sentences.id, sentenceId));

      throw error;
    }
  }
);
