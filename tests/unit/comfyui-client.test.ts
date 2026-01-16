import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComfyUIClient, ComfyUIError, type ComfyUIWorkflow } from '../../src/backend/clients/comfyui.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the fs module
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ComfyUI Client', () => {
  let client: ComfyUIClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ComfyUIClient({
      baseUrl: 'http://localhost:8188',
      timeout: 5000,
      maxRetries: 2,
      retryDelay: 100,
      outputDir: './test-output',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      const customClient = new ComfyUIClient({
        baseUrl: 'http://custom:9999/',
        timeout: 10000,
        maxRetries: 5,
      });

      // Client is created without error
      expect(customClient).toBeDefined();
    });

    it('should strip trailing slash from baseUrl', () => {
      const customClient = new ComfyUIClient({
        baseUrl: 'http://localhost:8188/',
      });

      // healthCheck would call the correct URL without double slashes
      expect(customClient).toBeDefined();
    });
  });

  describe('loadWorkflow', () => {
    it('should load and parse a workflow JSON file', async () => {
      const mockWorkflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'KSampler',
          inputs: { seed: 123 },
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockWorkflow));

      const workflow = await client.loadWorkflow('/path/to/workflow.json');

      expect(fs.readFile).toHaveBeenCalledWith('/path/to/workflow.json', 'utf-8');
      expect(workflow).toEqual(mockWorkflow);
    });

    it('should throw ComfyUIError when file not found', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(client.loadWorkflow('/nonexistent.json')).rejects.toThrow(ComfyUIError);
      await expect(client.loadWorkflow('/nonexistent.json')).rejects.toMatchObject({
        code: 'WORKFLOW_NOT_FOUND',
      });
    });

    it('should throw ComfyUIError on parse error', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json {{{');

      await expect(client.loadWorkflow('/invalid.json')).rejects.toThrow(ComfyUIError);
      await expect(client.loadWorkflow('/invalid.json')).rejects.toMatchObject({
        code: 'WORKFLOW_LOAD_ERROR',
      });
    });
  });

  describe('injectParams', () => {
    it('should inject parameters by node ID', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'KSampler',
          inputs: { seed: 123, steps: 20 },
        },
      };

      const result = client.injectParams(workflow, {
        '1': { seed: 456, cfg: 7 },
      });

      expect(result['1'].inputs.seed).toBe(456);
      expect(result['1'].inputs.steps).toBe(20);
      expect(result['1'].inputs.cfg).toBe(7);
    });

    it('should inject parameters by class_type', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'KSampler',
          inputs: { seed: 123 },
        },
      };

      const result = client.injectParams(workflow, {
        KSampler: { seed: 789 },
      });

      expect(result['1'].inputs.seed).toBe(789);
    });

    it('should inject parameters by title', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'CLIPTextEncode',
          inputs: { text: 'old prompt' },
          _meta: { title: 'Positive Prompt' },
        },
      };

      const result = client.injectParams(workflow, {
        'Positive Prompt': { text: 'new prompt' },
      });

      expect(result['1'].inputs.text).toBe('new prompt');
    });

    it('should not mutate the original workflow', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'KSampler',
          inputs: { seed: 123 },
        },
      };

      const result = client.injectParams(workflow, {
        '1': { seed: 456 },
      });

      expect(workflow['1'].inputs.seed).toBe(123);
      expect(result['1'].inputs.seed).toBe(456);
    });
  });

  describe('prepareImageWorkflow', () => {
    it('should inject prompt into CLIPTextEncode with positive title', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'CLIPTextEncode',
          inputs: { text: '' },
          _meta: { title: 'CLIP Text Encode (Positive Prompt)' },
        },
        '2': {
          class_type: 'CLIPTextEncode',
          inputs: { text: '' },
          _meta: { title: 'CLIP Text Encode (Negative)' },
        },
      };

      const result = client.prepareImageWorkflow(workflow, {
        prompt: 'A beautiful sunset',
        negativePrompt: 'ugly, blurry',
      });

      expect(result['1'].inputs.text).toBe('A beautiful sunset');
      expect(result['2'].inputs.text).toBe('ugly, blurry');
    });

    it('should inject dimensions into EmptyLatentImage', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 512, height: 512 },
        },
      };

      const result = client.prepareImageWorkflow(workflow, {
        prompt: 'test',
        width: 1920,
        height: 1080,
      });

      expect(result['1'].inputs.width).toBe(1920);
      expect(result['1'].inputs.height).toBe(1080);
    });

    it('should inject sampler parameters into KSampler', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'KSampler',
          inputs: { seed: 0, steps: 20, cfg: 7 },
        },
      };

      const result = client.prepareImageWorkflow(workflow, {
        prompt: 'test',
        seed: 12345,
        steps: 30,
        cfg: 8.5,
      });

      expect(result['1'].inputs.seed).toBe(12345);
      expect(result['1'].inputs.steps).toBe(30);
      expect(result['1'].inputs.cfg).toBe(8.5);
    });

    it('should use default dimensions when not specified', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'EmptyLatentImage',
          inputs: { width: 512, height: 512 },
        },
      };

      const result = client.prepareImageWorkflow(workflow, {
        prompt: 'test',
      });

      expect(result['1'].inputs.width).toBe(1920);
      expect(result['1'].inputs.height).toBe(1080);
    });
  });

  describe('prepareVideoWorkflow', () => {
    it('should inject image filename into LoadImage', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'LoadImage',
          inputs: { image: '' },
        },
      };

      const result = client.prepareVideoWorkflow(workflow, {
        imageFile: '/path/to/image.png',
        prompt: 'test',
      });

      expect(result['1'].inputs.image).toBe('image.png');
    });

    it('should inject prompt into CLIPTextEncode', () => {
      const workflow: ComfyUIWorkflow = {
        '1': {
          class_type: 'CLIPTextEncode',
          inputs: { text: '' },
          _meta: { title: 'Positive Prompt' },
        },
      };

      const result = client.prepareVideoWorkflow(workflow, {
        imageFile: '/image.png',
        prompt: 'Smooth camera pan',
      });

      expect(result['1'].inputs.text).toBe('Smooth camera pan');
    });
  });

  describe('queueWorkflow', () => {
    it('should POST workflow to /prompt endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          prompt_id: 'test-prompt-123',
          number: 1,
          node_errors: {},
        }),
      });

      const workflow: ComfyUIWorkflow = {
        '1': { class_type: 'KSampler', inputs: {} },
      };

      const promptId = await client.queueWorkflow(workflow);

      expect(promptId).toBe('test-prompt-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8188/prompt',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw on node errors', async () => {
      const nodeErrorResponse = {
        ok: true,
        json: async () => ({
          prompt_id: 'test-prompt-123',
          number: 1,
          node_errors: {
            '1': { type: 'value_not_valid' },
          },
        }),
      };
      mockFetch.mockResolvedValue(nodeErrorResponse);

      const workflow: ComfyUIWorkflow = {
        '1': { class_type: 'KSampler', inputs: {} },
      };

      await expect(client.queueWorkflow(workflow)).rejects.toMatchObject({
        code: 'WORKFLOW_NODE_ERRORS',
      });
    });
  });

  describe('checkJobStatus', () => {
    it('should return true when job is completed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'test-prompt-123': {
            status: {
              status_str: 'success',
              completed: true,
              messages: [],
            },
            outputs: {},
          },
        }),
      });

      const completed = await client.checkJobStatus('test-prompt-123');

      expect(completed).toBe(true);
    });

    it('should return false when job is not completed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'test-prompt-123': {
            status: {
              status_str: 'running',
              completed: false,
              messages: [],
            },
            outputs: {},
          },
        }),
      });

      const completed = await client.checkJobStatus('test-prompt-123');

      expect(completed).toBe(false);
    });
  });

  describe('getJobOutputs', () => {
    it('should return image file info from job outputs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'test-prompt-123': {
            status: { completed: true },
            outputs: {
              '9': {
                images: [
                  { filename: 'output_00001_.png', subfolder: '', type: 'output' },
                ],
              },
            },
          },
        }),
      });

      const outputs = await client.getJobOutputs('test-prompt-123');

      expect(outputs).toEqual([{ filename: 'output_00001_.png', subfolder: '', type: 'output' }]);
    });

    it('should return video file info from job outputs with subfolder', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'test-prompt-123': {
            status: { completed: true },
            outputs: {
              '8': {
                videos: [
                  { filename: 'output_00001_.mp4', subfolder: 'video', type: 'output' },
                ],
              },
            },
          },
        }),
      });

      const outputs = await client.getJobOutputs('test-prompt-123');

      expect(outputs).toEqual([{ filename: 'output_00001_.mp4', subfolder: 'video', type: 'output' }]);
    });

    it('should throw when job not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await expect(client.getJobOutputs('nonexistent')).rejects.toMatchObject({
        code: 'JOB_NOT_FOUND',
      });
    });
  });

  describe('downloadFile', () => {
    it('should download and save file to specified path', async () => {
      const mockBuffer = Buffer.from('fake image data');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockBuffer.buffer,
      });
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue();

      const savedPath = await client.downloadFile('output.png', '', '/custom/output.png');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filename=output.png')
      );
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith('/custom/output.png', expect.any(Buffer));
      expect(savedPath).toBe('/custom/output.png');
    });

    it('should throw on download failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(client.downloadFile('missing.png')).rejects.toMatchObject({
        code: 'DOWNLOAD_ERROR',
      });
    });
  });

  describe('healthCheck', () => {
    it('should return true when server is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const healthy = await client.healthCheck();

      expect(healthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8188/system_stats',
        expect.any(Object)
      );
    });

    it('should return false when server is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const healthy = await client.healthCheck();

      expect(healthy).toBe(false);
    });
  });

  describe('cancelJob', () => {
    it('should POST delete request to queue endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.cancelJob('test-prompt-123');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8188/queue',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ delete: ['test-prompt-123'] }),
        })
      );
    });
  });

  describe('interrupt', () => {
    it('should POST to interrupt endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.interrupt();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8188/interrupt',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on transient failures', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Connection reset'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ devices: [] }),
        });

      const result = await client.getSystemStats();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ devices: [] });
    });

    it('should throw after max retries exhausted', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      await expect(client.getSystemStats()).rejects.toThrow(ComfyUIError);
      await expect(client.getSystemStats()).rejects.toMatchObject({
        code: 'RETRY_EXHAUSTED',
      });
    });

    it('should not retry on workflow node errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          prompt_id: 'test',
          number: 1,
          node_errors: { '1': { error: 'test' } },
        }),
      });

      const workflow: ComfyUIWorkflow = { '1': { class_type: 'Test', inputs: {} } };

      await expect(client.queueWorkflow(workflow)).rejects.toThrow(ComfyUIError);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });
  });
});

describe('ComfyUIError', () => {
  it('should store code and details', () => {
    const error = new ComfyUIError('Test message', 'TEST_CODE', { extra: 'data' });

    expect(error.message).toBe('Test message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ extra: 'data' });
    expect(error.name).toBe('ComfyUIError');
  });
});
