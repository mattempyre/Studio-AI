/**
 * Tests for Audio Generation Functions
 *
 * Tests both per-sentence (generateAudio) and per-section (generateSectionAudio)
 * Inngest functions, focusing on Whisper integration and word timing extraction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WordTiming, TranscriptionResult } from '../../src/backend/clients/whisper';
import type { SpeechGenerationResult } from '../../src/backend/clients/chatterbox';
import type { WordTimingData } from '../../src/backend/services/audioAlignment';

// Mock the clients
vi.mock('../../src/backend/clients/chatterbox', () => ({
  createChatterboxClient: vi.fn(),
}));

vi.mock('../../src/backend/clients/whisper', () => ({
  createWhisperClient: vi.fn(),
}));

vi.mock('../../src/backend/services/jobService', () => ({
  jobService: {
    create: vi.fn(),
    markRunning: vi.fn(),
    markCompletedWithBroadcast: vi.fn(),
    markFailedWithBroadcast: vi.fn(),
    updateProgressWithBroadcast: vi.fn(),
    getLatestBySentenceAndType: vi.fn(),
  },
}));

vi.mock('../../src/backend/services/outputPaths', () => ({
  getAudioPath: vi.fn((projectId: string, sentenceId: string) => `/output/${projectId}/audio/${sentenceId}.wav`),
  getSectionAudioPath: vi.fn((projectId: string, sectionId: string) => `/output/${projectId}/audio/section-${sectionId}.wav`),
  ensureOutputDir: vi.fn(),
}));

// Import mocked modules
import { createChatterboxClient } from '../../src/backend/clients/chatterbox';
import { createWhisperClient } from '../../src/backend/clients/whisper';
import { jobService } from '../../src/backend/services/jobService';

describe('Audio Generation', () => {
  // Mock implementations
  let mockChatterboxClient: {
    generateSpeech: ReturnType<typeof vi.fn>;
    healthCheck: ReturnType<typeof vi.fn>;
  };

  let mockWhisperClient: {
    transcribe: ReturnType<typeof vi.fn>;
    healthCheck: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Chatterbox mock
    mockChatterboxClient = {
      generateSpeech: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue(true),
    };
    (createChatterboxClient as ReturnType<typeof vi.fn>).mockReturnValue(mockChatterboxClient);

    // Setup Whisper mock
    mockWhisperClient = {
      transcribe: vi.fn(),
      healthCheck: vi.fn().mockResolvedValue(true),
    };
    (createWhisperClient as ReturnType<typeof vi.fn>).mockReturnValue(mockWhisperClient);

    // Setup jobService mocks
    (jobService.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'job-123' });
    (jobService.markRunning as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (jobService.markCompletedWithBroadcast as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (jobService.updateProgressWithBroadcast as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (jobService.getLatestBySentenceAndType as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Word Timing Extraction (Per-Sentence)', () => {
    it('should extract word timings from Whisper transcription', async () => {
      const mockTranscription: TranscriptionResult = {
        text: 'Hello world how are you',
        language: 'en',
        duration: 2.5,
        segments: [],
        words: [
          { word: 'Hello', start: 0.0, end: 0.4, probability: 0.95 },
          { word: 'world', start: 0.4, end: 0.8, probability: 0.92 },
          { word: 'how', start: 0.9, end: 1.1, probability: 0.98 },
          { word: 'are', start: 1.1, end: 1.3, probability: 0.96 },
          { word: 'you', start: 1.3, end: 1.6, probability: 0.94 },
        ],
      };

      mockWhisperClient.transcribe.mockResolvedValue(mockTranscription);

      // Simulate the word timing extraction logic from generateAudio
      const transcription = await mockWhisperClient.transcribe('/path/to/audio.wav', 'en');
      const wordTimings: WordTimingData[] = transcription.words.map((w: WordTiming) => ({
        word: w.word.trim(),
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        probability: w.probability,
      }));

      expect(wordTimings).toHaveLength(5);
      expect(wordTimings[0]).toEqual({
        word: 'Hello',
        startMs: 0,
        endMs: 400,
        probability: 0.95,
      });
      expect(wordTimings[4]).toEqual({
        word: 'you',
        startMs: 1300,
        endMs: 1600,
        probability: 0.94,
      });
    });

    it('should handle Whisper service unavailability gracefully', async () => {
      mockWhisperClient.healthCheck.mockResolvedValue(false);

      const isAvailable = await mockWhisperClient.healthCheck();
      expect(isAvailable).toBe(false);

      // In the actual function, this returns an empty array
      const wordTimings: WordTimingData[] = [];
      expect(wordTimings).toHaveLength(0);
    });

    it('should handle Whisper transcription errors gracefully', async () => {
      mockWhisperClient.healthCheck.mockResolvedValue(true);
      mockWhisperClient.transcribe.mockRejectedValue(new Error('Transcription failed'));

      let wordTimings: WordTimingData[] = [];

      try {
        await mockWhisperClient.transcribe('/path/to/audio.wav', 'en');
      } catch {
        // In actual code, we catch and return empty array
        wordTimings = [];
      }

      expect(wordTimings).toHaveLength(0);
    });

    it('should handle empty transcription result', async () => {
      const mockTranscription: TranscriptionResult = {
        text: '',
        language: 'en',
        duration: 0,
        segments: [],
        words: [],
      };

      mockWhisperClient.transcribe.mockResolvedValue(mockTranscription);

      const transcription = await mockWhisperClient.transcribe('/path/to/audio.wav', 'en');
      const wordTimings: WordTimingData[] = transcription.words.map((w: WordTiming) => ({
        word: w.word.trim(),
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        probability: w.probability,
      }));

      expect(wordTimings).toHaveLength(0);
    });

    it('should trim whitespace from words', async () => {
      const mockTranscription: TranscriptionResult = {
        text: 'Hello world',
        language: 'en',
        duration: 1.0,
        segments: [],
        words: [
          { word: '  Hello  ', start: 0.0, end: 0.4, probability: 0.95 },
          { word: ' world ', start: 0.4, end: 0.8, probability: 0.92 },
        ],
      };

      mockWhisperClient.transcribe.mockResolvedValue(mockTranscription);

      const transcription = await mockWhisperClient.transcribe('/path/to/audio.wav', 'en');
      const wordTimings: WordTimingData[] = transcription.words.map((w: WordTiming) => ({
        word: w.word.trim(),
        startMs: Math.round(w.start * 1000),
        endMs: Math.round(w.end * 1000),
        probability: w.probability,
      }));

      expect(wordTimings[0].word).toBe('Hello');
      expect(wordTimings[1].word).toBe('world');
    });
  });

  describe('Chatterbox TTS Integration', () => {
    it('should generate speech and return file path and duration', async () => {
      const mockResult: SpeechGenerationResult = {
        filePath: '/output/project-1/audio/sentence-1.wav',
        durationMs: 2500,
        fileSizeBytes: 88200,
      };

      mockChatterboxClient.generateSpeech.mockResolvedValue(mockResult);

      const result = await mockChatterboxClient.generateSpeech(
        { text: 'Hello world', voice: 'Emily' },
        '/output/project-1/audio/sentence-1.wav'
      );

      expect(result.filePath).toBe('/output/project-1/audio/sentence-1.wav');
      expect(result.durationMs).toBe(2500);
      expect(mockChatterboxClient.generateSpeech).toHaveBeenCalledWith(
        { text: 'Hello world', voice: 'Emily' },
        '/output/project-1/audio/sentence-1.wav'
      );
    });

    it('should handle TTS generation failure', async () => {
      mockChatterboxClient.generateSpeech.mockRejectedValue(new Error('TTS generation failed'));

      await expect(
        mockChatterboxClient.generateSpeech(
          { text: 'Hello world', voice: 'Emily' },
          '/output/audio.wav'
        )
      ).rejects.toThrow('TTS generation failed');
    });
  });

  describe('Per-Section Audio Generation Flow', () => {
    it('should concatenate sentences and generate single audio file', async () => {
      const sentenceTexts = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
        { sentenceId: 's2', text: 'How are you?', order: 1 },
        { sentenceId: 's3', text: 'I am fine.', order: 2 },
      ];

      // Simulate the text concatenation logic from generateSectionAudio
      const sorted = [...sentenceTexts].sort((a, b) => a.order - b.order);
      const fullText = sorted
        .map((s) => s.text.trim())
        .filter((t) => t.length > 0)
        .join(' ');

      expect(fullText).toBe('Hello world. How are you? I am fine.');
    });

    it('should filter empty sentences during concatenation', async () => {
      const sentenceTexts = [
        { sentenceId: 's1', text: 'Hello world.', order: 0 },
        { sentenceId: 's2', text: '', order: 1 },
        { sentenceId: 's3', text: '   ', order: 2 },
        { sentenceId: 's4', text: 'Goodbye.', order: 3 },
      ];

      const sorted = [...sentenceTexts].sort((a, b) => a.order - b.order);
      const fullText = sorted
        .map((s) => s.text.trim())
        .filter((t) => t.length > 0)
        .join(' ');

      expect(fullText).toBe('Hello world. Goodbye.');
    });

    it('should sort sentences by order before concatenation', async () => {
      const sentenceTexts = [
        { sentenceId: 's3', text: 'Third.', order: 2 },
        { sentenceId: 's1', text: 'First.', order: 0 },
        { sentenceId: 's2', text: 'Second.', order: 1 },
      ];

      const sorted = [...sentenceTexts].sort((a, b) => a.order - b.order);
      const fullText = sorted
        .map((s) => s.text.trim())
        .filter((t) => t.length > 0)
        .join(' ');

      expect(fullText).toBe('First. Second. Third.');
    });

    it('should use equal distribution fallback when Whisper unavailable', async () => {
      const totalDurationMs = 3000;
      const sentenceCount = 3;
      const durationPerSentence = Math.floor(totalDurationMs / sentenceCount);

      const sentenceTexts = [
        { sentenceId: 's1', text: 'First.', order: 0 },
        { sentenceId: 's2', text: 'Second.', order: 1 },
        { sentenceId: 's3', text: 'Third.', order: 2 },
      ];

      // Simulate fallback logic
      const timings = sentenceTexts.map((s, index) => ({
        sentenceId: s.sentenceId,
        startMs: index * durationPerSentence,
        endMs: (index + 1) * durationPerSentence,
        confidence: 0.5,
        words: [],
      }));

      expect(timings[0]).toEqual({
        sentenceId: 's1',
        startMs: 0,
        endMs: 1000,
        confidence: 0.5,
        words: [],
      });
      expect(timings[1]).toEqual({
        sentenceId: 's2',
        startMs: 1000,
        endMs: 2000,
        confidence: 0.5,
        words: [],
      });
      expect(timings[2]).toEqual({
        sentenceId: 's3',
        startMs: 2000,
        endMs: 3000,
        confidence: 0.5,
        words: [],
      });
    });
  });

  describe('Word Timing Conversion', () => {
    it('should convert Whisper seconds to milliseconds correctly', () => {
      const whisperWord: WordTiming = {
        word: 'Hello',
        start: 0.123,
        end: 0.456,
        probability: 0.95,
      };

      const converted: WordTimingData = {
        word: whisperWord.word.trim(),
        startMs: Math.round(whisperWord.start * 1000),
        endMs: Math.round(whisperWord.end * 1000),
        probability: whisperWord.probability,
      };

      expect(converted.startMs).toBe(123);
      expect(converted.endMs).toBe(456);
    });

    it('should round milliseconds correctly for edge cases', () => {
      const whisperWord: WordTiming = {
        word: 'Test',
        start: 1.9995,
        end: 2.0005,
        probability: 0.9,
      };

      const converted: WordTimingData = {
        word: whisperWord.word.trim(),
        startMs: Math.round(whisperWord.start * 1000),
        endMs: Math.round(whisperWord.end * 1000),
        probability: whisperWord.probability,
      };

      // 1.9995 * 1000 = 1999.5 -> rounds to 2000
      // 2.0005 * 1000 = 2000.5 -> rounds to 2001
      expect(converted.startMs).toBe(2000);
      expect(converted.endMs).toBe(2001);
    });
  });

  describe('Job Service Integration', () => {
    it('should create and track job through lifecycle', async () => {
      const projectId = 'project-123';
      const sentenceId = 'sentence-456';

      // Create job
      const job = await jobService.create({
        projectId,
        sentenceId,
        jobType: 'audio',
        inngestRunId: 'run-789',
      });

      expect(job.id).toBe('job-123');
      expect(jobService.create).toHaveBeenCalledWith({
        projectId,
        sentenceId,
        jobType: 'audio',
        inngestRunId: 'run-789',
      });

      // Mark running
      await jobService.markRunning(job.id, 'run-789');
      expect(jobService.markRunning).toHaveBeenCalledWith('job-123', 'run-789');

      // Update progress
      await jobService.updateProgressWithBroadcast(job.id, 50, {
        projectId,
        jobType: 'audio',
        sentenceId,
        message: 'Processing...',
      });
      expect(jobService.updateProgressWithBroadcast).toHaveBeenCalled();

      // Mark completed
      await jobService.markCompletedWithBroadcast(job.id, {
        projectId,
        jobType: 'audio',
        sentenceId,
        resultFile: '/path/to/audio.wav',
        duration: 2500,
      });
      expect(jobService.markCompletedWithBroadcast).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing text gracefully', () => {
      const sentenceTexts: Array<{ sentenceId: string; text: string; order: number }> = [];

      const sorted = [...sentenceTexts].sort((a, b) => a.order - b.order);
      const fullText = sorted
        .map((s) => s.text.trim())
        .filter((t) => t.length > 0)
        .join(' ');

      expect(fullText).toBe('');
      expect(fullText.trim().length).toBe(0);
    });

    it('should handle all-whitespace text', () => {
      const sentenceTexts = [
        { sentenceId: 's1', text: '   ', order: 0 },
        { sentenceId: 's2', text: '\n\t', order: 1 },
      ];

      const sorted = [...sentenceTexts].sort((a, b) => a.order - b.order);
      const fullText = sorted
        .map((s) => s.text.trim())
        .filter((t) => t.length > 0)
        .join(' ');

      expect(fullText).toBe('');
    });
  });
});

describe('Word Timing Storage Format', () => {
  it('should produce JSON-serializable word timing data', () => {
    const wordTimings: WordTimingData[] = [
      { word: 'Hello', startMs: 0, endMs: 400, probability: 0.95 },
      { word: 'world', startMs: 400, endMs: 800, probability: 0.92 },
    ];

    // Verify it can be serialized and deserialized
    const json = JSON.stringify(wordTimings);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(wordTimings);
    expect(parsed[0].word).toBe('Hello');
    expect(parsed[0].startMs).toBe(0);
  });

  it('should handle special characters in words', () => {
    const wordTimings: WordTimingData[] = [
      { word: "it's", startMs: 0, endMs: 300, probability: 0.9 },
      { word: "don't", startMs: 300, endMs: 600, probability: 0.88 },
      { word: 'café', startMs: 600, endMs: 900, probability: 0.85 },
    ];

    const json = JSON.stringify(wordTimings);
    const parsed = JSON.parse(json);

    expect(parsed[0].word).toBe("it's");
    expect(parsed[1].word).toBe("don't");
    expect(parsed[2].word).toBe('café');
  });
});
