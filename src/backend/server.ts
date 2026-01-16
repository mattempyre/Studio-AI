import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { db } from './db/index.js';
import { projectsRouter } from './api/projects.js';
import { charactersRouter } from './api/characters.js';
import { healthRouter } from './api/health.js';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

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

// API Routes
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1/characters', charactersRouter);

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

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   VideoGen AI Studio - Backend Server                      ║
║                                                            ║
║   API:      http://localhost:${PORT}/api/v1                   ║
║   Health:   http://localhost:${PORT}/api/v1/health            ║
║                                                            ║
║   Run 'npm run db:studio' to open Drizzle Studio           ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export { app, db };
