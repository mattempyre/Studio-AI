/**
 * Unit Tests for Audio Generation Inngest Function
 * STORY-014: Audio Generation Job
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must be hoisted
vi.mock('../../src/backend/clients/chatterbox.js', () => ({
    createChatterboxClient: vi.fn(() => ({
        generateSpeech: vi.fn().mockResolvedValue({
            filePath: '/mock/path/p1/s1.wav',
            durationMs: 5000,
        }),
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
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue({}),
            })),
        })),
    },
    sentences: { id: 'sentences' },
}));

vi.mock('../../src/backend/services/outputPaths.js', () => ({
    getAudioPath: vi.fn((proj, sent) => `/mock/path/${proj}/${sent}.wav`),
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
import { generateAudioFunction } from '../../src/backend/inngest/functions/generateAudio.js';

describe('generateAudioFunction', () => {
    it('should have correct function configuration', () => {
        expect(generateAudioFunction.config.id).toBe('generate-audio');
        expect(generateAudioFunction.trigger).toEqual({ event: 'audio/generate' });
        expect(generateAudioFunction.config.concurrency).toEqual({ limit: 4 });
    });

    describe('Hander Logic (Partial Simulation)', () => {
        it('should be structured correctly', () => {
            expect(typeof generateAudioFunction.handler).toBe('function');
        });
    });
});
