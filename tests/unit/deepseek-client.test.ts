import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DeepseekClient,
  DeepseekError,
  createDeepseekClient,
  getDeepseekClient,
  resetDeepseekClient,
} from '../../src/backend/clients/deepseek.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
const originalEnv = process.env;

describe('Deepseek Client', () => {
  let client: DeepseekClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDeepseekClient();
    process.env = { ...originalEnv, DEEPSEEK_API_KEY: 'test-api-key' };
    client = new DeepseekClient({
      apiKey: 'test-api-key',
      maxRetries: 2,
      retryDelay: 10, // Short delay for tests
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      const customClient = new DeepseekClient({
        apiKey: 'custom-key',
        baseUrl: 'https://custom.api.com',
        model: 'deepseek-reasoner',
        maxRetries: 5,
      });

      expect(customClient).toBeDefined();
    });

    it('should use environment variable for API key', () => {
      process.env.DEEPSEEK_API_KEY = 'env-api-key';
      const envClient = new DeepseekClient();
      expect(envClient).toBeDefined();
    });

    it('should throw DeepseekError when API key is missing', () => {
      delete process.env.DEEPSEEK_API_KEY;

      expect(() => new DeepseekClient()).toThrow(DeepseekError);
      expect(() => new DeepseekClient()).toThrow(/API key is required/);
    });

    it('should have correct error code when API key is missing', () => {
      delete process.env.DEEPSEEK_API_KEY;

      try {
        new DeepseekClient();
      } catch (error) {
        expect(error).toBeInstanceOf(DeepseekError);
        expect((error as DeepseekError).code).toBe('API_KEY_MISSING');
      }
    });
  });

  describe('chat', () => {
    it('should send chat completion request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1234567890,
          model: 'deepseek-chat',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello!' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      });

      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response).toBe('Hello!');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should throw on empty choices', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'chatcmpl-123',
          choices: [],
        }),
      });

      await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      await expect(client.chat([{ role: 'user', content: 'Hello' }])).rejects.toMatchObject({
        code: 'API_ERROR',
      });
    });
  });

  describe('generateScript', () => {
    const validScriptResponse = {
      title: 'Introduction to AI',
      sections: [
        {
          title: 'What is AI?',
          sentences: [
            {
              text: 'Artificial Intelligence is transforming our world.',
              imagePrompt: 'A futuristic city with robots and AI interfaces',
              videoPrompt: 'slow zoom out',
            },
            {
              text: 'It can learn from data and make intelligent decisions.',
              imagePrompt: 'Neural network visualization with glowing nodes',
              videoPrompt: 'pan right',
            },
          ],
        },
        {
          title: 'Applications of AI',
          sentences: [
            {
              text: 'AI is used in healthcare to diagnose diseases.',
              imagePrompt: 'Doctor reviewing AI-assisted medical scan',
              videoPrompt: 'static shot',
            },
          ],
        },
      ],
    };

    it('should generate a script with structured output', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validScriptResponse),
              },
            },
          ],
        }),
      });

      const script = await client.generateScript({
        topic: 'Introduction to AI',
        targetDurationMinutes: 2,
      });

      expect(script.title).toBe('Introduction to AI');
      expect(script.sections).toHaveLength(2);
      expect(script.sections[0].title).toBe('What is AI?');
      expect(script.sections[0].sentences).toHaveLength(2);
      expect(script.totalSentences).toBe(3);
      expect(typeof script.estimatedDurationMinutes).toBe('number');
    });

    it('should include visual style in prompts when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validScriptResponse),
              },
            },
          ],
        }),
      });

      await client.generateScript({
        topic: 'AI',
        targetDurationMinutes: 1,
        visualStyle: 'cyberpunk anime style',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemPrompt = callBody.messages[0].content;

      expect(systemPrompt).toContain('cyberpunk anime style');
    });

    it('should include search grounding instruction when enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validScriptResponse),
              },
            },
          ],
        }),
      });

      await client.generateScript({
        topic: 'AI',
        targetDurationMinutes: 1,
        useSearchGrounding: true,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userPrompt = callBody.messages[1].content;

      expect(userPrompt).toContain('accurate');
      expect(userPrompt).toContain('factual');
    });

    it('should calculate correct duration based on word count', async () => {
      const longScript = {
        title: 'Test',
        sections: [
          {
            title: 'Section 1',
            sentences: [
              { text: 'One two three four five six seven eight nine ten.' }, // 10 words
              { text: 'One two three four five six seven eight nine ten.' }, // 10 words
            ],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(longScript) } }],
        }),
      });

      const script = await client.generateScript({
        topic: 'Test',
        targetDurationMinutes: 1,
      });

      // 20 words / 150 wpm = 0.13 minutes
      expect(script.estimatedDurationMinutes).toBeCloseTo(0.1, 1);
    });

    it('should include additional instructions when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validScriptResponse),
              },
            },
          ],
        }),
      });

      await client.generateScript({
        topic: 'AI',
        targetDurationMinutes: 1,
        additionalInstructions: 'Focus on ethical considerations',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userPrompt = callBody.messages[1].content;

      expect(userPrompt).toContain('Focus on ethical considerations');
    });
  });

  describe('parseScriptResponse', () => {
    it('should parse JSON from markdown code block', async () => {
      const scriptJson = {
        title: 'Test',
        sections: [
          { title: 'Intro', sentences: [{ text: 'Hello world.' }] },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify(scriptJson) + '\n```',
              },
            },
          ],
        }),
      });

      const script = await client.generateScript({
        topic: 'Test',
        targetDurationMinutes: 1,
      });

      expect(script.title).toBe('Test');
    });

    it('should parse JSON with surrounding text', async () => {
      const scriptJson = {
        title: 'Test',
        sections: [
          { title: 'Intro', sentences: [{ text: 'Hello.' }] },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Here is your script:\n' + JSON.stringify(scriptJson) + '\n\nEnjoy!',
              },
            },
          ],
        }),
      });

      const script = await client.generateScript({
        topic: 'Test',
        targetDurationMinutes: 1,
      });

      expect(script.title).toBe('Test');
    });

    it('should throw PARSE_ERROR on invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'This is not valid JSON at all',
              },
            },
          ],
        }),
      });

      await expect(
        client.generateScript({ topic: 'Test', targetDurationMinutes: 1 })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('should throw PARSE_ERROR when missing required fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({ title: 'Test' }), // Missing sections
              },
            },
          ],
        }),
      });

      await expect(
        client.generateScript({ topic: 'Test', targetDurationMinutes: 1 })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('should throw PARSE_ERROR on invalid section structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Test',
                  sections: [{ title: 'Intro' }], // Missing sentences
                }),
              },
            },
          ],
        }),
      });

      await expect(
        client.generateScript({ topic: 'Test', targetDurationMinutes: 1 })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('should throw PARSE_ERROR on invalid sentence structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: 'Test',
                  sections: [
                    {
                      title: 'Intro',
                      sentences: [{ imagePrompt: 'no text field' }],
                    },
                  ],
                }),
              },
            },
          ],
        }),
      });

      await expect(
        client.generateScript({ topic: 'Test', targetDurationMinutes: 1 })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hi!' } }],
        }),
      });

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
    });

    it('should return false when API is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const healthy = await client.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit (429)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['retry-after', '1']]),
          text: async () => 'Rate limited',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success!' } }],
          }),
        });

      // Mock headers.get for retry-after
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          headers: { get: () => '1' },
          text: async () => 'Rate limited',
        })
      ).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Success!' } }],
        }),
      });

      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response).toBe('Success!');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on network error', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Success!' } }],
          }),
        });

      const response = await client.chat([{ role: 'user', content: 'Hello' }]);

      expect(response).toBe('Success!');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw RATE_LIMIT after max retries', async () => {
      // Create a fresh client with maxRetries = 2
      const testClient = new DeepseekClient({
        apiKey: 'test-key',
        maxRetries: 2,
        retryDelay: 10,
      });

      mockFetch.mockImplementation(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          headers: { get: () => '1' },
          text: async () => 'Rate limited',
        })
      );

      await expect(testClient.chat([{ role: 'user', content: 'Hello' }])).rejects.toMatchObject({
        code: 'RATE_LIMIT',
      });
    });

    it('should throw NETWORK_ERROR after max retries on network failures', async () => {
      const testClient = new DeepseekClient({
        apiKey: 'test-key',
        maxRetries: 2,
        retryDelay: 10,
      });

      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(testClient.chat([{ role: 'user', content: 'Hello' }])).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });

    it('should throw TIMEOUT on timeout error', async () => {
      const testClient = new DeepseekClient({
        apiKey: 'test-key',
        maxRetries: 1,
        retryDelay: 10,
      });

      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeoutError);

      await expect(testClient.chat([{ role: 'user', content: 'Hello' }])).rejects.toMatchObject({
        code: 'TIMEOUT',
      });
    });
  });

  describe('factory functions', () => {
    it('createDeepseekClient should create new instance', () => {
      const client1 = createDeepseekClient({ apiKey: 'key1' });
      const client2 = createDeepseekClient({ apiKey: 'key2' });

      expect(client1).not.toBe(client2);
    });

    it('getDeepseekClient should return singleton', () => {
      const client1 = getDeepseekClient();
      const client2 = getDeepseekClient();

      expect(client1).toBe(client2);
    });

    it('resetDeepseekClient should clear singleton', () => {
      const client1 = getDeepseekClient();
      resetDeepseekClient();
      const client2 = getDeepseekClient();

      expect(client1).not.toBe(client2);
    });
  });
});

describe('DeepseekError', () => {
  it('should store code and details', () => {
    const error = new DeepseekError('Test message', 'API_ERROR', { status: 500 });

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('API_ERROR');
    expect(error.details).toEqual({ status: 500 });
    expect(error.name).toBe('DeepseekError');
  });

  it('should work without details', () => {
    const error = new DeepseekError('Test', 'PARSE_ERROR');

    expect(error.code).toBe('PARSE_ERROR');
    expect(error.details).toBeUndefined();
  });
});
