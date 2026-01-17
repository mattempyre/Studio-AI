/**
 * Chatterbox TTS Client
 *
 * Client for interacting with the Chatterbox TTS server for text-to-speech generation.
 * Supports voice selection, WAV output, and duration extraction.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Voice type - can be a voice name or filename
 */
export type ChatterboxVoice = string;

/**
 * Voice info from the server
 */
export interface VoiceInfo {
  display_name: string;
  filename: string;
}

/**
 * Default voice presets (fallback if server doesn't provide voices)
 */
export const VOICE_PRESETS: Record<string, { name: string; description: string }> = {
  abigail: { name: 'Abigail', description: 'Female voice' },
  adrian: { name: 'Adrian', description: 'Male voice' },
  alexander: { name: 'Alexander', description: 'Male voice' },
  alice: { name: 'Alice', description: 'Female voice' },
  emily: { name: 'Emily', description: 'Female voice' },
  michael: { name: 'Michael', description: 'Male voice' },
  olivia: { name: 'Olivia', description: 'Female voice' },
  thomas: { name: 'Thomas', description: 'Male voice' },
};

/**
 * Parameters for speech generation
 */
export interface SpeechGenerationParams {
  /** Text to convert to speech */
  text: string;
  /** Voice to use (preset name or custom voice ID) - ignored if referenceAudioFilename is provided */
  voice?: ChatterboxVoice;
  /** Reference audio filename for voice cloning (uploaded via uploadReferenceAudio) */
  referenceAudioFilename?: string;
  /** Exaggeration level (0.0-1.0, default 0.5) */
  exaggeration?: number;
  /** CFG weight for generation (0.0-1.0, default 0.5) */
  cfgWeight?: number;
  /** Temperature for generation (0.0-1.0, default 0.8) */
  temperature?: number;
  /** Speed factor (0.5-2.0, default 1.0) */
  speed?: number;
}

/**
 * Result of speech generation
 */
export interface SpeechGenerationResult {
  /** Path to the saved audio file */
  filePath: string;
  /** Duration of the audio in milliseconds */
  durationMs: number;
  /** Size of the audio file in bytes */
  fileSizeBytes: number;
}

/**
 * Result of uploading reference audio for voice cloning
 */
export interface UploadReferenceResult {
  /** Filename of the uploaded reference (use this in referenceAudioFilename) */
  filename: string;
  /** Original filename that was uploaded */
  originalFilename: string;
}

/**
 * Error class for Chatterbox-specific errors
 */
export class ChatterboxError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ChatterboxError';
  }
}

/**
 * Configuration options for Chatterbox client
 */
export interface ChatterboxClientOptions {
  /** Base URL for the Chatterbox server */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
}

/**
 * Get default base URL from environment
 */
function getDefaultBaseUrl(): string {
  return process.env.CHATTERBOX_URL || 'http://localhost:8004';
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS = {
  timeout: 60000, // 1 minute
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * WAV file header structure (44 bytes)
 */
interface WavHeader {
  chunkId: string;
  chunkSize: number;
  format: string;
  subchunk1Id: string;
  subchunk1Size: number;
  audioFormat: number;
  numChannels: number;
  sampleRate: number;
  byteRate: number;
  blockAlign: number;
  bitsPerSample: number;
  subchunk2Id: string;
  subchunk2Size: number;
}

/**
 * Parse WAV header from buffer
 */
function parseWavHeader(buffer: Buffer): WavHeader {
  if (buffer.length < 44) {
    throw new ChatterboxError('Invalid WAV file: too small', 'INVALID_WAV');
  }

  const chunkId = buffer.toString('ascii', 0, 4);
  if (chunkId !== 'RIFF') {
    throw new ChatterboxError('Invalid WAV file: missing RIFF header', 'INVALID_WAV');
  }

  const format = buffer.toString('ascii', 8, 12);
  if (format !== 'WAVE') {
    throw new ChatterboxError('Invalid WAV file: missing WAVE format', 'INVALID_WAV');
  }

  return {
    chunkId,
    chunkSize: buffer.readUInt32LE(4),
    format,
    subchunk1Id: buffer.toString('ascii', 12, 16),
    subchunk1Size: buffer.readUInt32LE(16),
    audioFormat: buffer.readUInt16LE(20),
    numChannels: buffer.readUInt16LE(22),
    sampleRate: buffer.readUInt32LE(24),
    byteRate: buffer.readUInt32LE(28),
    blockAlign: buffer.readUInt16LE(32),
    bitsPerSample: buffer.readUInt16LE(34),
    subchunk2Id: buffer.toString('ascii', 36, 40),
    subchunk2Size: buffer.readUInt32LE(40),
  };
}

/**
 * Calculate audio duration from WAV data
 */
export function getWavDurationMs(buffer: Buffer): number {
  const header = parseWavHeader(buffer);

  // Duration = (data size in bytes) / (bytes per second)
  // Bytes per second = sample rate * channels * bits per sample / 8
  const bytesPerSecond = header.sampleRate * header.numChannels * (header.bitsPerSample / 8);
  const durationSeconds = header.subchunk2Size / bytesPerSecond;

  return Math.round(durationSeconds * 1000);
}

/**
 * Chatterbox TTS Client
 *
 * Provides methods to generate speech from text using the Chatterbox TTS server.
 */
export class ChatterboxClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(options?: Partial<ChatterboxClientOptions>) {
    this.baseUrl = (options?.baseUrl || getDefaultBaseUrl()).replace(/\/$/, '');
    this.timeout = options?.timeout ?? DEFAULT_OPTIONS.timeout;
    this.maxRetries = options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
    this.retryDelay = options?.retryDelay ?? DEFAULT_OPTIONS.retryDelay;
  }

  /**
   * Check if the Chatterbox server is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Try multiple potential health endpoints
      const endpoints = ['/health', '/docs', '/v1/audio/speech'];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint}`, {
            method: endpoint === '/v1/audio/speech' ? 'OPTIONS' : 'GET',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok || response.status === 405) {
            // 405 Method Not Allowed is fine - server is responding
            return true;
          }
        } catch {
          // Try next endpoint
        }
      }

      clearTimeout(timeoutId);
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get list of available voices from the server
   */
  async getVoices(): Promise<VoiceInfo[]> {
    try {
      const response = await this.makeRequest('/get_predefined_voices', {
        method: 'GET',
      });

      if (!response.ok) {
        // Return default voices if endpoint not available
        return Object.entries(VOICE_PRESETS).map(([id, info]) => ({
          display_name: info.name,
          filename: `${info.name}.wav`,
        }));
      }

      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data as VoiceInfo[];
      }

      return Object.entries(VOICE_PRESETS).map(([id, info]) => ({
        display_name: info.name,
        filename: `${info.name}.wav`,
      }));
    } catch {
      // Return default voices on error
      return Object.entries(VOICE_PRESETS).map(([id, info]) => ({
        display_name: info.name,
        filename: `${info.name}.wav`,
      }));
    }
  }

  /**
   * Get list of voice names (convenience method)
   */
  async getVoiceNames(): Promise<string[]> {
    const voices = await this.getVoices();
    return voices.map(v => v.display_name);
  }

  /**
   * Get list of uploaded reference audio files (for voice cloning)
   */
  async getUploadedReferenceFiles(): Promise<string[]> {
    try {
      const response = await this.makeRequest('/get_reference_files', {
        method: 'GET',
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        return data as string[];
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Upload reference audio file for voice cloning
   *
   * @param filePath - Path to the audio file (.wav or .mp3)
   * @returns Upload result with filename to use for generation
   */
  async uploadReferenceAudio(filePath: string): Promise<UploadReferenceResult> {
    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.wav' && ext !== '.mp3') {
      throw new ChatterboxError(
        'Reference audio must be .wav or .mp3 format',
        'INVALID_FORMAT',
        { filePath, extension: ext }
      );
    }

    // Read file from disk
    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(filePath);
    } catch (error) {
      throw new ChatterboxError(
        `Failed to read reference audio file: ${(error as Error).message}`,
        'FILE_READ_ERROR',
        { filePath }
      );
    }

    // Create form data
    const originalFilename = path.basename(filePath);
    const formData = new FormData();
    const blob = new Blob([fileBuffer], {
      type: ext === '.wav' ? 'audio/wav' : 'audio/mpeg',
    });
    formData.append('files', blob, originalFilename);

    // Upload to server
    const response = await this.makeRequest('/upload_reference', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new ChatterboxError(
        `Failed to upload reference audio: ${response.statusText}`,
        'UPLOAD_ERROR',
        { status: response.status, error: errorText }
      );
    }

    // The server returns the filename(s) that were saved
    // We return the filename for use in subsequent generations
    return {
      filename: originalFilename,
      originalFilename,
    };
  }

  /**
   * Generate speech from text
   *
   * @param params - Speech generation parameters
   * @param outputPath - Path to save the generated audio file
   * @returns Generation result with file path and duration
   */
  async generateSpeech(
    params: SpeechGenerationParams,
    outputPath: string
  ): Promise<SpeechGenerationResult> {
    if (!params.text || params.text.trim().length === 0) {
      throw new ChatterboxError('Text cannot be empty', 'INVALID_INPUT');
    }

    // Voice cloning only works with /tts endpoint, not OpenAI-compatible
    const isCloneMode = !!params.referenceAudioFilename;

    if (isCloneMode) {
      // Clone mode: use /tts endpoint directly
      return this.tryGenerateSpeech(params, outputPath, '/tts');
    }

    // Predefined voice: try OpenAI-compatible endpoint first, then fallback to /tts
    const endpoints = ['/v1/audio/speech', '/tts'];
    let lastError: Error | null = null;

    for (const endpoint of endpoints) {
      try {
        const result = await this.tryGenerateSpeech(params, outputPath, endpoint);
        return result;
      } catch (error) {
        lastError = error as Error;
        // If it's a validation error, don't try other endpoints
        if (error instanceof ChatterboxError && error.code === 'INVALID_INPUT') {
          throw error;
        }
      }
    }

    throw lastError || new ChatterboxError('Failed to generate speech', 'GENERATION_ERROR');
  }

  /**
   * Try to generate speech using a specific endpoint
   */
  private async tryGenerateSpeech(
    params: SpeechGenerationParams,
    outputPath: string,
    endpoint: string
  ): Promise<SpeechGenerationResult> {
    const isCloneMode = !!params.referenceAudioFilename;

    // Build request body based on endpoint and voice mode
    let body: Record<string, unknown>;

    if (endpoint === '/v1/audio/speech') {
      // OpenAI-compatible endpoint (only supports predefined voices)
      const voiceName = params.voice || 'Emily';
      const voiceFilename = voiceName.endsWith('.wav') ? voiceName : `${voiceName}.wav`;

      body = {
        input: params.text,
        voice: voiceFilename,
        model: 'chatterbox',
        response_format: 'wav',
        speed: params.speed ?? 1.0,
      };
    } else if (isCloneMode) {
      // /tts endpoint with voice cloning
      body = {
        text: params.text,
        voice_mode: 'clone',
        reference_audio_filename: params.referenceAudioFilename,
        output_format: 'wav',
        split_text: true,
        exaggeration: params.exaggeration,
        cfg_weight: params.cfgWeight,
        temperature: params.temperature,
        speed_factor: params.speed,
      };
    } else {
      // /tts endpoint with predefined voice
      const voiceName = params.voice || 'Emily';
      const voiceFilename = voiceName.endsWith('.wav') ? voiceName : `${voiceName}.wav`;

      body = {
        text: params.text,
        voice_mode: 'predefined',
        predefined_voice_id: voiceFilename,
        output_format: 'wav',
        split_text: true,
        exaggeration: params.exaggeration,
        cfg_weight: params.cfgWeight,
        temperature: params.temperature,
        speed_factor: params.speed,
      };
    }

    const response = await this.makeRequest(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/wav',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new ChatterboxError(
        `Speech generation failed: ${response.statusText}`,
        'GENERATION_ERROR',
        { status: response.status, error: errorText }
      );
    }

    // Get audio data
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    if (audioBuffer.length === 0) {
      throw new ChatterboxError('Received empty audio response', 'EMPTY_RESPONSE');
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Save the audio file
    await fs.writeFile(outputPath, audioBuffer);

    // Calculate duration from WAV data
    const durationMs = getWavDurationMs(audioBuffer);

    return {
      filePath: outputPath,
      durationMs,
      fileSizeBytes: audioBuffer.length,
    };
  }

  /**
   * Make an HTTP request with retry logic
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort (timeout)
        if ((error as Error).name === 'AbortError') {
          throw new ChatterboxError(
            'Request timed out',
            'TIMEOUT',
            { url, timeout: this.timeout }
          );
        }

        // Wait before retry
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw new ChatterboxError(
      `Failed to connect to Chatterbox server after ${this.maxRetries} retries`,
      'CONNECTION_ERROR',
      { url, error: lastError?.message }
    );
  }
}

/**
 * Create a new Chatterbox client with default or custom options
 */
export function createChatterboxClient(options?: Partial<ChatterboxClientOptions>): ChatterboxClient {
  return new ChatterboxClient(options);
}
