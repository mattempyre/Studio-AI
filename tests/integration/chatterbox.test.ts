/**
 * Integration tests for Chatterbox TTS client
 *
 * These tests verify the client's integration behavior with mocked server responses.
 * For real server testing, use the manual test script.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChatterboxClient,
  ChatterboxError,
  createChatterboxClient,
  VOICE_PRESETS,
  type SpeechGenerationParams,
} from '../../src/backend/clients/chatterbox.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Create a valid WAV buffer for testing
 */
function createMockWavBuffer(durationMs: number, sampleRate = 44100, channels = 1, bitsPerSample = 16): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = Math.floor((durationMs / 1000) * sampleRate * channels * bytesPerSample);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

describe('Chatterbox Integration Tests', () => {
  let client: ChatterboxClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createChatterboxClient({
      baseUrl: 'http://localhost:8004',
      timeout: 30000,
      maxRetries: 2,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createChatterboxClient', () => {
    it('should create client with default options', () => {
      const defaultClient = createChatterboxClient();
      expect(defaultClient).toBeInstanceOf(ChatterboxClient);
    });

    it('should create client with custom options', () => {
      const customClient = createChatterboxClient({
        baseUrl: 'http://custom:9999',
        timeout: 60000,
      });
      expect(customClient).toBeInstanceOf(ChatterboxClient);
    });
  });

  describe('Speech Generation Flow', () => {
    it('should generate speech with all parameters', async () => {
      const mockWav = createMockWavBuffer(2500); // 2.5 seconds

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const params: SpeechGenerationParams = {
        text: 'This is a test of the text to speech system.',
        voice: 'puck',
        exaggeration: 0.7,
        cfgWeight: 0.4,
        temperature: 0.85,
        speed: 1.2,
      };

      const result = await client.generateSpeech(params, './output/test.wav');

      expect(result.filePath).toBe('./output/test.wav');
      expect(result.durationMs).toBeGreaterThan(2400);
      expect(result.durationMs).toBeLessThan(2600);
      expect(result.fileSizeBytes).toBeGreaterThan(0);
    });

    it('should handle multiple sequential generations', async () => {
      const mockWav1 = createMockWavBuffer(1000);
      const mockWav2 = createMockWavBuffer(1500);
      const mockWav3 = createMockWavBuffer(2000);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockWav1.buffer.slice(mockWav1.byteOffset, mockWav1.byteOffset + mockWav1.byteLength),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockWav2.buffer.slice(mockWav2.byteOffset, mockWav2.byteOffset + mockWav2.byteLength),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockWav3.buffer.slice(mockWav3.byteOffset, mockWav3.byteOffset + mockWav3.byteLength),
        });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const sentences = [
        'First sentence.',
        'Second sentence with more words.',
        'Third sentence is the longest of them all.',
      ];

      const results = [];
      for (let i = 0; i < sentences.length; i++) {
        const result = await client.generateSpeech(
          { text: sentences[i] },
          `./output/sentence_${i + 1}.wav`
        );
        results.push(result);
      }

      expect(results).toHaveLength(3);
      expect(results[0].durationMs).toBeLessThan(results[1].durationMs);
      expect(results[1].durationMs).toBeLessThan(results[2].durationMs);
    });

    it('should use different voices correctly', async () => {
      const mockWav = createMockWavBuffer(1000);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const voices = ['Emily', 'Michael', 'Olivia'];

      for (const voice of voices) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
        });

        await client.generateSpeech({ text: 'Hello', voice }, `./output/${voice}.wav`);

        expect(mockFetch).toHaveBeenLastCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: expect.stringContaining(`"voice":"${voice}.wav"`), // Voice with .wav extension
          })
        );
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle server unavailable gracefully', async () => {
      // Mock all retry attempts for both endpoints
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        client.generateSpeech({ text: 'Hello' }, './output/test.wav')
      ).rejects.toThrow(ChatterboxError);
    }, 15000); // Increase timeout for retry logic

    it('should handle invalid response format', async () => {
      // Both endpoints return invalid WAV data
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => Buffer.from('not a wav file').buffer,
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => Buffer.from('not a wav file').buffer,
        });

      await expect(
        client.generateSpeech({ text: 'Hello' }, './output/test.wav')
      ).rejects.toThrow(ChatterboxError);
    });

    it('should handle timeout', async () => {
      const timeoutClient = createChatterboxClient({
        baseUrl: 'http://localhost:8004',
        timeout: 100, // Very short timeout
        maxRetries: 0,
      });

      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      // Mock timeout for both endpoints
      mockFetch
        .mockRejectedValueOnce(abortError)
        .mockRejectedValueOnce(abortError);

      await expect(
        timeoutClient.generateSpeech({ text: 'Hello' }, './output/test.wav')
      ).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
    });

    it('should provide detailed error information', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => JSON.stringify({ error: 'Model failed to load' }),
      });

      try {
        await client.generateSpeech({ text: 'Hello' }, './output/test.wav');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ChatterboxError);
        expect((error as ChatterboxError).code).toBe('GENERATION_ERROR');
        expect((error as ChatterboxError).details).toBeDefined();
      }
    });
  });

  describe('Request Format', () => {
    it('should send correct headers', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await client.generateSpeech({ text: 'Hello' }, './output/test.wav');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'audio/wav',
          }),
        })
      );
    });

    it('should send POST request to correct endpoint', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await client.generateSpeech({ text: 'Hello' }, './output/test.wav');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8004/v1/audio/speech',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should include all speech parameters in request body', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await client.generateSpeech(
        {
          text: 'Test text',
          voice: 'fenrir',
          speed: 0.8,
        },
        './output/test.wav'
      );

      const lastCall = mockFetch.mock.calls[0];
      const body = JSON.parse(lastCall[1].body);

      expect(body.input).toBe('Test text');
      expect(body.voice).toBe('fenrir.wav'); // Voice includes .wav extension
      expect(body.speed).toBe(0.8);
    });
  });

  describe('File Output', () => {
    it('should create output directory if not exists', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await client.generateSpeech({ text: 'Hello' }, './deep/nested/path/audio.wav');

      expect(fs.mkdir).toHaveBeenCalledWith('./deep/nested/path', { recursive: true });
    });

    it('should write audio data to file', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await client.generateSpeech({ text: 'Hello' }, './output/audio.wav');

      expect(fs.writeFile).toHaveBeenCalledWith('./output/audio.wav', expect.any(Buffer));
    });
  });

  describe('Duration Calculation', () => {
    it('should calculate duration correctly for various audio lengths', async () => {
      const testCases = [
        { durationMs: 500, expectedMin: 490, expectedMax: 510 },
        { durationMs: 1000, expectedMin: 990, expectedMax: 1010 },
        { durationMs: 5000, expectedMin: 4990, expectedMax: 5010 },
        { durationMs: 10000, expectedMin: 9990, expectedMax: 10010 },
      ];

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      for (const tc of testCases) {
        const mockWav = createMockWavBuffer(tc.durationMs);

        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
        });

        const result = await client.generateSpeech({ text: 'Test' }, './output/test.wav');

        expect(result.durationMs).toBeGreaterThanOrEqual(tc.expectedMin);
        expect(result.durationMs).toBeLessThanOrEqual(tc.expectedMax);
      }
    });
  });
});
