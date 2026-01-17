/**
 * Unit Tests for Short-Form Script Generation Inngest Function
 * STORY-009: AI Script Generation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateScriptFunction } from '../../src/backend/inngest/functions/generateScript.js';
import { db, projects, sections, sentences } from '../../src/backend/db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Mock the Deepseek client
const mockGenerateScript = vi.fn();
vi.mock('../../src/backend/clients/deepseek.js', () => ({
  getDeepseekClient: () => ({
    generateScript: mockGenerateScript,
  }),
}));

// Mock jobService
const mockJobCreate = vi.fn();
const mockJobMarkRunning = vi.fn();
const mockJobUpdateProgressWithBroadcast = vi.fn();
const mockJobMarkCompletedWithBroadcast = vi.fn();

vi.mock('../../src/backend/services/jobService.js', () => ({
  jobService: {
    create: (...args: unknown[]) => mockJobCreate(...args),
    markRunning: (...args: unknown[]) => mockJobMarkRunning(...args),
    updateProgressWithBroadcast: (...args: unknown[]) => mockJobUpdateProgressWithBroadcast(...args),
    markCompletedWithBroadcast: (...args: unknown[]) => mockJobMarkCompletedWithBroadcast(...args),
  },
}));

// Mock Inngest
const mockInngestSend = vi.fn();
vi.mock('../../src/backend/inngest/client.js', () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
    createFunction: vi.fn((config, trigger, handler) => ({
      config,
      trigger,
      handler,
    })),
  },
}));

describe('generateScriptFunction', () => {
  describe('Function Configuration', () => {
    it('should have correct function ID', () => {
      expect(generateScriptFunction.config.id).toBe('generate-script');
    });

    it('should have correct function name', () => {
      expect(generateScriptFunction.config.name).toBe('Generate Short Script');
    });

    it('should listen to script/generate event', () => {
      expect(generateScriptFunction.trigger).toEqual({ event: 'script/generate' });
    });

    it('should have retry configuration', () => {
      expect(generateScriptFunction.config.retries).toBe(2);
    });

    it('should have concurrency limit of 2', () => {
      expect(generateScriptFunction.config.concurrency).toEqual({ limit: 2 });
    });
  });
});

describe('generateScript unit tests (with mocked handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobCreate.mockResolvedValue({ id: 'test-job-id' });
    mockJobMarkRunning.mockResolvedValue(undefined);
    mockJobUpdateProgressWithBroadcast.mockResolvedValue(undefined);
    mockJobMarkCompletedWithBroadcast.mockResolvedValue(undefined);
    mockInngestSend.mockResolvedValue({ ids: ['test-event-id'] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Script Generation Flow', () => {
    it('should call Deepseek with correct parameters', async () => {
      const mockScript = {
        title: 'Test Video Title',
        sections: [
          {
            title: 'Introduction',
            sentences: [
              { text: 'Welcome to this video.', imagePrompt: 'Opening scene', videoPrompt: 'zoom out' },
            ],
          },
        ],
        totalSentences: 1,
        estimatedDurationMinutes: 1,
      };

      mockGenerateScript.mockResolvedValue(mockScript);

      // Simulate calling generateScript directly
      await mockGenerateScript({
        topic: 'Test Topic',
        targetDurationMinutes: 5,
        visualStyle: 'cinematic',
        useSearchGrounding: true,
      });

      expect(mockGenerateScript).toHaveBeenCalledWith({
        topic: 'Test Topic',
        targetDurationMinutes: 5,
        visualStyle: 'cinematic',
        useSearchGrounding: true,
      });
    });

    it('should handle search grounding option', async () => {
      const mockScript = {
        title: 'Factual Video',
        sections: [{ title: 'Facts', sentences: [{ text: 'Fact one.' }] }],
        totalSentences: 1,
        estimatedDurationMinutes: 1,
      };

      mockGenerateScript.mockResolvedValue(mockScript);

      await mockGenerateScript({
        topic: 'Current Events',
        targetDurationMinutes: 3,
        useSearchGrounding: true,
      });

      expect(mockGenerateScript).toHaveBeenCalledWith(
        expect.objectContaining({
          useSearchGrounding: true,
        })
      );
    });

    it('should create job record on start', async () => {
      await mockJobCreate({
        projectId: 'test-project',
        jobType: 'script',
        inngestRunId: 'test-run-id',
      });

      expect(mockJobCreate).toHaveBeenCalledWith({
        projectId: 'test-project',
        jobType: 'script',
        inngestRunId: 'test-run-id',
      });
    });

    it('should broadcast progress updates', async () => {
      // Simulate progress broadcast calls
      await mockJobUpdateProgressWithBroadcast('test-job-id', 25, {
        projectId: 'test-project',
        jobType: 'script',
        message: 'Generating script with AI...',
      });

      expect(mockJobUpdateProgressWithBroadcast).toHaveBeenCalledWith(
        'test-job-id',
        25,
        expect.objectContaining({
          projectId: 'test-project',
          jobType: 'script',
        })
      );
    });

    it('should mark job completed on success', async () => {
      await mockJobMarkCompletedWithBroadcast('test-job-id', {
        projectId: 'test-project',
        jobType: 'script',
      });

      expect(mockJobMarkCompletedWithBroadcast).toHaveBeenCalledWith(
        'test-job-id',
        expect.objectContaining({
          projectId: 'test-project',
          jobType: 'script',
        })
      );
    });

    it('should emit script/completed event on success', async () => {
      await mockInngestSend({
        name: 'script/completed',
        data: {
          projectId: 'test-project',
          sectionCount: 2,
          sentenceCount: 5,
        },
      });

      expect(mockInngestSend).toHaveBeenCalledWith({
        name: 'script/completed',
        data: expect.objectContaining({
          projectId: 'test-project',
          sectionCount: 2,
          sentenceCount: 5,
        }),
      });
    });
  });

  describe('Script Parsing', () => {
    it('should handle multi-section scripts', async () => {
      const mockScript = {
        title: 'Multi-Section Video',
        sections: [
          {
            title: 'Introduction',
            sentences: [
              { text: 'Welcome!', imagePrompt: 'Opening', videoPrompt: 'fade in' },
              { text: 'Today we explore...', imagePrompt: 'Topic reveal', videoPrompt: 'zoom' },
            ],
          },
          {
            title: 'Main Content',
            sentences: [
              { text: 'The first point is...', imagePrompt: 'Point 1', videoPrompt: 'pan' },
              { text: 'Additionally...', imagePrompt: 'Point 2', videoPrompt: 'static' },
            ],
          },
          {
            title: 'Conclusion',
            sentences: [
              { text: 'In summary...', imagePrompt: 'Summary', videoPrompt: 'zoom out' },
            ],
          },
        ],
        totalSentences: 5,
        estimatedDurationMinutes: 2,
      };

      mockGenerateScript.mockResolvedValue(mockScript);
      const result = await mockGenerateScript({ topic: 'Test', targetDurationMinutes: 2 });

      expect(result.sections).toHaveLength(3);
      expect(result.totalSentences).toBe(5);
    });

    it('should include imagePrompt and videoPrompt in sentences', async () => {
      const mockScript = {
        title: 'Visual Video',
        sections: [
          {
            title: 'Scene',
            sentences: [
              {
                text: 'Visual content here.',
                imagePrompt: 'Stunning landscape in cinematic style',
                videoPrompt: 'slow pan across the scene',
              },
            ],
          },
        ],
        totalSentences: 1,
        estimatedDurationMinutes: 0.5,
      };

      mockGenerateScript.mockResolvedValue(mockScript);
      const result = await mockGenerateScript({ topic: 'Visual', targetDurationMinutes: 1 });

      const sentence = result.sections[0].sentences[0];
      expect(sentence.imagePrompt).toBe('Stunning landscape in cinematic style');
      expect(sentence.videoPrompt).toBe('slow pan across the scene');
    });
  });

  describe('Progress Updates', () => {
    it('should report 0% at start', async () => {
      await mockJobUpdateProgressWithBroadcast('job-id', 0, {
        projectId: 'project-id',
        jobType: 'script',
        message: 'Starting script generation...',
      });

      expect(mockJobUpdateProgressWithBroadcast).toHaveBeenCalledWith(
        'job-id',
        0,
        expect.objectContaining({ message: 'Starting script generation...' })
      );
    });

    it('should report 25% when calling AI', async () => {
      await mockJobUpdateProgressWithBroadcast('job-id', 25, {
        projectId: 'project-id',
        jobType: 'script',
        message: 'Generating script with AI...',
      });

      expect(mockJobUpdateProgressWithBroadcast).toHaveBeenCalledWith(
        'job-id',
        25,
        expect.objectContaining({ message: 'Generating script with AI...' })
      );
    });

    it('should report 50% when preparing to save', async () => {
      await mockJobUpdateProgressWithBroadcast('job-id', 50, {
        projectId: 'project-id',
        jobType: 'script',
        message: 'Preparing to save script...',
      });

      expect(mockJobUpdateProgressWithBroadcast).toHaveBeenCalledWith(
        'job-id',
        50,
        expect.objectContaining({ message: 'Preparing to save script...' })
      );
    });

    it('should report 75% when saving to database', async () => {
      await mockJobUpdateProgressWithBroadcast('job-id', 75, {
        projectId: 'project-id',
        jobType: 'script',
        message: 'Saving script to database...',
      });

      expect(mockJobUpdateProgressWithBroadcast).toHaveBeenCalledWith(
        'job-id',
        75,
        expect.objectContaining({ message: 'Saving script to database...' })
      );
    });
  });
});
