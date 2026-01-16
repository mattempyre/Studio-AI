import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/backend/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_PATH || './data/studio.db',
  },
  verbose: true,
  strict: true,
});
