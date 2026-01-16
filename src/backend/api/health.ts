import { Router } from 'express';
import { db, sqlite } from '../db/index.js';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  try {
    // Test database connection
    const dbCheck = sqlite.prepare('SELECT 1 as ok').get() as { ok: number };

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: dbCheck.ok === 1 ? 'connected' : 'error',
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Health check failed',
      },
    });
  }
});
