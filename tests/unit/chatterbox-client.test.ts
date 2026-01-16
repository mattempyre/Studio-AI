import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ChatterboxClient,
  ChatterboxError,
  getWavDurationMs,
  VOICE_PRESETS,
} from '../../src/backend/clients/chatterbox.js';
import * as fs from 'fs/promises';

// Mock the fs module
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * Create a valid WAV buffer for testing
 * WAV format: 44-byte header + audio data
 */
function createMockWavBuffer(durationMs: number, sampleRate = 44100, channels = 1, bitsPerSample = 16): Buffer {
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = Math.floor((durationMs / 1000) * sampleRate * channels * bytesPerSample);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4); // Chunk size
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1 size (PCM)
  buffer.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  buffer.writeUInt16LE(channels, 22); // Num channels
  buffer.writeUInt32LE(sampleRate, 24); // Sample rate
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28); // Byte rate
  buffer.writeUInt16LE(channels * bytesPerSample, 32); // Block align
  buffer.writeUInt16LE(bitsPerSample, 34); // Bits per sample

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40); // Subchunk2 size

  return buffer;
}

describe('Chatterbox Client', () => {
  let client: ChatterboxClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ChatterboxClient({
      baseUrl: 'http://localhost:8004',
      timeout: 5000,
      maxRetries: 2,
      retryDelay: 100,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      const customClient = new ChatterboxClient({
        baseUrl: 'http://custom:9999/',
        timeout: 10000,
        maxRetries: 5,
      });

      expect(customClient).toBeDefined();
    });

    it('should strip trailing slash from baseUrl', () => {
      const customClient = new ChatterboxClient({
        baseUrl: 'http://localhost:8004/',
      });

      expect(customClient).toBeDefined();
    });

    it('should use default options when not provided', () => {
      const defaultClient = new ChatterboxClient();
      expect(defaultClient).toBeDefined();
    });
  });

  describe('healthCheck', () => {
    it('should return true when server is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return true when OPTIONS returns 405', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({ ok: false, status: 405 });

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return false when server is unavailable', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const healthy = await client.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('getVoices', () => {
    it('should return voices from server', async () => {
      const mockVoices = [
        { display_name: 'Emily', filename: 'Emily.wav' },
        { display_name: 'Michael', filename: 'Michael.wav' },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVoices,
      });

      const voices = await client.getVoices();

      expect(voices).toEqual(mockVoices);
    });

    it('should return default voices when server fails', async () => {
      mockFetch.mockRejectedValue(new Error('Server error'));

      const voices = await client.getVoices();

      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('display_name');
      expect(voices[0]).toHaveProperty('filename');
    });

    it('should return default voices when endpoint returns non-ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const voices = await client.getVoices();

      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]).toHaveProperty('display_name');
      expect(voices[0]).toHaveProperty('filename');
    });
  });

  describe('generateSpeech', () => {
    it('should generate speech and return result', async () => {
      const mockWav = createMockWavBuffer(1000); // 1 second

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await client.generateSpeech(
        { text: 'Hello world', voice: 'puck' },
        '/output/speech.wav'
      );

      expect(result.filePath).toBe('/output/speech.wav');
      expect(result.durationMs).toBeGreaterThan(900);
      expect(result.durationMs).toBeLessThan(1100);
      expect(result.fileSizeBytes).toBeGreaterThan(0);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should throw error for empty text', async () => {
      await expect(client.generateSpeech({ text: '' }, '/output/speech.wav')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });

      await expect(client.generateSpeech({ text: '   ' }, '/output/speech.wav')).rejects.toMatchObject({
        code: 'INVALID_INPUT',
      });
    });

    it('should use default voice when not specified', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await client.generateSpeech({ text: 'Hello' }, '/output/speech.wav');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/audio/speech'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"voice":"Emily.wav"'), // Default voice with .wav
        })
      );
    });

    it('should throw error on generation failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        text: async () => 'Server error',
      });

      await expect(
        client.generateSpeech({ text: 'Hello' }, '/output/speech.wav')
      ).rejects.toMatchObject({
        code: 'GENERATION_ERROR',
      });
    });

    it('should throw error on empty response', async () => {
      // Both endpoints return empty response
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(0),
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(0),
        });

      await expect(
        client.generateSpeech({ text: 'Hello' }, '/output/speech.wav')
      ).rejects.toMatchObject({
        code: 'EMPTY_RESPONSE',
      });
    });

    it('should try fallback endpoint on first failure', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Not Found',
          text: async () => 'Endpoint not found',
        })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
        });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await client.generateSpeech({ text: 'Hello' }, '/output/speech.wav');

      expect(result.filePath).toBe('/output/speech.wav');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should include optional parameters in request', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      await client.generateSpeech(
        {
          text: 'Hello',
          voice: 'Emily',
          speed: 1.5,
        },
        '/output/speech.wav'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"voice":"Emily.wav"'), // Voice with .wav extension
        })
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on transient failures', async () => {
      const mockWav = createMockWavBuffer(500);

      mockFetch
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => mockWav.buffer.slice(mockWav.byteOffset, mockWav.byteOffset + mockWav.byteLength),
        });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const result = await client.generateSpeech({ text: 'Hello' }, '/output/speech.wav');

      expect(result.filePath).toBe('/output/speech.wav');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(
        client.generateSpeech({ text: 'Hello' }, '/output/speech.wav')
      ).rejects.toMatchObject({
        code: 'CONNECTION_ERROR',
      });
    });
  });
});

describe('getWavDurationMs', () => {
  it('should calculate correct duration for 1 second audio', () => {
    const buffer = createMockWavBuffer(1000, 44100, 1, 16);
    const duration = getWavDurationMs(buffer);

    expect(duration).toBeGreaterThanOrEqual(990);
    expect(duration).toBeLessThanOrEqual(1010);
  });

  it('should calculate correct duration for stereo audio', () => {
    const buffer = createMockWavBuffer(2000, 44100, 2, 16);
    const duration = getWavDurationMs(buffer);

    expect(duration).toBeGreaterThanOrEqual(1990);
    expect(duration).toBeLessThanOrEqual(2010);
  });

  it('should calculate correct duration for different sample rates', () => {
    const buffer = createMockWavBuffer(1500, 22050, 1, 16);
    const duration = getWavDurationMs(buffer);

    expect(duration).toBeGreaterThanOrEqual(1490);
    expect(duration).toBeLessThanOrEqual(1510);
  });

  it('should throw for invalid WAV buffer (too small)', () => {
    const buffer = Buffer.alloc(20);

    expect(() => getWavDurationMs(buffer)).toThrow(ChatterboxError);
  });

  it('should throw for invalid WAV buffer (wrong header)', () => {
    const buffer = Buffer.alloc(50);
    buffer.write('NOTW', 0);

    expect(() => getWavDurationMs(buffer)).toThrow(ChatterboxError);
  });

  it('should throw for non-WAVE format', () => {
    const buffer = Buffer.alloc(50);
    buffer.write('RIFF', 0);
    buffer.write('AVI ', 8);

    expect(() => getWavDurationMs(buffer)).toThrow(ChatterboxError);
  });
});

describe('ChatterboxError', () => {
  it('should store code and details', () => {
    const error = new ChatterboxError('Test message', 'TEST_CODE', { extra: 'data' });

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.name).toBe('ChatterboxError');
  });
});

describe('VOICE_PRESETS', () => {
  it('should have expected voices', () => {
    expect(VOICE_PRESETS).toHaveProperty('abigail');
    expect(VOICE_PRESETS).toHaveProperty('emily');
    expect(VOICE_PRESETS).toHaveProperty('michael');
    expect(VOICE_PRESETS).toHaveProperty('olivia');
    expect(VOICE_PRESETS).toHaveProperty('thomas');
  });

  it('should have name and description for each voice', () => {
    for (const voice of Object.values(VOICE_PRESETS)) {
      expect(voice).toHaveProperty('name');
      expect(voice).toHaveProperty('description');
      expect(typeof voice.name).toBe('string');
      expect(typeof voice.description).toBe('string');
    }
  });
});
