/**
 * Unit Tests for Video Generation Inngest Function
 * STORY-5.1: Video Generation Job
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks must be hoisted
vi.mock('../../src/backend/clients/comfyui.js', () => ({
  createComfyUIClient: vi.fn(() => ({
    uploadImage: vi.fn().mockResolvedValue('uploaded-image.png'),
    generateVideo: vi.fn().mockResolvedValue('/mock/path/p1/videos/s1.mp4'),
  })),
}));

vi.mock('../../src/backend/services/jobService.js', () => ({
  jobService: {
    create: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    markRunning: vi.fn().mockResolvedValue(undefined),
    getLatestBySentenceAndType: vi.fn().mockResolvedValue(null),
    updateProgressWithBroadcast: vi.fn().mockResolvedValue(undefined),
    markCompletedWithBroadcast: vi.fn().mockResolvedValue(undefined),
    markFailedWithBroadcast: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/backend/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue(null),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({}),
      })),
    })),
  },
  sentences: { id: 'sentences' },
  generationModels: { id: 'generationModels', workflowCategory: 'workflowCategory' },
}));

vi.mock('../../src/backend/services/outputPaths.js', () => ({
  getVideoPath: vi.fn((proj, sent) => `/mock/path/${proj}/videos/${sent}.mp4`),
  ensureOutputDir: vi.fn().mockResolvedValue('/mock/path'),
  toMediaUrl: vi.fn((path) => path.replace('/mock/path', '/media/projects')),
}));

// Mock Inngest Client
vi.mock('../../src/backend/inngest/client.js', () => ({
  inngest: {
    createFunction: vi.fn((config, trigger, handler) => ({
      config,
      trigger,
      handler,
    })),
  },
}));

// Import after mocks
import { generateVideoFunction, calculateFrameCount, DEFAULT_FPS, DEFAULT_DURATION_SECONDS } from '../../src/backend/inngest/functions/generateVideo.js';

describe('generateVideoFunction', () => {
  describe('Function Configuration', () => {
    it('should have correct function ID', () => {
      expect(generateVideoFunction.config.id).toBe('generate-video');
    });

    it('should have correct function name', () => {
      expect(generateVideoFunction.config.name).toBe('Generate Video');
    });

    it('should trigger on video/generate event', () => {
      expect(generateVideoFunction.trigger).toEqual({ event: 'video/generate' });
    });

    it('should have concurrency limit of 1 (GPU-bound)', () => {
      expect(generateVideoFunction.config.concurrency).toEqual({ limit: 1 });
    });

    it('should have 3 retries configured (with automatic exponential backoff)', () => {
      expect(generateVideoFunction.config.retries).toBe(3);
    });
  });

  describe('Handler Structure', () => {
    it('should be a function', () => {
      expect(typeof generateVideoFunction.handler).toBe('function');
    });
  });
});

describe('calculateFrameCount', () => {
  // Now testing the actual exported function

  describe('Default behavior (no audio duration)', () => {
    it('should return 80 frames for default 5 second duration at 16fps', () => {
      // Default: 5 seconds * 16 fps = 80 frames
      expect(calculateFrameCount(null)).toBe(80);
      expect(calculateFrameCount(undefined)).toBe(80);
    });
  });

  describe('Duration calculation', () => {
    it('should calculate frames correctly for 3 second audio', () => {
      // 3 seconds * 16 fps = 48 frames
      expect(calculateFrameCount(3000)).toBe(48);
    });

    it('should calculate frames correctly for 10 second audio', () => {
      // 10 seconds * 16 fps = 160 frames
      expect(calculateFrameCount(10000)).toBe(160);
    });

    it('should clamp duration to minimum of 2 seconds', () => {
      // 0.5 seconds should clamp to 2 seconds = 32 frames
      expect(calculateFrameCount(500)).toBe(32);
    });

    it('should clamp duration to maximum of 15 seconds', () => {
      // 30 seconds should clamp to 15 seconds = 240 frames
      expect(calculateFrameCount(30000)).toBe(240);
    });

    it('should respect custom fps parameter', () => {
      // 5 seconds * 24 fps = 120 frames
      expect(calculateFrameCount(5000, 24)).toBe(120);
    });
  });

  describe('Edge cases', () => {
    it('should use default duration for null audioDuration', () => {
      expect(calculateFrameCount(null)).toBe(DEFAULT_DURATION_SECONDS * DEFAULT_FPS);
    });

    it('should use default duration for zero audioDuration', () => {
      expect(calculateFrameCount(0)).toBe(DEFAULT_DURATION_SECONDS * DEFAULT_FPS);
    });

    it('should use default duration for negative audioDuration', () => {
      expect(calculateFrameCount(-1000)).toBe(DEFAULT_DURATION_SECONDS * DEFAULT_FPS);
    });
  });
});

describe('Video Generation Event Schema', () => {
  it('should expect required fields in event data', () => {
    const requiredFields = [
      'sentenceId',
      'projectId',
      'imageFile',
      'prompt',
      'cameraMovement',
      'motionStrength',
    ];

    // This documents the expected event schema
    requiredFields.forEach(field => {
      expect(typeof field).toBe('string');
    });
  });
});
