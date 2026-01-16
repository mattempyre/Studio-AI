import { z } from 'zod';

// Project validation schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name too long'),
  topic: z.string().optional(),
  targetDuration: z.number().int().min(1, 'Duration must be at least 1 minute').max(120, 'Duration cannot exceed 120 minutes').optional(),
  visualStyle: z.string().optional(),
  voiceId: z.string().optional(),
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
  text: z.string().min(1, 'Text is required'),
  order: z.number().int().min(0, 'Order must be non-negative'),
  imagePrompt: z.string().optional(),
  videoPrompt: z.string().optional(),
  cameraMovement: z.enum(['static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'orbit', 'truck']).optional(),
  motionStrength: z.number().min(0).max(1).optional(),
});

export const updateSentenceSchema = createSentenceSchema.partial().omit({ sectionId: true });

// Type exports
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;
export type CreateSectionInput = z.infer<typeof createSectionSchema>;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;
export type CreateSentenceInput = z.infer<typeof createSentenceSchema>;
export type UpdateSentenceInput = z.infer<typeof updateSentenceSchema>;
