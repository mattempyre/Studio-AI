import express from 'express';
import cors from 'cors';

// Re-export resetTestDatabase from setup for convenience
export { resetTestDatabase } from '../setup.js';

// Create a test instance of the Express app
// Note: This must be called AFTER the test setup has set DATABASE_PATH
export async function createTestApp() {
  // Dynamic import to ensure DATABASE_PATH is set before loading
  const { projectsRouter } = await import('../../src/backend/api/projects.js');
  const { charactersRouter } = await import('../../src/backend/api/characters.js');
  const { healthRouter } = await import('../../src/backend/api/health.js');
  const { scriptsRouter } = await import('../../src/backend/api/scripts.js');
  const { sectionsRouter } = await import('../../src/backend/api/sections.js');
  const { sentencesRouter } = await import('../../src/backend/api/sentences.js');

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/projects', projectsRouter);
  app.use('/api/v1/characters', charactersRouter);
  app.use('/api/v1/sections', sectionsRouter);
  app.use('/api/v1/sentences', sentencesRouter);
  // Scripts routes are nested under projects for context
  app.use('/api/v1/projects', scriptsRouter);

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  return app;
}
