import { beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a separate test database
const testDbPath = path.join(__dirname, '../data/test.db');

// Set environment variable for test database BEFORE any imports
process.env.DATABASE_PATH = testDbPath;
process.env.NODE_ENV = 'test';

// Import resetDbConnection after setting environment variable
import { resetDbConnection } from '../src/backend/db/index.js';

// Schema for test database - DROP and CREATE to ensure fresh schema
const createTables = `
DROP TABLE IF EXISTS generation_jobs;
DROP TABLE IF EXISTS script_outlines;
DROP TABLE IF EXISTS sentences;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS project_cast;
DROP TABLE IF EXISTS characters;
DROP TABLE IF EXISTS projects;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  topic TEXT,
  target_duration INTEGER DEFAULT 8 NOT NULL,
  visual_style TEXT DEFAULT 'cinematic' NOT NULL,
  voice_id TEXT DEFAULT 'puck',
  status TEXT DEFAULT 'draft' NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  reference_images TEXT DEFAULT '[]',
  style_lora TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS project_cast (
  project_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  PRIMARY KEY (project_id, character_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

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
`;

beforeAll(() => {
  // Reset any existing connection to use the test database path
  resetDbConnection();

  // Ensure data directory exists
  const dataDir = path.dirname(testDbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create test database with schema
  const db = new Database(testDbPath);
  db.pragma('journal_mode = WAL');
  db.exec(createTables);
  db.close();

  // Reset again so the next connection will use the new database
  resetDbConnection();
});

beforeEach(() => {
  // Clean all tables before each test
  const db = new Database(testDbPath);
  db.exec('DELETE FROM generation_jobs');
  db.exec('DELETE FROM sentences');
  db.exec('DELETE FROM sections');
  db.exec('DELETE FROM script_outlines');
  db.exec('DELETE FROM project_cast');
  db.exec('DELETE FROM characters');
  db.exec('DELETE FROM projects');
  db.close();
});

afterAll(() => {
  // Clean tables instead of deleting file to avoid lock issues
  try {
    const db = new Database(testDbPath);
    db.exec('DELETE FROM generation_jobs');
    db.exec('DELETE FROM sentences');
    db.exec('DELETE FROM sections');
    db.exec('DELETE FROM script_outlines');
    db.exec('DELETE FROM project_cast');
    db.exec('DELETE FROM characters');
    db.exec('DELETE FROM projects');
    db.close();
  } catch {
    // Ignore errors on cleanup
  }
});

// Export helper for tests that need to reset the database
export async function resetTestDatabase() {
  const db = new Database(testDbPath);
  db.exec('DELETE FROM generation_jobs');
  db.exec('DELETE FROM sentences');
  db.exec('DELETE FROM sections');
  db.exec('DELETE FROM script_outlines');
  db.exec('DELETE FROM project_cast');
  db.exec('DELETE FROM characters');
  db.exec('DELETE FROM projects');
  db.close();
}
