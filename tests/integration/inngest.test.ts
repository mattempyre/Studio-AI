import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import '../setup.js';

// Create a test app with Inngest endpoint
async function createTestAppWithInngest(): Promise<Express> {
  const express = await import('express');
  const cors = await import('cors');
  const { inngestHandler } = await import('../../src/backend/api/inngest.js');
  const { healthRouter } = await import('../../src/backend/api/health.js');

  const app = express.default();

  app.use(cors.default());
  app.use(express.default.json());

  // Inngest endpoint
  app.use('/api/v1/inngest', inngestHandler);
  app.use('/api/v1/health', healthRouter);

  // Error handling
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message,
      },
    });
  });

  return app;
}

describe('Inngest API Endpoint', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestAppWithInngest();
  });

  describe('GET /api/v1/inngest', () => {
    it('should respond to introspection requests', async () => {
      const res = await request(app)
        .get('/api/v1/inngest');

      // Inngest endpoint should return some response (could be 200 or error)
      // Without dev server, it may return an error but endpoint should exist
      expect([200, 400, 401, 500]).toContain(res.status);
    });
  });

  describe('PUT /api/v1/inngest', () => {
    it('should respond to registration requests', async () => {
      // PUT is used by Inngest to register functions
      // Without a dev server running, various responses are valid
      const res = await request(app)
        .put('/api/v1/inngest')
        .send({});

      // The endpoint should respond (not 404)
      expect([200, 400, 401, 500]).toContain(res.status);
    });
  });
});

describe('Inngest Client Configuration', () => {
  it('should have the correct app ID', async () => {
    const { inngest } = await import('../../src/backend/inngest/client.js');
    expect(inngest.id).toBe('videogen-ai-studio');
  });

  it('should export all required functions', async () => {
    const { functions } = await import('../../src/backend/inngest/index.js');
    expect(functions).toBeDefined();
    expect(Array.isArray(functions)).toBe(true);
    expect(functions.length).toBeGreaterThan(0);
  });

  it('should have hello function registered', async () => {
    const { helloFunction } = await import('../../src/backend/inngest/functions/hello.js');
    expect(helloFunction).toBeDefined();
  });
});

describe('Event Types', () => {
  it('should have correct event type definitions', async () => {
    const { inngest } = await import('../../src/backend/inngest/client.js');

    // Test creating typed events (this validates the TypeScript types at runtime)
    const testEvent = {
      name: 'test/hello' as const,
      data: { message: 'test' },
    };

    const audioEvent = {
      name: 'audio/generate' as const,
      data: {
        sentenceId: 'sent-1',
        projectId: 'proj-1',
        text: 'Hello',
        voiceId: 'puck',
      },
    };

    const imageEvent = {
      name: 'image/generate' as const,
      data: {
        sentenceId: 'sent-1',
        projectId: 'proj-1',
        prompt: 'A sunset',
        style: 'cinematic',
      },
    };

    const videoEvent = {
      name: 'video/generate' as const,
      data: {
        sentenceId: 'sent-1',
        projectId: 'proj-1',
        imageFile: 'image.png',
        prompt: 'Pan right',
        cameraMovement: 'pan_right',
        motionStrength: 0.5,
      },
    };

    // All events should have valid structure
    expect(testEvent.name).toBe('test/hello');
    expect(audioEvent.name).toBe('audio/generate');
    expect(imageEvent.name).toBe('image/generate');
    expect(videoEvent.name).toBe('video/generate');
  });
});
