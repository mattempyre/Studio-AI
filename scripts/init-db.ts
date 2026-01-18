// Script to initialize the database schema
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../data/studio.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('Created data directory:', dataDir);
}

// Create or open database
const db = new Database(dbPath);
console.log('Database opened at:', dbPath);

// Enable WAL mode
db.pragma('journal_mode = WAL');

// Create tables
const createTables = `
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  topic TEXT,
  target_duration INTEGER DEFAULT 8 NOT NULL,
  model_id TEXT DEFAULT 'z-image-turbo',
  style_id TEXT DEFAULT 'cinematic',
  visual_style TEXT DEFAULT 'cinematic' NOT NULL,
  voice_id TEXT DEFAULT 'puck',
  status TEXT DEFAULT 'draft' NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

-- Characters table
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  reference_images TEXT DEFAULT '[]',
  style_lora TEXT,
  created_at INTEGER
);

-- Project cast table (junction)
CREATE TABLE IF NOT EXISTS project_cast (
  project_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  PRIMARY KEY (project_id, character_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

-- Sections table
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Sentences table
CREATE TABLE IF NOT EXISTS sentences (
  id TEXT PRIMARY KEY NOT NULL,
  section_id TEXT NOT NULL,
  text TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  image_prompt TEXT,
  video_prompt TEXT,
  camera_movement TEXT DEFAULT 'static' NOT NULL,
  motion_strength REAL DEFAULT 0.5 NOT NULL,
  audio_file TEXT,
  audio_duration INTEGER,
  image_file TEXT,
  video_file TEXT,
  is_audio_dirty INTEGER DEFAULT 1 NOT NULL,
  is_image_dirty INTEGER DEFAULT 1 NOT NULL,
  is_video_dirty INTEGER DEFAULT 1 NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
);

-- Script outlines table (for long-form scripts)
CREATE TABLE IF NOT EXISTS script_outlines (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  total_target_minutes INTEGER NOT NULL,
  visual_style TEXT DEFAULT 'cinematic' NOT NULL,
  sections TEXT NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  running_summary TEXT,
  covered_topics TEXT DEFAULT '[]',
  current_section_index INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Generation models table (ComfyUI workflow configurations)
CREATE TABLE IF NOT EXISTS generation_models (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  workflow_file TEXT,
  workflow_category TEXT DEFAULT 'image' NOT NULL,
  workflow_type TEXT DEFAULT 'text-to-image' NOT NULL,
  default_steps INTEGER DEFAULT 4,
  default_cfg REAL DEFAULT 1.0,
  default_frames INTEGER,
  default_fps INTEGER,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at INTEGER
);

-- Visual styles table (prompt prefixes and LoRA configurations)
CREATE TABLE IF NOT EXISTS visual_styles (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  style_type TEXT DEFAULT 'prompt' NOT NULL,
  prompt_prefix TEXT,
  lora_file TEXT,
  lora_strength REAL DEFAULT 1.0,
  compatible_models TEXT DEFAULT '[]',
  requires_character_ref INTEGER DEFAULT 0 NOT NULL,
  is_active INTEGER DEFAULT 1 NOT NULL,
  created_at INTEGER
);

-- Generation jobs table
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  sentence_id TEXT,
  project_id TEXT,
  outline_id TEXT,
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'queued' NOT NULL,
  progress INTEGER DEFAULT 0 NOT NULL,
  inngest_run_id TEXT,
  error_message TEXT,
  result_file TEXT,
  total_steps INTEGER,
  current_step INTEGER,
  step_name TEXT,
  started_at INTEGER,
  completed_at INTEGER,
  created_at INTEGER,
  FOREIGN KEY (sentence_id) REFERENCES sentences(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (outline_id) REFERENCES script_outlines(id) ON DELETE CASCADE
);

-- Create indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_outlines_project ON script_outlines(project_id);
CREATE INDEX IF NOT EXISTS idx_sections_project ON sections(project_id);
CREATE INDEX IF NOT EXISTS idx_sentences_section ON sentences(section_id);
CREATE INDEX IF NOT EXISTS idx_jobs_sentence ON generation_jobs(sentence_id);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
`;

// Run schema creation
db.exec(createTables);
console.log('Database tables created successfully!');

// Verify tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\nTables in database:');
tables.forEach((t: { name: string }) => console.log('  -', t.name));

db.close();
console.log('\nDatabase initialization complete!');
