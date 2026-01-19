import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// Projects table - main container for video projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  topic: text('topic'), // The topic used to generate the script
  targetDuration: integer('target_duration').notNull().default(8), // minutes
  modelId: text('model_id').default('z-image-turbo'), // Selected generation model ID
  styleId: text('style_id').default('cinematic'), // Selected visual style ID
  visualStyle: text('visual_style').notNull().default('cinematic'), // Legacy field, kept for compatibility
  voiceId: text('voice_id').default('Emily'), // Selected TTS voice (Chatterbox)
  status: text('status').notNull().default('draft'), // draft, generating, ready
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Characters table - reusable character library
export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  referenceImages: text('reference_images', { mode: 'json' }).$type<string[]>().default([]),
  styleLora: text('style_lora'), // LoRA identifier for style consistency
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Project cast - many-to-many relationship between projects and characters
export const projectCast = sqliteTable('project_cast', {
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  characterId: text('character_id').notNull().references(() => characters.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.projectId, table.characterId] }),
}));

// Sections table - logical groupings within a script
export const sections = sqliteTable('sections', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Sentences table - individual units that map to visuals
export const sentences = sqliteTable('sentences', {
  id: text('id').primaryKey(),
  sectionId: text('section_id').notNull().references(() => sections.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  order: integer('order').notNull(),

  // Prompts for generation
  imagePrompt: text('image_prompt'),
  videoPrompt: text('video_prompt'),

  // Video settings
  cameraMovement: text('camera_movement').notNull().default('static'), // static, pan_left, pan_right, zoom_in, zoom_out, orbit, truck
  motionStrength: real('motion_strength').notNull().default(0.5), // 0.0 to 1.0

  // Generated asset files
  audioFile: text('audio_file'),
  audioDuration: integer('audio_duration'), // milliseconds
  audioStartMs: integer('audio_start_ms'), // Start time in section audio (for batch generation)
  audioEndMs: integer('audio_end_ms'), // End time in section audio (for batch generation)
  sectionAudioFile: text('section_audio_file'), // Path to section-level audio file (for batch generation)
  wordTimings: text('word_timings', { mode: 'json' }).$type<WordTimingData[]>(), // Word-level timing for karaoke highlighting
  imageFile: text('image_file'),
  videoFile: text('video_file'),

  // Dirty flags for cascading regeneration
  isAudioDirty: integer('is_audio_dirty', { mode: 'boolean' }).notNull().default(true),
  isImageDirty: integer('is_image_dirty', { mode: 'boolean' }).notNull().default(true),
  isVideoDirty: integer('is_video_dirty', { mode: 'boolean' }).notNull().default(true),

  // Status
  status: text('status').notNull().default('pending'), // pending, generating, completed, failed

  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Script outlines table - stores outline structure for long-form scripts
export const scriptOutlines = sqliteTable('script_outlines', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  topic: text('topic').notNull(), // Original topic for generation
  totalTargetMinutes: integer('total_target_minutes').notNull(),
  visualStyle: text('visual_style').notNull().default('cinematic'),
  sections: text('sections', { mode: 'json' }).$type<SectionOutline[]>().notNull(),
  status: text('status').notNull().default('draft'), // 'draft', 'approved', 'generating', 'completed', 'failed'
  runningSummary: text('running_summary'), // Updated as sections generate
  coveredTopics: text('covered_topics', { mode: 'json' }).$type<string[]>().default([]),
  currentSectionIndex: integer('current_section_index').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Section outline interface for JSON column
export interface SectionOutline {
  index: number;
  title: string;
  description: string;
  targetMinutes: number;
  keyPoints: string[];
  status: 'pending' | 'generating' | 'completed' | 'failed';
}

// Word timing interface for karaoke-style highlighting
export interface WordTimingData {
  word: string;
  startMs: number; // milliseconds relative to sentence start
  endMs: number;
  probability: number; // confidence from Whisper (0-1)
}

// Generation models table - ComfyUI workflow configurations
export const generationModels = sqliteTable('generation_models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  workflowFile: text('workflow_file'), // Path to ComfyUI workflow JSON
  workflowCategory: text('workflow_category').notNull().default('image'), // 'image' | 'video'
  workflowType: text('workflow_type').notNull().default('text-to-image'), // 'text-to-image' | 'image-to-image' | 'image-to-video'
  defaultSteps: integer('default_steps').default(4),
  defaultCfg: real('default_cfg').default(1.0),
  defaultFrames: integer('default_frames'), // For video models: number of frames
  defaultFps: integer('default_fps'), // For video models: frames per second
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Visual styles table - prompt prefixes and LoRA configurations
export const visualStyles = sqliteTable('visual_styles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  styleType: text('style_type').notNull().default('prompt'), // 'prompt' | 'lora'
  promptPrefix: text('prompt_prefix'), // For prompt-based styles
  loraFile: text('lora_file'), // For LoRA-based styles
  loraStrength: real('lora_strength').default(1.0),
  compatibleModels: text('compatible_models', { mode: 'json' }).$type<string[]>().default([]),
  requiresCharacterRef: integer('requires_character_ref', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Generation jobs table - tracks background job status
export const generationJobs = sqliteTable('generation_jobs', {
  id: text('id').primaryKey(),
  sentenceId: text('sentence_id').references(() => sentences.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  outlineId: text('outline_id').references(() => scriptOutlines.id, { onDelete: 'cascade' }),
  jobType: text('job_type').notNull(), // 'script', 'script-long', 'audio', 'image', 'video', 'export'
  status: text('status').notNull().default('queued'), // 'queued', 'running', 'completed', 'failed'
  progress: integer('progress').notNull().default(0), // 0-100
  inngestRunId: text('inngest_run_id'),
  errorMessage: text('error_message'),
  resultFile: text('result_file'), // Path to generated file
  // Step tracking for long-form generation
  totalSteps: integer('total_steps'), // Total sections to generate
  currentStep: integer('current_step'), // Current section being generated
  stepName: text('step_name'), // "Generating section: Introduction"
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Type exports for use in application code
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type Character = typeof characters.$inferSelect;
export type NewCharacter = typeof characters.$inferInsert;

export type Section = typeof sections.$inferSelect;
export type NewSection = typeof sections.$inferInsert;

export type Sentence = typeof sentences.$inferSelect;
export type NewSentence = typeof sentences.$inferInsert;

export type GenerationJob = typeof generationJobs.$inferSelect;
export type NewGenerationJob = typeof generationJobs.$inferInsert;

export type ScriptOutline = typeof scriptOutlines.$inferSelect;
export type NewScriptOutline = typeof scriptOutlines.$inferInsert;

export type GenerationModel = typeof generationModels.$inferSelect;
export type NewGenerationModel = typeof generationModels.$inferInsert;

export type VisualStyle = typeof visualStyles.$inferSelect;
export type NewVisualStyle = typeof visualStyles.$inferInsert;
