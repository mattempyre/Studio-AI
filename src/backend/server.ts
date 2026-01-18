import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from 'dotenv';
import { join } from 'path';
import { db } from './db/index.js';
import { projectsRouter } from './api/projects.js';
import { charactersRouter } from './api/characters.js';
import { healthRouter } from './api/health.js';
import { scriptsRouter } from './api/scripts.js';
import { sectionsRouter } from './api/sections.js';
import { sentencesRouter } from './api/sentences.js';
import { imagesRouter } from './api/images.js';
import { modelsRouter } from './api/models.js';
import { stylesRouter } from './api/styles.js';
import { inngestHandler } from './api/inngest.js';
import { inngest } from './inngest/index.js';
import { setupWebSocket, closeWebSocket, getTotalClients } from './websocket/index.js';

// Load environment variables (try .env.local first, then .env)
config({ path: '.env.local' });
config(); // Also load .env for defaults

const app = express();
const PORT = process.env.PORT || 3001;
const INNGEST_DEV_SERVER = process.env.INNGEST_DEV_SERVER || 'http://localhost:8288';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Static file serving for uploaded character images
const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
app.use('/uploads/characters', express.static(join(DATA_DIR, 'characters'), {
  maxAge: '1y', // Cache for 1 year since images are versioned by index
  immutable: true,
}));

// Static file serving for generated project media (audio, images, videos)
const PROJECTS_DIR = process.env.OUTPUT_DIR || join(process.cwd(), 'data', 'projects');
app.use('/media/projects', express.static(PROJECTS_DIR, {
  maxAge: '1h', // Cache for 1 hour - regeneration may update files
}));

// Inngest serve endpoint - handles function registration and invocation
// This must be registered before other routes to ensure Inngest can reach it
app.use('/api/v1/inngest', inngestHandler);

// API Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/characters', charactersRouter);
app.use('/api/v1/sections', sectionsRouter);
app.use('/api/v1/sentences', sentencesRouter);
// Scripts routes are nested under projects for context
app.use('/api/v1/projects', scriptsRouter);
// Images routes - for image generation with ComfyUI
app.use('/api/v1', imagesRouter);
// Generation models and visual styles - for Style Builder
app.use('/api/v1/models', modelsRouter);
app.use('/api/v1/styles', stylesRouter);

// Test endpoint to trigger Inngest events (development only)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/v1/test/inngest-hello', async (req, res) => {
    try {
      const message = req.body.message || 'Hello from VideoGen AI Studio!';

      // Send an event to Inngest
      await inngest.send({
        name: 'test/hello',
        data: { message },
      });

      res.json({
        success: true,
        message: 'Event sent to Inngest successfully',
        event: {
          name: 'test/hello',
          data: { message },
        },
      });
    } catch (error) {
      console.error('Failed to send Inngest event:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INNGEST_ERROR',
          message: error instanceof Error ? error.message : 'Failed to send event to Inngest',
        },
      });
    }
  });
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
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

// Create HTTP server and attach WebSocket
const server = createServer(app);
const wss = setupWebSocket(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n[Server] SIGTERM received, shutting down gracefully...');
  closeWebSocket();
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n[Server] SIGINT received, shutting down gracefully...');
  closeWebSocket();
  server.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

// Start server
server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   VideoGen AI Studio - Backend Server                      ║
║                                                            ║
║   API:      http://localhost:${PORT}/api/v1                   ║
║   Health:   http://localhost:${PORT}/api/v1/health            ║
║   Inngest:  http://localhost:${PORT}/api/v1/inngest           ║
║   WebSocket: ws://localhost:${PORT}/ws                        ║
║                                                            ║
║   Inngest Dev Server: ${INNGEST_DEV_SERVER}                  ║
║                                                            ║
║   Commands:                                                 ║
║   - npm run db:studio     Open Drizzle Studio              ║
║   - docker-compose up -d  Start Inngest dev server         ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export { app, server, wss, db, inngest };
// reload trigger
