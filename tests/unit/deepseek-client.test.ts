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

// =============================================================================
// STORY-006: Long-Form Script Generation Tests
// =============================================================================

describe('Long-Form Script Generation', () => {
  let client: DeepseekClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDeepseekClient();
    process.env = { ...process.env, DEEPSEEK_API_KEY: 'test-api-key' };
    client = new DeepseekClient({
      apiKey: 'test-api-key',
      maxRetries: 2,
      retryDelay: 10,
    });
  });

  describe('generateOutline', () => {
    const validOutlineResponse = {
      title: 'Journey to the Stars: A History of Space Exploration',
      sections: [
        {
          index: 0,
          title: 'The Dream of Flight',
          description: 'Early visionaries and the birth of rocketry',
          targetMinutes: 8,
          keyPoints: ['Tsiolkovsky', 'Goddard', 'V-2 rockets'],
        },
        {
          index: 1,
          title: 'The Space Race Begins',
          description: 'Cold War competition drives rapid advancement',
          targetMinutes: 10,
          keyPoints: ['Sputnik', 'Yuri Gagarin', 'Mercury program'],
        },
        {
          index: 2,
          title: 'One Giant Leap',
          description: 'The Apollo program and lunar landing',
          targetMinutes: 12,
          keyPoints: ['Apollo 11', 'Moon landing', 'Armstrong'],
        },
      ],
    };

    it('should generate outline with correct section count for duration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validOutlineResponse) } }],
        }),
      });

      const outline = await client.generateOutline({
        topic: 'The History of Space Exploration',
        targetDurationMinutes: 30,
      });

      expect(outline.title).toBe('Journey to the Stars: A History of Space Exploration');
      expect(outline.sections).toHaveLength(3);
      expect(outline.totalTargetMinutes).toBe(30);
    });

    it('should include visual style in outline generation prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validOutlineResponse) } }],
        }),
      });

      await client.generateOutline({
        topic: 'Space',
        targetDurationMinutes: 30,
        visualStyle: 'cinematic documentary',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemPrompt = callBody.messages[0].content;

      expect(systemPrompt).toContain('cinematic documentary');
    });

    it('should allocate time proportionally across sections', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validOutlineResponse) } }],
        }),
      });

      const outline = await client.generateOutline({
        topic: 'Space',
        targetDurationMinutes: 30,
      });

      const totalTime = outline.sections.reduce((sum, s) => sum + s.targetMinutes, 0);
      expect(totalTime).toBe(30);
    });

    it('should handle 1-minute scripts (single section)', async () => {
      const singleSectionResponse = {
        title: 'Quick Intro',
        sections: [
          {
            index: 0,
            title: 'Introduction',
            description: 'Brief overview',
            targetMinutes: 1,
            keyPoints: ['Point 1'],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(singleSectionResponse) } }],
        }),
      });

      const outline = await client.generateOutline({
        topic: 'Quick Topic',
        targetDurationMinutes: 1,
      });

      expect(outline.sections).toHaveLength(1);
    });

    it('should handle 180-minute scripts (20+ sections)', async () => {
      const manySectionsResponse = {
        title: 'Epic Documentary',
        sections: Array(23).fill(null).map((_, i) => ({
          index: i,
          title: `Section ${i + 1}`,
          description: `Description for section ${i + 1}`,
          targetMinutes: Math.floor(180 / 23),
          keyPoints: [`Point ${i + 1}`],
        })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(manySectionsResponse) } }],
        }),
      });

      const outline = await client.generateOutline({
        topic: 'Long Documentary',
        targetDurationMinutes: 180,
      });

      expect(outline.sections.length).toBeGreaterThanOrEqual(20);
    });

    it('should parse outline from markdown code block', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify(validOutlineResponse) + '\n```',
              },
            },
          ],
        }),
      });

      const outline = await client.generateOutline({
        topic: 'Space',
        targetDurationMinutes: 30,
      });

      expect(outline.title).toBe('Journey to the Stars: A History of Space Exploration');
    });

    it('should throw PARSE_ERROR on invalid outline structure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ title: 'Test' }) } }],
        }),
      });

      await expect(
        client.generateOutline({ topic: 'Test', targetDurationMinutes: 30 })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });
  });

  describe('generateSectionWithContext', () => {
    const mockOutline = {
      title: 'Test Video',
      totalTargetMinutes: 30,
      sections: [
        { index: 0, title: 'Introduction', description: 'Opening', targetMinutes: 8, keyPoints: ['Hook'] },
        { index: 1, title: 'Main Content', description: 'Body', targetMinutes: 14, keyPoints: ['Detail 1', 'Detail 2'] },
        { index: 2, title: 'Conclusion', description: 'Wrap up', targetMinutes: 8, keyPoints: ['Summary'] },
      ],
    };

    const validSectionResponse = {
      sentences: [
        {
          text: 'Welcome to this exploration of our topic.',
          imagePrompt: 'A stunning opening shot in cinematic style',
          videoPrompt: 'slow zoom out',
        },
        {
          text: 'Today we will discover fascinating insights.',
          imagePrompt: 'Detailed visualization of the concept',
          videoPrompt: 'pan right',
        },
      ],
    };

    it('should include running summary in prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validSectionResponse) } }],
        }),
      });

      await client.generateSectionWithContext({
        outline: mockOutline,
        currentSectionIndex: 1,
        runningSummary: 'We discussed the basics of the topic.',
        previousSectionEnding: 'And that concludes our introduction.',
        coveredTopics: ['basics', 'introduction'],
        visualStyle: 'cinematic',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemPrompt = callBody.messages[0].content;

      expect(systemPrompt).toContain('We discussed the basics of the topic.');
    });

    it('should include previous section ending for continuity', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validSectionResponse) } }],
        }),
      });

      await client.generateSectionWithContext({
        outline: mockOutline,
        currentSectionIndex: 1,
        runningSummary: '',
        previousSectionEnding: 'And that concludes our introduction.',
        coveredTopics: [],
        visualStyle: 'cinematic',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemPrompt = callBody.messages[0].content;

      expect(systemPrompt).toContain('And that concludes our introduction.');
    });

    it('should respect covered topics list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validSectionResponse) } }],
        }),
      });

      await client.generateSectionWithContext({
        outline: mockOutline,
        currentSectionIndex: 1,
        runningSummary: '',
        previousSectionEnding: '',
        coveredTopics: ['topic A', 'topic B', 'topic C'],
        visualStyle: 'cinematic',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemPrompt = callBody.messages[0].content;

      expect(systemPrompt).toContain('topic A');
      expect(systemPrompt).toContain('topic B');
      expect(systemPrompt).toContain('topic C');
    });

    it('should generate correct sentence count for target duration', async () => {
      // 8 minutes * 150 words/min = 1200 words
      // 1200 words / 15 words per sentence = 80 sentences
      const longSectionResponse = {
        sentences: Array(80).fill(null).map((_, i) => ({
          text: `This is sentence number ${i + 1} with about fifteen words in it.`,
          imagePrompt: `Image for sentence ${i + 1}`,
          videoPrompt: 'static',
        })),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(longSectionResponse) } }],
        }),
      });

      const result = await client.generateSectionWithContext({
        outline: mockOutline,
        currentSectionIndex: 0,
        runningSummary: '',
        previousSectionEnding: '',
        coveredTopics: [],
        visualStyle: 'cinematic',
      });

      expect(result.sentenceCount).toBe(80);
    });

    it('should throw error for invalid section index', async () => {
      await expect(
        client.generateSectionWithContext({
          outline: mockOutline,
          currentSectionIndex: 99,
          runningSummary: '',
          previousSectionEnding: '',
          coveredTopics: [],
          visualStyle: 'cinematic',
        })
      ).rejects.toMatchObject({
        code: 'INVALID_RESPONSE',
      });
    });

    it('should indicate first section in prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validSectionResponse) } }],
        }),
      });

      await client.generateSectionWithContext({
        outline: mockOutline,
        currentSectionIndex: 0,
        runningSummary: '',
        previousSectionEnding: '',
        coveredTopics: [],
        visualStyle: 'cinematic',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userPrompt = callBody.messages[1].content;

      expect(userPrompt).toContain('FIRST section');
      expect(userPrompt).toContain('hook');
    });

    it('should indicate last section in prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validSectionResponse) } }],
        }),
      });

      await client.generateSectionWithContext({
        outline: mockOutline,
        currentSectionIndex: 2, // Last section
        runningSummary: '',
        previousSectionEnding: '',
        coveredTopics: [],
        visualStyle: 'cinematic',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userPrompt = callBody.messages[1].content;

      expect(userPrompt).toContain('FINAL section');
      expect(userPrompt).toContain('conclusion');
    });
  });

  describe('compressSummary', () => {
    it('should keep summary under max word limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'The video covers space exploration history, starting with early pioneers.',
              },
            },
          ],
        }),
      });

      const mockSection = {
        sectionIndex: 0,
        title: 'Test Section',
        sentences: [{ text: 'New content here.', imagePrompt: '', videoPrompt: '' }],
        sentenceCount: 1,
        wordCount: 3,
        durationMinutes: 0.1,
      };

      const summary = await client.compressSummary('Previous summary', mockSection, 300);

      expect(summary.split(/\s+/).length).toBeLessThanOrEqual(300);
    });

    it('should preserve key facts and entities', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'The video discusses Neil Armstrong and the 1969 Apollo 11 mission.',
              },
            },
          ],
        }),
      });

      const mockSection = {
        sectionIndex: 0,
        title: 'Moon Landing',
        sentences: [
          { text: 'Neil Armstrong was the first person to walk on the moon in 1969.', imagePrompt: '', videoPrompt: '' },
        ],
        sentenceCount: 1,
        wordCount: 12,
        durationMinutes: 0.1,
      };

      const summary = await client.compressSummary('', mockSection, 300);

      expect(summary).toContain('Armstrong');
      expect(summary).toContain('1969');
    });

    it('should combine previous summary with new content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'Combined: Early rockets led to space race. New content added.',
              },
            },
          ],
        }),
      });

      const mockSection = {
        sectionIndex: 1,
        title: 'New Section',
        sentences: [{ text: 'New information here.', imagePrompt: '', videoPrompt: '' }],
        sentenceCount: 1,
        wordCount: 3,
        durationMinutes: 0.1,
      };

      const summary = await client.compressSummary('Early rockets led to the space race.', mockSection, 300);

      expect(summary.length).toBeGreaterThan(0);
    });
  });

  describe('extractCoveredTopics', () => {
    it('should extract key topics as JSON array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '["early rocketry", "Goddard experiments", "V-2 development"]',
              },
            },
          ],
        }),
      });

      const mockSection = {
        sectionIndex: 0,
        title: 'Test',
        sentences: [{ text: 'Content about rockets.', imagePrompt: '', videoPrompt: '' }],
        sentenceCount: 1,
        wordCount: 3,
        durationMinutes: 0.1,
      };

      const topics = await client.extractCoveredTopics(mockSection);

      expect(topics).toContain('early rocketry');
      expect(topics).toContain('Goddard experiments');
      expect(topics).toContain('V-2 development');
    });

    it('should handle non-JSON response gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'The topics covered are "space exploration", "astronauts", and "missions".',
              },
            },
          ],
        }),
      });

      const mockSection = {
        sectionIndex: 0,
        title: 'Test',
        sentences: [{ text: 'Content.', imagePrompt: '', videoPrompt: '' }],
        sentenceCount: 1,
        wordCount: 1,
        durationMinutes: 0.1,
      };

      const topics = await client.extractCoveredTopics(mockSection);

      // Should extract quoted strings
      expect(topics.length).toBeGreaterThan(0);
    });

    it('should return empty array on complete failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'No topics found' } }],
        }),
      });

      const mockSection = {
        sectionIndex: 0,
        title: 'Test',
        sentences: [],
        sentenceCount: 0,
        wordCount: 0,
        durationMinutes: 0,
      };

      const topics = await client.extractCoveredTopics(mockSection);

      expect(Array.isArray(topics)).toBe(true);
    });
  });

  describe('expandSection', () => {
    const validExpansionResponse = {
      sentences: [
        {
          text: 'This is an expanded sentence about the topic.',
          imagePrompt: 'A visual representation of the concept',
          videoPrompt: 'Slow zoom into the scene',
        },
        {
          text: 'Another sentence providing more detail.',
          imagePrompt: 'Detailed close-up of relevant subject',
          videoPrompt: 'Pan across the scene',
        },
      ],
    };

    it('should expand section in quick mode', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validExpansionResponse),
              },
            },
          ],
        }),
      });

      const result = await client.expandSection({
        sectionTitle: 'Introduction to AI',
        existingSentences: ['AI is transforming technology.'],
        projectTopic: 'Artificial Intelligence',
        visualStyle: 'cinematic',
        mode: 'quick',
        sentenceCount: 2,
      });

      expect(result.sentences).toHaveLength(2);
      expect(result.sentences[0].text).toBe('This is an expanded sentence about the topic.');
      expect(result.sentences[0].imagePrompt).toBeDefined();
      expect(result.sentences[0].videoPrompt).toBeDefined();
    });

    it('should expand section in guided mode with user prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validExpansionResponse),
              },
            },
          ],
        }),
      });

      await client.expandSection({
        sectionTitle: 'Machine Learning Basics',
        existingSentences: ['Machine learning enables computers to learn.'],
        projectTopic: 'Machine Learning',
        visualStyle: 'educational',
        mode: 'guided',
        userPrompt: 'Add more detail about neural networks',
        sentenceCount: 2,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = callBody.messages[1].content;

      expect(userMessage).toContain('neural networks');
    });

    it('should respect insertAfterIndex parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validExpansionResponse),
              },
            },
          ],
        }),
      });

      await client.expandSection({
        sectionTitle: 'Test Section',
        existingSentences: ['First sentence.', 'Second sentence.', 'Third sentence.'],
        projectTopic: 'Test',
        visualStyle: 'cinematic',
        mode: 'quick',
        sentenceCount: 1,
        insertAfterIndex: 1,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = callBody.messages[1].content;

      // Should mention the context around insert position
      expect(userMessage).toContain('Second sentence');
    });

    it('should include visual style in system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validExpansionResponse),
              },
            },
          ],
        }),
      });

      await client.expandSection({
        sectionTitle: 'Test',
        existingSentences: [],
        projectTopic: 'Test',
        visualStyle: 'anime',
        mode: 'quick',
        sentenceCount: 1,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemMessage = callBody.messages[0].content;

      expect(systemMessage).toContain('anime');
    });

    it('should throw error on invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'This is not valid JSON',
              },
            },
          ],
        }),
      });

      await expect(
        client.expandSection({
          sectionTitle: 'Test',
          existingSentences: [],
          projectTopic: 'Test',
          visualStyle: 'cinematic',
          mode: 'quick',
          sentenceCount: 1,
        })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('should throw error when sentences array is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify({ notSentences: [] }),
              },
            },
          ],
        }),
      });

      await expect(
        client.expandSection({
          sectionTitle: 'Test',
          existingSentences: [],
          projectTopic: 'Test',
          visualStyle: 'cinematic',
          mode: 'quick',
          sentenceCount: 1,
        })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('should handle empty existing sentences', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validExpansionResponse),
              },
            },
          ],
        }),
      });

      const result = await client.expandSection({
        sectionTitle: 'New Section',
        existingSentences: [],
        projectTopic: 'Test Topic',
        visualStyle: 'cinematic',
        mode: 'quick',
        sentenceCount: 2,
      });

      expect(result.sentences).toHaveLength(2);
    });

    it('should request the correct number of sentences', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validExpansionResponse),
              },
            },
          ],
        }),
      });

      await client.expandSection({
        sectionTitle: 'Test',
        existingSentences: [],
        projectTopic: 'Test',
        visualStyle: 'cinematic',
        mode: 'quick',
        sentenceCount: 5,
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userMessage = callBody.messages[1].content;

      expect(userMessage).toContain('5');
    });
  });
});

// =============================================================================
// STORY 4.1: Image Prompt Generation Tests
// =============================================================================

describe('Image Prompt Generation', () => {
  let client: DeepseekClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDeepseekClient();
    process.env = { ...process.env, DEEPSEEK_API_KEY: 'test-api-key' };
    client = new DeepseekClient({
      apiKey: 'test-api-key',
      maxRetries: 2,
      retryDelay: 10,
    });
  });

  describe('generateImagePrompts', () => {
    const validPromptsResponse = {
      prompts: [
        {
          index: 0,
          imagePrompt: 'A wide shot of a futuristic cityscape at sunset, with golden light reflecting off towering glass buildings. The composition uses leading lines from a bridge in the foreground, creating depth and drawing the eye to the skyline. Mood is hopeful and awe-inspiring.',
        },
        {
          index: 1,
          imagePrompt: 'Close-up portrait of a scientist in a modern laboratory, warm lighting from monitors illuminating their face. The subject appears contemplative, surrounded by holographic displays showing data visualizations. Clean, minimalist composition.',
        },
      ],
    };

    const testSentences = [
      {
        id: 'sent-1',
        index: 0,
        text: 'In the near future, our cities will transform beyond recognition.',
        sectionTitle: 'Introduction',
      },
      {
        id: 'sent-2',
        index: 1,
        text: 'Scientists are working tirelessly to make these visions a reality.',
        sectionTitle: 'The Research',
      },
    ];

    it('should generate image prompts for a batch of sentences', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(validPromptsResponse),
              },
            },
          ],
        }),
      });

      const result = await client.generateImagePrompts({
        sentences: testSentences,
      });

      expect(result.prompts).toHaveLength(2);
      expect(result.prompts[0].index).toBe(0);
      expect(result.prompts[0].imagePrompt.length).toBeGreaterThan(50);
      expect(result.prompts[1].index).toBe(1);
    });

    it('should include style context in system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validPromptsResponse) } }],
        }),
      });

      await client.generateImagePrompts({
        sentences: testSentences,
        styleContext: {
          name: 'Cyberpunk Neon',
          promptPrefix: 'Cyberpunk aesthetic, neon lights, rain-slicked streets, high contrast',
        },
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemPrompt = callBody.messages[0].content;

      expect(systemPrompt).toContain('Cyberpunk aesthetic');
      expect(systemPrompt).toContain('neon lights');
      expect(systemPrompt).toContain('Cyberpunk Neon');
    });

    it('should include cast character descriptions in system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validPromptsResponse) } }],
        }),
      });

      await client.generateImagePrompts({
        sentences: testSentences,
        castCharacters: [
          { name: 'Dr. Sarah Chen', description: 'A brilliant scientist with silver hair and kind eyes, wearing a white lab coat' },
          { name: 'Alex', description: 'Young tech entrepreneur, dark skin, shaved head, casual but stylish attire' },
        ],
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const systemPrompt = callBody.messages[0].content;

      expect(systemPrompt).toContain('Dr. Sarah Chen');
      expect(systemPrompt).toContain('silver hair');
      expect(systemPrompt).toContain('Alex');
      expect(systemPrompt).toContain('shaved head');
    });

    it('should return empty array for empty sentences input', async () => {
      const result = await client.generateImagePrompts({
        sentences: [],
      });

      expect(result.prompts).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should parse prompts from markdown code block', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '```json\n' + JSON.stringify(validPromptsResponse) + '\n```',
              },
            },
          ],
        }),
      });

      const result = await client.generateImagePrompts({
        sentences: testSentences,
      });

      expect(result.prompts).toHaveLength(2);
    });

    it('should throw PARSE_ERROR on invalid JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This is not valid JSON at all' } }],
        }),
      });

      await expect(
        client.generateImagePrompts({ sentences: testSentences })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('should throw PARSE_ERROR when prompts array is missing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ notPrompts: [] }) } }],
        }),
      });

      await expect(
        client.generateImagePrompts({ sentences: testSentences })
      ).rejects.toMatchObject({
        code: 'PARSE_ERROR',
      });
    });

    it('should warn when fewer prompts returned than expected', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  prompts: [{ index: 0, imagePrompt: 'Only one prompt returned' }],
                }),
              },
            },
          ],
        }),
      });

      await client.generateImagePrompts({ sentences: testSentences });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('expected 2 prompts, got 1')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should include section title context in user prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(validPromptsResponse) } }],
        }),
      });

      await client.generateImagePrompts({ sentences: testSentences });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const userPrompt = callBody.messages[1].content;

      expect(userPrompt).toContain('Introduction');
      expect(userPrompt).toContain('The Research');
    });
  });
});
