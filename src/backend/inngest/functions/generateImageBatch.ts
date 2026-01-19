import { inngest } from '../client.js';
import { createComfyUIClient } from '../../clients/comfyui.js';
import { jobService } from '../../services/jobService.js';
import { getImagePath, ensureOutputDir, toMediaUrl } from '../../services/outputPaths.js';
import { db, sentences, characters, generationModels, visualStyles } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getStylePromptPrefix, getStyleWorkflowPath, getStyleWorkflow } from '../../config/visualStyles.js';

// Default workflow paths (fallback when no model specified)
const WORKFLOWS = {
  imageToImage: path.join(process.cwd(), 'workflows', 'image', 'image_flux2_klein_image_edit_4b_base.json'),
  textToImage: path.join(process.cwd(), 'workflows', 'image', 'text-to-image-image_z_image_turbo.json'),
};

// Default model settings
const DEFAULT_MODEL_SETTINGS = {
  'text-to-image': { steps: 4, cfg: 1.0 },
  'image-to-image': { steps: 20, cfg: 5.0 },
};

/**
 * Get the first reference image path for a character
 */
async function getCharacterReferencePath(characterId: string): Promise<string | null> {
  const character = await db.select().from(characters).where(eq(characters.id, characterId)).get();

  if (!character || !character.referenceImages || character.referenceImages.length === 0) {
    return null;
  }

  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  const refImageUrl = character.referenceImages[0];
  const match = refImageUrl.match(/ref_\d+\.\w+$/);
  if (!match) {
    return null;
  }

  const refPath = path.join(DATA_DIR, 'characters', characterId, match[0]);

  try {
    await fs.access(refPath);
    return refPath;
  } catch {
    return null;
  }
}

interface BatchSentenceResult {
  sentenceId: string;
  status: 'completed' | 'failed';
  imageFile?: string;
  error?: string;
}

/**
 * Inngest function for batch image generation using ComfyUI.
 * Groups sentences by model/style to minimize model reloads.
 * ComfyUI keeps models in VRAM between sequential requests with the same model.
 */
export const generateImageBatchFunction = inngest.createFunction(
  {
    id: 'generate-image-batch',
    name: 'Generate Image Batch',
    concurrency: {
      limit: 1, // GPU-bound - only one at a time
    },
    retries: 0, // Handle retries internally per-image
  },
  { event: 'image/generate-batch' },
  async ({ event, step, runId }) => {
    const { batchId, projectId, modelId, styleId, sentences: sentenceList } = event.data;

    // Step 1: Initialize batch job
    const batchJob = await step.run('init-batch', async () => {
      const job = await jobService.create({
        projectId,
        jobType: 'image-batch',
        inngestRunId: runId,
      });
      await jobService.markRunning(job.id, runId);
      return job;
    });

    // Step 2: Load model/style config ONCE for the entire batch
    const { modelConfig, styleConfig, workflowPath, stylePrefix, workflowType } = await step.run(
      'load-config',
      async () => {
        let model = null;
        let styleData = null;

        // Fetch model from database
        if (modelId && modelId !== 'default') {
          model = await db.select().from(generationModels).where(eq(generationModels.id, modelId)).get();
        }

        // Fetch style from database
        if (styleId && styleId !== 'default') {
          styleData = await db.select().from(visualStyles).where(eq(visualStyles.id, styleId)).get();
        }

        // Fallback to default model if not found
        if (!model) {
          model = await db.select().from(generationModels).where(eq(generationModels.id, 'z-image-turbo')).get();
        }

        // Determine workflow type
        let wfType: 'text-to-image' | 'image-to-image' = 'text-to-image';
        if (model?.workflowType) {
          wfType = model.workflowType as 'text-to-image' | 'image-to-image';
        }

        // Determine workflow path
        let wfPath = WORKFLOWS.textToImage;
        if (model?.workflowFile) {
          wfPath = path.join(process.cwd(), model.workflowFile);
        }

        // Build style prefix
        let prefix = '';
        if (styleData?.styleType === 'prompt' && styleData.promptPrefix) {
          prefix = styleData.promptPrefix;
        }

        return {
          modelConfig: model,
          styleConfig: styleData,
          workflowPath: wfPath,
          stylePrefix: prefix,
          workflowType: wfType,
        };
      }
    );

    // Step 3: Ensure output directory exists
    await step.run('ensure-output-dir', async () => {
      await ensureOutputDir(projectId, 'images');
    });

    const totalSentences = sentenceList.length;
    const results: BatchSentenceResult[] = [];

    // Get model settings once
    const defaultSettings = DEFAULT_MODEL_SETTINGS[workflowType];
    const modelSteps = modelConfig?.defaultSteps ?? defaultSettings.steps;
    const modelCfg = modelConfig?.defaultCfg ?? defaultSettings.cfg;

    // Step 4: Process each image sequentially (each in its own step for visibility)
    for (let i = 0; i < sentenceList.length; i++) {
      const sentence = sentenceList[i];
      const stepName = `generate-image-${i + 1}-of-${totalSentences}`;

      const result = await step.run(stepName, async () => {
        const comfyui = createComfyUIClient();

        try {
          // Mark as generating
          await db
            .update(sentences)
            .set({ status: 'generating', updatedAt: new Date() })
            .where(eq(sentences.id, sentence.sentenceId));

          // Broadcast progress
          const progressPercent = Math.round((i / totalSentences) * 100);
          await jobService.updateProgressWithBroadcast(batchJob.id, progressPercent, {
            projectId,
            jobType: 'image-batch',
            message: `Generating image ${i + 1}/${totalSentences}`,
            sentenceId: sentence.sentenceId,
          });

          const outputPath = getImagePath(projectId, sentence.sentenceId);
          const fullPrompt = stylePrefix ? `${stylePrefix}\n\n${sentence.prompt}` : sentence.prompt;

          // Generate the image (waits for completion)
          const savedPath = await comfyui.generateImage(
            workflowPath,
            {
              prompt: fullPrompt,
              negativePrompt: '',
              width: 1920,
              height: 1088,
              seed: sentence.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
              steps: modelSteps,
              cfg: modelCfg,
            },
            outputPath
          );

          // Convert filesystem path to media URL for storage and broadcast
          const mediaUrl = toMediaUrl(savedPath);

          // Update database with media URL path
          await db
            .update(sentences)
            .set({
              imageFile: mediaUrl,
              isImageDirty: false,
              status: 'completed',
              updatedAt: new Date(),
            })
            .where(eq(sentences.id, sentence.sentenceId));

          // Broadcast completion with media URL
          jobService.broadcastSentenceComplete({
            projectId,
            jobType: 'image',
            sentenceId: sentence.sentenceId,
            file: mediaUrl,
          });

          return {
            sentenceId: sentence.sentenceId,
            status: 'completed' as const,
            imageFile: mediaUrl,
          };
        } catch (error) {
          console.error(`Failed to generate image for sentence ${sentence.sentenceId}:`, error);

          // Mark as failed
          await db
            .update(sentences)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(sentences.id, sentence.sentenceId));

          return {
            sentenceId: sentence.sentenceId,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Generation failed',
          };
        }
      });

      results.push(result);
    }

    // Step 5: Finalize batch
    const summary = await step.run('finalize-batch', async () => {
      const completed = results.filter((r) => r.status === 'completed').length;
      const failed = results.filter((r) => r.status === 'failed').length;

      await jobService.markCompletedWithBroadcast(batchJob.id, {
        projectId,
        jobType: 'image-batch',
      });

      return { completed, failed, total: totalSentences };
    });

    return {
      success: true,
      batchId,
      ...summary,
      results,
    };
  }
);
