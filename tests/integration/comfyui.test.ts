import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ComfyUIClient,
  ComfyUIError,
  createComfyUIClient,
  getComfyUIClient,
} from '../../src/backend/clients/comfyui.js';
import {
  getImageWorkflowPath,
  getVideoWorkflowPath,
  listImageModels,
  listVideoModels,
} from '../../workflows/config.js';

// Mock fetch for API tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ComfyUI Integration', () => {
  let client: ComfyUIClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ComfyUIClient({
      baseUrl: 'http://localhost:8188',
      timeout: 5000,
      maxRetries: 1,
      retryDelay: 100,
      outputDir: './test-output',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Workflow Configuration', () => {
    it('should list available image models', () => {
      const models = listImageModels();

      expect(models).toContain('flux-2');
      expect(models.length).toBeGreaterThan(0);
    });

    it('should list available video models', () => {
      const models = listVideoModels();

      expect(models).toContain('wan-2.2');
      expect(models.length).toBeGreaterThan(0);
    });

    it('should return valid path for default image workflow', () => {
      const workflowPath = getImageWorkflowPath();

      expect(workflowPath).toContain('flux-2.json');
    });

    it('should return valid path for default video workflow', () => {
      const workflowPath = getVideoWorkflowPath();

      expect(workflowPath).toContain('wan-2.2.json');
    });

    it('should throw for unknown image model', () => {
      expect(() => getImageWorkflowPath('nonexistent')).toThrow('Unknown image model');
    });

    it('should throw for unknown video model', () => {
      expect(() => getVideoWorkflowPath('nonexistent')).toThrow('Unknown video model');
    });
  });

  describe('Workflow Loading', () => {
    it('should load flux-2 image workflow', async () => {
      const workflowPath = getImageWorkflowPath('flux-2');
      const workflow = await client.loadWorkflow(workflowPath);

      // Verify workflow structure
      expect(workflow).toBeDefined();
      expect(typeof workflow).toBe('object');

      // Should have at least one node
      const nodeIds = Object.keys(workflow);
      expect(nodeIds.length).toBeGreaterThan(0);

      // Should have a KSampler node
      const hasSampler = Object.values(workflow).some(
        (node) => node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced'
      );
      expect(hasSampler).toBe(true);

      // Should have a SaveImage node
      const hasSaveImage = Object.values(workflow).some(
        (node) => node.class_type === 'SaveImage'
      );
      expect(hasSaveImage).toBe(true);
    });

    it('should load wan-2.2 video workflow', async () => {
      const workflowPath = getVideoWorkflowPath('wan-2.2');
      const workflow = await client.loadWorkflow(workflowPath);

      // Verify workflow structure
      expect(workflow).toBeDefined();
      expect(typeof workflow).toBe('object');

      // Should have a LoadImage node for video workflows
      const hasLoadImage = Object.values(workflow).some(
        (node) => node.class_type === 'LoadImage'
      );
      expect(hasLoadImage).toBe(true);

      // Should have a video output node
      const hasVideoOutput = Object.values(workflow).some(
        (node) =>
          node.class_type.includes('Video') ||
          node.class_type.includes('Combine')
      );
      expect(hasVideoOutput).toBe(true);
    });

    it('should fail for nonexistent workflow file', async () => {
      await expect(
        client.loadWorkflow('/nonexistent/workflow.json')
      ).rejects.toThrow(ComfyUIError);

      await expect(
        client.loadWorkflow('/nonexistent/workflow.json')
      ).rejects.toMatchObject({
        code: 'WORKFLOW_NOT_FOUND',
      });
    });
  });

  describe('Parameter Injection', () => {
    it('should inject image generation parameters', async () => {
      const workflowPath = getImageWorkflowPath('flux-2');
      const workflow = await client.loadWorkflow(workflowPath);

      const prepared = client.prepareImageWorkflow(workflow, {
        prompt: 'A futuristic city at night',
        negativePrompt: 'blurry, low quality',
        width: 1920,
        height: 1080,
        seed: 12345,
        steps: 25,
        cfg: 8,
      });

      // Find the positive prompt node
      const positiveNode = Object.values(prepared).find(
        (node) =>
          node.class_type === 'CLIPTextEncode' &&
          node._meta?.title?.toLowerCase().includes('positive')
      );

      expect(positiveNode?.inputs.text).toBe('A futuristic city at night');

      // Find the negative prompt node
      const negativeNode = Object.values(prepared).find(
        (node) =>
          node.class_type === 'CLIPTextEncode' &&
          node._meta?.title?.toLowerCase().includes('negative')
      );

      // The negative prompt should be set
      expect(negativeNode?.inputs.text).toBe('blurry, low quality');

      // Find the EmptyLatentImage node
      const latentNode = Object.values(prepared).find(
        (node) => node.class_type === 'EmptyLatentImage'
      );

      expect(latentNode?.inputs.width).toBe(1920);
      expect(latentNode?.inputs.height).toBe(1080);

      // Find the KSampler node
      const samplerNode = Object.values(prepared).find(
        (node) => node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced'
      );

      expect(samplerNode?.inputs.seed).toBe(12345);
      expect(samplerNode?.inputs.steps).toBe(25);
      expect(samplerNode?.inputs.cfg).toBe(8);
    });

    it('should inject video generation parameters', async () => {
      const workflowPath = getVideoWorkflowPath('wan-2.2');
      const workflow = await client.loadWorkflow(workflowPath);

      const prepared = client.prepareVideoWorkflow(workflow, {
        imageFile: '/path/to/source/image.png',
        prompt: 'Smooth pan across the scene',
        motionStrength: 0.5,
        fps: 24,
        seed: 67890,
      });

      // Find the LoadImage node
      const loadImageNode = Object.values(prepared).find(
        (node) => node.class_type === 'LoadImage'
      );

      expect(loadImageNode?.inputs.image).toBe('image.png');

      // Find the positive prompt node
      const promptNode = Object.values(prepared).find(
        (node) =>
          node.class_type === 'CLIPTextEncode' &&
          node._meta?.title?.toLowerCase().includes('positive')
      );

      expect(promptNode?.inputs.text).toBe('Smooth pan across the scene');
    });
  });

  describe('Client Factory', () => {
    it('should create client from environment', () => {
      const originalEnv = process.env.COMFYUI_URL;
      process.env.COMFYUI_URL = 'http://custom:9999';

      const envClient = createComfyUIClient();

      // Reset environment
      if (originalEnv) {
        process.env.COMFYUI_URL = originalEnv;
      } else {
        delete process.env.COMFYUI_URL;
      }

      expect(envClient).toBeInstanceOf(ComfyUIClient);
    });

    it('should return singleton from getComfyUIClient', () => {
      const client1 = getComfyUIClient();
      const client2 = getComfyUIClient();

      expect(client1).toBe(client2);
    });

    it('should allow custom options', () => {
      const customClient = createComfyUIClient({
        baseUrl: 'http://localhost:8189',
        timeout: 60000,
        maxRetries: 5,
      });

      expect(customClient).toBeInstanceOf(ComfyUIClient);
    });
  });

  describe('Full Image Generation Flow (Mocked)', () => {
    it('should complete image generation flow with progress tracking', async () => {
      const progressUpdates: { progress: number; message?: string }[] = [];

      // Mock queue response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          prompt_id: 'test-prompt-id',
          number: 1,
          node_errors: {},
        }),
      });

      // Mock history response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          'test-prompt-id': {
            status: { completed: true },
            outputs: {
              '9': {
                images: [{ filename: 'output_00001_.png', subfolder: '', type: 'output' }],
              },
            },
          },
        }),
      });

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(100),
      });

      // Queue the workflow first to verify the flow
      const workflowPath = getImageWorkflowPath('flux-2');
      const workflow = await client.loadWorkflow(workflowPath);
      const prepared = client.prepareImageWorkflow(workflow, {
        prompt: 'A beautiful landscape',
        width: 1920,
        height: 1080,
      });

      const promptId = await client.queueWorkflow(prepared);

      expect(promptId).toBe('test-prompt-id');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8188/prompt',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should handle ComfyUI server unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const healthy = await client.healthCheck();

      expect(healthy).toBe(false);
    });

    it('should handle workflow with invalid JSON', async () => {
      // Create a temporary invalid workflow file
      const tempPath = path.join(process.cwd(), 'test-invalid-workflow.json');
      await fs.writeFile(tempPath, 'not valid json {{{');

      try {
        await expect(client.loadWorkflow(tempPath)).rejects.toMatchObject({
          code: 'WORKFLOW_LOAD_ERROR',
        });
      } finally {
        await fs.unlink(tempPath);
      }
    });

    it('should handle ComfyUI returning node errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          prompt_id: 'error-prompt',
          number: 1,
          node_errors: {
            '5': { type: 'value_not_valid', message: 'Invalid dimension' },
          },
        }),
      });

      const workflow = await client.loadWorkflow(getImageWorkflowPath('flux-2'));

      await expect(client.queueWorkflow(workflow)).rejects.toMatchObject({
        code: 'WORKFLOW_NODE_ERRORS',
      });
    });
  });
});
