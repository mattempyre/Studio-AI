/**
 * Whisper Transcription Client
 *
 * Client for interacting with the Whisper transcription service for audio-to-text
 * with word-level timestamps. Used for sentence alignment in batch audio generation.
 */

/**
 * Word-level timing from transcription
 */
export interface WordTiming {
  word: string;
  start: number; // seconds
  end: number; // seconds
  probability: number;
}

/**
 * Segment-level timing from transcription
 */
export interface SegmentTiming {
  id: number;
  text: string;
  start: number; // seconds
  end: number; // seconds
  words: WordTiming[];
}

/**
 * Full transcription result
 */
export interface TranscriptionResult {
  text: string;
  language: string;
  duration: number; // seconds
  segments: SegmentTiming[];
  words: WordTiming[]; // Flattened word list for easy sentence alignment
}

/**
 * Error class for Whisper-specific errors
 */
export class WhisperError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'WhisperError';
  }
}

/**
 * Configuration options for Whisper client
 */
export interface WhisperClientOptions {
  /** Base URL for the Whisper service */
  baseUrl: string;
  /** Request timeout in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number;
  /** Maximum retry attempts (default: 2) */
  maxRetries?: number;
  /** Delay between retries in milliseconds (default: 2000) */
  retryDelay?: number;
}

/**
 * Get default base URL from environment
 */
function getDefaultBaseUrl(): string {
  return process.env.WHISPER_URL || 'http://localhost:8005';
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS = {
  timeout: 120000, // 2 minutes (transcription can take time)
  maxRetries: 2,
  retryDelay: 2000,
};

/**
 * Whisper Transcription Client
 *
 * Provides methods to transcribe audio with word-level timestamps.
 */
export class WhisperClient {
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;

  constructor(options?: Partial<WhisperClientOptions>) {
    this.baseUrl = (options?.baseUrl || getDefaultBaseUrl()).replace(/\/$/, '');
    this.timeout = options?.timeout ?? DEFAULT_OPTIONS.timeout;
    this.maxRetries = options?.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
    this.retryDelay = options?.retryDelay ?? DEFAULT_OPTIONS.retryDelay;
  }

  /**
   * Check if the Whisper service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get service info
   */
  async getInfo(): Promise<{ model: string; device: string; computeType: string } | null> {
    try {
      const response = await this.makeRequest('/health', { method: 'GET' });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        model: data.model || 'unknown',
        device: data.device || 'unknown',
        computeType: data.compute_type || 'unknown',
      };
    } catch {
      return null;
    }
  }

  /**
   * Transcribe audio file with word-level timestamps
   *
   * @param audioPath - Path to the audio file (must be accessible to the Whisper service)
   * @param language - Language code (default: 'en')
   * @returns Transcription result with word-level timestamps
   */
  async transcribe(audioPath: string, language = 'en'): Promise<TranscriptionResult> {
    const response = await this.makeRequest('/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_path: audioPath,
        language,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new WhisperError(
        `Transcription failed: ${response.statusText}`,
        'TRANSCRIPTION_ERROR',
        { status: response.status, error: errorText }
      );
    }

    const data = await response.json();

    return {
      text: data.text,
      language: data.language,
      duration: data.duration,
      segments: data.segments,
      words: data.words,
    };
  }

  /**
   * Make an HTTP request with retry logic
   */
  private async makeRequest(endpoint: string, options: RequestInit): Promise<Response> {
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
          throw new WhisperError('Request timed out', 'TIMEOUT', {
            url,
            timeout: this.timeout,
          });
        }

        // Wait before retry
        if (attempt < this.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }

    throw new WhisperError(
      `Failed to connect to Whisper service after ${this.maxRetries} retries`,
      'CONNECTION_ERROR',
      { url, error: lastError?.message }
    );
  }
}

/**
 * Create a new Whisper client with default or custom options
 */
export function createWhisperClient(options?: Partial<WhisperClientOptions>): WhisperClient {
  return new WhisperClient(options);
}
