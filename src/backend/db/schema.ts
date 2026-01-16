import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// Projects table - main container for video projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  topic: text('topic'), // The topic used to generate the script
  targetDuration: integer('target_duration').notNull().default(8), // minutes
  visualStyle: text('visual_style').notNull().default('cinematic'),
  voiceId: text('voice_id').default('puck'), // Selected TTS voice
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

// Generation jobs table - tracks background job status
export const generationJobs = sqliteTable('generation_jobs', {
  id: text('id').primaryKey(),
  sentenceId: text('sentence_id').references(() => sentences.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  jobType: text('job_type').notNull(), // 'script', 'audio', 'image', 'video', 'export'
  status: text('status').notNull().default('queued'), // 'queued', 'running', 'completed', 'failed'
  progress: integer('progress').notNull().default(0), // 0-100
  inngestRunId: text('inngest_run_id'),
  errorMessage: text('error_message'),
  resultFile: text('result_file'), // Path to generated file
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
