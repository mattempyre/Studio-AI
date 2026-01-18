/**
 * Visual Style Configuration for Image Generation
 *
 * Maps visual style names to their ComfyUI prompt prefixes.
 * These are used to maintain consistent style across generated images.
 */

export interface VisualStyleConfig {
  id: string;
  name: string;
  description: string;
  promptPrefix: string;
  /** Whether this style requires a character reference image */
  requiresCharacterRef: boolean;
  /** Recommended workflow for this style */
  workflow: 'text-to-image' | 'image-to-image';
  /** Path to the ComfyUI workflow JSON file (relative to project root) */
  workflowPath?: string;
  /** Example use cases */
  useCases: string[];
}

/**
 * Available visual styles for image generation
 */
export const VISUAL_STYLES: Record<string, VisualStyleConfig> = {
  // Illustration styles (require character reference)
  'financial-explainer': {
    id: 'financial-explainer',
    name: 'Financial Explainer',
    description: 'Clean illustrated style with white backgrounds, ideal for financial and business explainers',
    promptPrefix: `Match the graphic style. White background. Keep only essential items that make it look like a location but otherwise keep the background white. Its important that he looks like the man especially the facial features`,
    requiresCharacterRef: true,
    workflow: 'image-to-image',
    useCases: ['Financial tutorials', 'Business explainers', 'Educational content'],
  },

  'cartoon-explainer': {
    id: 'cartoon-explainer',
    name: 'Cartoon Explainer',
    description: 'Friendly cartoon style with colorful backgrounds for casual educational content',
    promptPrefix: `Match the cartoon style. Colorful, friendly illustration. Keep the character recognizable with accurate facial features. Simple clean background appropriate to the scene.`,
    requiresCharacterRef: true,
    workflow: 'image-to-image',
    useCases: ['Kids education', 'Casual explainers', 'Social media content'],
  },

  'minimalist-sketch': {
    id: 'minimalist-sketch',
    name: 'Minimalist Sketch',
    description: 'Clean line-art aesthetic perfect for educational explainers',
    promptPrefix: `Minimalist line art illustration. Clean black lines on white background. Simple, elegant sketch style. Focus on the essential elements.`,
    requiresCharacterRef: true,
    workflow: 'image-to-image',
    useCases: ['Quick explainers', 'Technical tutorials', 'Whiteboard style'],
  },

  // Cinematic styles (can work without character reference)
  'cinematic': {
    id: 'cinematic',
    name: 'Cinematic',
    description: 'High-fidelity photorealistic style with dramatic lighting',
    promptPrefix: `Cinematic photograph, dramatic lighting, shallow depth of field, 8k resolution, professional color grading, film grain.`,
    requiresCharacterRef: false,
    workflow: 'text-to-image',
    useCases: ['Documentaries', 'Dramatic narratives', 'Premium content'],
  },

  'cyberpunk': {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon-lit futuristic aesthetic with high-tech elements',
    promptPrefix: `Cyberpunk aesthetic, neon lights, rain-soaked streets, holographic displays, purple and blue color palette, futuristic technology.`,
    requiresCharacterRef: false,
    workflow: 'text-to-image',
    useCases: ['Tech content', 'Sci-fi narratives', 'Gaming content'],
  },

  'documentary': {
    id: 'documentary',
    name: 'Documentary',
    description: 'Realistic documentary-style imagery',
    promptPrefix: `Documentary photograph, natural lighting, authentic setting, photojournalistic style, high detail.`,
    requiresCharacterRef: false,
    workflow: 'text-to-image',
    useCases: ['Educational documentaries', 'Historical content', 'News-style'],
  },

  'corporate': {
    id: 'corporate',
    name: 'Corporate',
    description: 'Professional business-appropriate imagery',
    promptPrefix: `Professional corporate photography, clean modern office environment, business attire, neutral color palette, well-lit.`,
    requiresCharacterRef: false,
    workflow: 'text-to-image',
    useCases: ['Business presentations', 'Corporate training', 'Professional content'],
  },

  'anime': {
    id: 'anime',
    name: 'Anime',
    description: 'Japanese anime-inspired illustration style',
    promptPrefix: `Anime style illustration, vibrant colors, expressive characters, dynamic composition, clean linework, Studio Ghibli inspired.`,
    requiresCharacterRef: true,
    workflow: 'image-to-image',
    useCases: ['Entertainment', 'Youth content', 'Gaming'],
  },

  'watercolor': {
    id: 'watercolor',
    name: 'Watercolor',
    description: 'Soft, artistic watercolor painting style',
    promptPrefix: `Watercolor painting, soft edges, flowing colors, artistic brushstrokes, gentle gradients, traditional art style.`,
    requiresCharacterRef: false,
    workflow: 'text-to-image',
    useCases: ['Artistic content', 'Storytelling', 'Calm aesthetics'],
  },

  // Z-Image Turbo styles (fast generation)
  'z-image-turbo': {
    id: 'z-image-turbo',
    name: 'Z-Image Turbo',
    description: 'Fast turbo model for quick high-quality cinematic images',
    promptPrefix: '',
    requiresCharacterRef: false,
    workflow: 'text-to-image',
    workflowPath: 'workflows/image/text-to-image-image_z_image_turbo.json',
    useCases: ['Quick generation', 'Cinematic', 'High quality'],
  },

  'ms-paint-style': {
    id: 'ms-paint-style',
    name: 'MS Paint Style',
    description: 'Retro MS Paint aesthetic with nostalgic pixelated look',
    promptPrefix: '',
    requiresCharacterRef: false,
    workflow: 'text-to-image',
    workflowPath: 'workflows/image/text-to-image-ms-paint-style.json',
    useCases: ['Retro style', 'Nostalgic', 'Fun casual', 'Meme content'],
  },
};

/**
 * Get a visual style configuration by ID
 * Falls back to 'cinematic' if not found
 */
export function getVisualStyle(styleId: string): VisualStyleConfig {
  const normalizedId = styleId.toLowerCase().replace(/\s+/g, '-');
  return VISUAL_STYLES[normalizedId] || VISUAL_STYLES['cinematic'];
}

/**
 * Get the prompt prefix for a visual style
 */
export function getStylePromptPrefix(styleId: string): string {
  return getVisualStyle(styleId).promptPrefix;
}

/**
 * Check if a visual style requires a character reference
 */
export function styleRequiresCharacterRef(styleId: string): boolean {
  return getVisualStyle(styleId).requiresCharacterRef;
}

/**
 * Get the recommended workflow for a visual style
 */
export function getStyleWorkflow(styleId: string): 'text-to-image' | 'image-to-image' {
  return getVisualStyle(styleId).workflow;
}

/**
 * Get all available visual styles as an array
 */
export function getAllVisualStyles(): VisualStyleConfig[] {
  return Object.values(VISUAL_STYLES);
}

/**
 * Get visual styles filtered by workflow type
 */
export function getStylesByWorkflow(workflow: 'text-to-image' | 'image-to-image'): VisualStyleConfig[] {
  return Object.values(VISUAL_STYLES).filter(style => style.workflow === workflow);
}

/**
 * Get the workflow path for a visual style
 * Returns undefined if no specific workflow is defined (use default)
 */
export function getStyleWorkflowPath(styleId: string): string | undefined {
  return getVisualStyle(styleId).workflowPath;
}
