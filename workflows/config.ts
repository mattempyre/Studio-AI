import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Workflow configuration
 * Maps model identifiers to their workflow JSON files
 */
export const workflows = {
  // Image generation workflows
  image: {
    'flux-2': path.join(__dirname, 'image', 'flux-2.json'),
    // Add more image models here
    // 'sdxl': path.join(__dirname, 'image', 'sdxl.json'),
  },

  // Video generation workflows
  video: {
    'ltx-2-basic': path.join(__dirname, 'video', 'LTX-2 Basic.json'),
    'wan-2.2': path.join(__dirname, 'video', 'wan-2.2.json'),
    'wan-2.2-14b': path.join(__dirname, 'video', 'video_wan2_2_14B_i2v.json'),
  },
} as const;

/**
 * Default workflow selections
 */
export const defaults = {
  imageModel: 'flux-2' as keyof typeof workflows.image,
  videoModel: 'ltx-2-basic' as keyof typeof workflows.video,
};

/**
 * Get the workflow path for an image model
 */
export function getImageWorkflowPath(model?: string): string {
  const key = (model || defaults.imageModel) as keyof typeof workflows.image;
  const workflowPath = workflows.image[key];

  if (!workflowPath) {
    throw new Error(`Unknown image model: ${model}. Available: ${Object.keys(workflows.image).join(', ')}`);
  }

  return workflowPath;
}

/**
 * Get the workflow path for a video model
 */
export function getVideoWorkflowPath(model?: string): string {
  const key = (model || defaults.videoModel) as keyof typeof workflows.video;
  const workflowPath = workflows.video[key];

  if (!workflowPath) {
    throw new Error(`Unknown video model: ${model}. Available: ${Object.keys(workflows.video).join(', ')}`);
  }

  return workflowPath;
}

/**
 * List available image models
 */
export function listImageModels(): string[] {
  return Object.keys(workflows.image);
}

/**
 * List available video models
 */
export function listVideoModels(): string[] {
  return Object.keys(workflows.video);
}
