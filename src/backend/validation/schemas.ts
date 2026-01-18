import { z } from 'zod';

// Project validation schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be 200 characters or less'),
  topic: z.string().max(1000, 'Topic must be 1000 characters or less').optional(),
  targetDuration: z.number().int().min(1, 'Duration must be at least 1 minute').max(180, 'Duration cannot exceed 180 minutes').optional(),
  modelId: z.string().max(100, 'Model ID must be 100 characters or less').optional(),
  styleId: z.string().max(100, 'Style ID must be 100 characters or less').optional(),
  visualStyle: z.string().max(100, 'Visual style must be 100 characters or less').optional(),
  voiceId: z.string().max(50, 'Voice ID must be 50 characters or less').optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// Character validation schemas
export const createCharacterSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  description: z.string().optional(),
  referenceImages: z.array(z.string().url('Invalid image URL')).optional(),
  styleLora: z.string().optional(),
});

export const updateCharacterSchema = createCharacterSchema.partial();

// Section validation schemas
export const createSectionSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  order: z.number().int().min(0, 'Order must be non-negative'),
});

export const updateSectionSchema = createSectionSchema.partial().omit({ projectId: true });

// Sentence validation schemas
export const createSentenceSchema = z.object({
  sectionId: z.string().min(1, 'Section ID is required'),
  text: z.string(), // Allow empty text for placeholder sentences
  order: z.number().int().min(0, 'Order must be non-negative'),
  imagePrompt: z.string().optional(),
  videoPrompt: z.string().optional(),
  cameraMovement: z.enum(['static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'orbit', 'truck']).optional(),
  motionStrength: z.number().min(0).max(1).optional(),
});

export const updateSentenceSchema = createSentenceSchema.partial().omit({ sectionId: true });

// Cast validation schemas (STORY-013)
export const addToCastSchema = z.object({
  characterId: z.string().min(1, 'Character ID is required'),
});

export const addToCastBatchSchema = z.object({
  characterIds: z.array(z.string().min(1)).min(1, 'At least one character ID is required'),
});

// Type exports
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateSentenceInput = z.infer<typeof createSentenceSchema>;
export type UpdateSentenceInput = z.infer<typeof updateSentenceSchema>;
export type AddToCastInput = z.infer<typeof addToCastSchema>;
export type AddToCastBatchInput = z.infer<typeof addToCastBatchSchema>;

