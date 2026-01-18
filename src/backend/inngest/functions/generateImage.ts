import { inngest } from '../client.js';
import { createComfyUIClient } from '../../clients/comfyui.js';
import { jobService } from '../../services/jobService.js';
import { getImagePath, ensureOutputDir } from '../../services/outputPaths.js';
import { db, sentences, characters, generationModels, visualStyles } from '../../db/index.js';
import { eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
// Legacy config fallback (for backwards compatibility)
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
  // Get character from database to find reference images
  const character = await db.select().from(characters).where(eq(characters.id, characterId)).get();

  if (!character || !character.referenceImages || character.referenceImages.length === 0) {
    return null;
  }

  // Reference images are stored as relative paths like /uploads/characters/{id}/ref_0.png
  // We need to convert to absolute filesystem path
  const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

  // The first reference image path from the array
  const refImageUrl = character.referenceImages[0];

  // Extract the filename from the URL (e.g., ref_0.png from /uploads/characters/{id}/ref_0.png)
  const match = refImageUrl.match(/ref_\d+\.\w+$/);
  if (!match) {
    return null;
  }

  const refPath = path.join(DATA_DIR, 'characters', characterId, match[0]);

  // Verify the file exists
  try {
    await fs.access(refPath);
    return refPath;
  } catch {
    return null;
  }
}

/**
 * Inngest function for generating images using ComfyUI.
 * Supports both text-to-image and image-to-image workflows with character references.
 */
export const generateImageFunction = inngest.createFunction(
  {
    id: 'generate-image',
    name: 'Generate Image',
    concurrency: {
      limit: 1, // GPU-bound - only one at a time
    },
    retries: 3,
  },
  { event: 'image/generate' },
  async ({ event, step, runId }) => {
    const {
      sentenceId,
      projectId,
      prompt,
      style,        // Legacy: style ID (for backwards compatibility)
      modelId,      // New: generation model ID
      styleId,      // New: visual style ID
      characterRefs,
      useImageToImage,
      seed,
      steps,
      cfg,
    } = event.data;

    // Check if this is a test run (sentenceId starts with "test-")
    const isTestRun = sentenceId.startsWith('test-');

    // Step 1: Create or Get Job Record
    const job = await step.run('initialize-job', async () => {
      // For test runs, don't look up by sentenceId (would fail FK constraint)
      if (!isTestRun) {
        const existingJob = await jobService.getLatestBySentenceAndType(sentenceId, 'image');

        if (existingJob && (existingJob.status === 'queued' || existingJob.status === 'running')) {
          await jobService.markRunning(existingJob.id, runId);
          return existingJob;
        }
      }

      const newJob = await jobService.create({
        sentenceId: isTestRun ? undefined : sentenceId, // Don't set for test runs
        projectId: isTestRun ? undefined : projectId,   // Don't set for test runs
        jobType: 'image',
        inngestRunId: runId,
      });

      await jobService.markRunning(newJob.id, runId);
      return newJob;
    });

    // Step 2: Fetch model and style configurations from database
    const { modelConfig, styleConfig } = await step.run('fetch-model-style-config', async () => {
      let model = null;
      let styleData = null;

      // Try to fetch model from database (new system)
      if (modelId) {
        model = await db.select().from(generationModels).where(eq(generationModels.id, modelId)).get();
      }

      // Try to fetch style from database (new system)
      if (styleId) {
        styleData = await db.select().from(visualStyles).where(eq(visualStyles.id, styleId)).get();
      } else if (style && !modelId) {
        // Legacy fallback: try to find style by legacy style ID
        styleData = await db.select().from(visualStyles).where(eq(visualStyles.id, style)).get();
      }

      // If no model found, try to get default model (z-image-turbo)
      if (!model) {
        model = await db.select().from(generationModels).where(eq(generationModels.id, 'z-image-turbo')).get();
      }

      return {
        modelConfig: model,
        styleConfig: styleData,
      };
    });

    try {
      // Step 3: Update Sentence Status (skip for test runs)
      await step.run('update-sentence-status-generating', async () => {
        if (!isTestRun) {
          await db.update(sentences)
            .set({ status: 'generating', updatedAt: new Date() })
            .where(eq(sentences.id, sentenceId));
        }

        await jobService.updateProgressWithBroadcast(job.id, 10, {
          projectId: isTestRun ? undefined : projectId,
          jobType: 'image',
          sentenceId: isTestRun ? undefined : sentenceId,
          message: 'Initializing image generation...',
        });
      });

      // Step 4: Resolve character reference image
      const refImagePath = await step.run('resolve-character-reference', async () => {
        if (!useImageToImage || !characterRefs || characterRefs.length === 0) {
          return null;
        }

        // Use the first character reference
        const refPath = await getCharacterReferencePath(characterRefs[0]);

        if (!refPath) {
          console.warn(`No reference image found for character ${characterRefs[0]}`);
        }

        return refPath;
      });

      // Step 5: Ensure output directory exists
      await step.run('ensure-output-dir', async () => {
        await ensureOutputDir(projectId, 'images');
      });

      // Step 6: Generate Image
      const imageResult = await step.run('generate-image', async () => {
        const comfyui = createComfyUIClient();
        const outputPath = getImagePath(projectId, sentenceId);

        await jobService.updateProgressWithBroadcast(job.id, 30, {
          projectId,
          jobType: 'image',
          sentenceId,
          message: 'Processing with ComfyUI...',
        });

        // Determine workflow type from model config or legacy style
        let workflowType: 'text-to-image' | 'image-to-image' = 'text-to-image';
        if (modelConfig?.workflowType) {
          workflowType = modelConfig.workflowType as 'text-to-image' | 'image-to-image';
        } else if (style) {
          // Legacy fallback
          workflowType = getStyleWorkflow(style);
        }

        const shouldUseImageToImage = useImageToImage && refImagePath && workflowType === 'image-to-image';

        // Build the prompt with style prefix
        let stylePrefix = '';
        if (styleConfig?.styleType === 'prompt' && styleConfig.promptPrefix) {
          stylePrefix = styleConfig.promptPrefix;
        } else if (style && !styleConfig) {
          // Legacy fallback
          stylePrefix = getStylePromptPrefix(style);
        }
        const fullPrompt = stylePrefix ? `${stylePrefix}\n\n${prompt}` : prompt;

        // Get default settings from model or use defaults
        const defaultSettings = DEFAULT_MODEL_SETTINGS[workflowType];
        const modelSteps = modelConfig?.defaultSteps ?? defaultSettings.steps;
        const modelCfg = modelConfig?.defaultCfg ?? defaultSettings.cfg;

        // Use image-to-image workflow with character reference
        if (shouldUseImageToImage) {
          return await comfyui.generateImageWithReference(
            WORKFLOWS.imageToImage,
            {
              referenceImage: refImagePath,
              prompt: fullPrompt,
              negativePrompt: '',
              seed: seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
              steps: steps ?? modelSteps,
              cfg: cfg ?? modelCfg,
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
        } else {
          // Use text-to-image workflow
          // Get workflow path from model config, style config (legacy), or use default
          let workflowPath = WORKFLOWS.textToImage;
          if (modelConfig?.workflowFile) {
            workflowPath = path.join(process.cwd(), modelConfig.workflowFile);
          } else if (style) {
            // Legacy fallback
            const legacyWorkflowPath = getStyleWorkflowPath(style);
            if (legacyWorkflowPath) {
              workflowPath = path.join(process.cwd(), legacyWorkflowPath);
            }
          }

          return await comfyui.generateImage(
            workflowPath,
            {
              prompt: fullPrompt,
              negativePrompt: '',
              width: 1920,
              height: 1088,
              seed: seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
              steps: steps ?? modelSteps,
              cfg: cfg ?? modelCfg,
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
        }
      });

      // Step 7: Finalize
      await step.run('finalize-generation', async () => {
        if (!isTestRun) {
          await db.update(sentences)
            .set({
              imageFile: imageResult,
              isImageDirty: false,
              status: 'completed',
              updatedAt: new Date(),
            })
            .where(eq(sentences.id, sentenceId));
        }

        await jobService.markCompletedWithBroadcast(job.id, {
          projectId: isTestRun ? 'test-project' : projectId,
          jobType: 'image',
          sentenceId: isTestRun ? undefined : sentenceId,
          resultFile: imageResult,
        });
      });

      return {
        success: true,
        filePath: imageResult,
        isTestRun,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      await jobService.markFailedWithBroadcast(job.id, errorMessage, {
        projectId: isTestRun ? 'test-project' : projectId,
        jobType: 'image',
        sentenceId: isTestRun ? undefined : sentenceId,
      });

      if (!isTestRun) {
        await db.update(sentences)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(sentences.id, sentenceId));
      }

      throw error;
    }
  }
);
