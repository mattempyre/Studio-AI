import Database, { type Database as BetterSqlite3Database } from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy database initialization
let _sqlite: BetterSqlite3Database | null = null;
let _db: BetterSQLite3Database<typeof schema> | null = null;

function getDbPath(): string {
  return process.env.DATABASE_PATH || path.join(__dirname, '../../../data/studio.db');
}

function initDb(): { sqlite: BetterSqlite3Database; db: BetterSQLite3Database<typeof schema> } {
  if (_sqlite && _db) {
    return { sqlite: _sqlite, db: _db };
  }

  const dbPath = getDbPath();

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Create SQLite connection
  _sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent performance
  _sqlite.pragma('journal_mode = WAL');

  // Create Drizzle instance with schema
  _db = drizzle(_sqlite, { schema });

  return { sqlite: _sqlite, db: _db };
}

// Getter for db instance
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_, prop) {
    const { db } = initDb();
    return (db as any)[prop];
  },
});

// Getter for raw sqlite connection
export const sqlite = new Proxy({} as BetterSqlite3Database, {
  get(_, prop) {
    const { sqlite } = initDb();
    return typeof (sqlite as any)[prop] === 'function'
      ? (sqlite as any)[prop].bind(sqlite)
      : (sqlite as any)[prop];
  },
});

// Export schema for convenience
export * from './schema.js';

// Reset function for tests
export function resetDbConnection(): void {
  if (_sqlite) {
    try {
      _sqlite.close();
    } catch {
      // Ignore close errors
    }
  }
  _sqlite = null;
  _db = null;
}
