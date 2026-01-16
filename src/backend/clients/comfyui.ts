import { WebSocket } from 'ws';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * ComfyUI workflow node structure
 */
interface WorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: {
    title?: string;
  };
}

/**
 * ComfyUI workflow format
 */
export interface ComfyUIWorkflow {
  [nodeId: string]: WorkflowNode;
}

/**
 * Parameters for image generation
 */
export interface ImageGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  characterRefs?: string[];
  styleLora?: string;
}

/**
 * Parameters for video generation
 */
export interface VideoGenerationParams {
  imageFile: string;
  prompt: string;
  cameraMovement?: 'static' | 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'orbit' | 'truck';
  motionStrength?: number;
  duration?: number;
  fps?: number;
  seed?: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: number, message?: string) => void;

/**
 * ComfyUI queue response
 */
interface QueueResponse {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
}

/**
 * ComfyUI history response
 */
interface HistoryResponse {
  [promptId: string]: {
    status: {
      status_str: string;
      completed: boolean;
      messages: Array<[string, { node?: string; output?: Record<string, unknown> }]>;
    };
    outputs: {
      [nodeId: string]: {
        images?: Array<{ filename: string; subfolder: string; type: string }>;
        gifs?: Array<{ filename: string; subfolder: string; type: string }>;
        videos?: Array<{ filename: string; subfolder: string; type: string }>;
      };
    };
  };
}

/**
 * ComfyUI WebSocket message types
 */
interface WSMessage {
  type: string;
  data?: {
    node?: string;
    prompt_id?: string;
    value?: number;
    max?: number;
    status?: {
      exec_info?: {
        queue_remaining: number;
      };
    };
  };
}

/**
 * Error class for ComfyUI-specific errors
 */
export class ComfyUIError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ComfyUIError';
  }
}

/**
 * Configuration options for ComfyUI client
 */
export interface ComfyUIClientOptions {
  baseUrl: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  outputDir?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<Omit<ComfyUIClientOptions, 'baseUrl'>> = {
  timeout: 300000, // 5 minutes
  maxRetries: 3,
  retryDelay: 1000,
  outputDir: './data/generated',
};

/**
 * ComfyUI Client for image and video generation
 *
 * Provides methods to:
 * - Load and inject parameters into workflow JSON files
 * - Queue workflows for execution
 * - Poll for progress via WebSocket
 * - Download generated files
 */
export class ComfyUIClient {
  private baseUrl: string;
  private wsUrl: string;
  private timeout: number;
  private maxRetries: number;
  private retryDelay: number;
  private outputDir: string;
  private clientId: string;

  constructor(options: ComfyUIClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.wsUrl = this.baseUrl.replace(/^http/, 'ws');
    this.timeout = options.timeout ?? DEFAULT_OPTIONS.timeout;
    this.maxRetries = options.maxRetries ?? DEFAULT_OPTIONS.maxRetries;
    this.retryDelay = options.retryDelay ?? DEFAULT_OPTIONS.retryDelay;
    this.outputDir = options.outputDir ?? DEFAULT_OPTIONS.outputDir;
    this.clientId = `studio-ai-${Date.now()}`;
  }

  /**
   * Load a workflow JSON file from disk
   */
  async loadWorkflow(workflowPath: string): Promise<ComfyUIWorkflow> {
    try {
      const content = await fs.readFile(workflowPath, 'utf-8');
      return JSON.parse(content) as ComfyUIWorkflow;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ComfyUIError(
          `Workflow file not found: ${workflowPath}`,
          'WORKFLOW_NOT_FOUND'
        );
      }
      throw new ComfyUIError(
        `Failed to load workflow: ${(error as Error).message}`,
        'WORKFLOW_LOAD_ERROR',
        error
      );
    }
  }

  /**
   * Inject parameters into a workflow
   * Searches for nodes by class_type or title and updates their inputs
   */
  injectParams(
    workflow: ComfyUIWorkflow,
    params: Record<string, Record<string, unknown>>
  ): ComfyUIWorkflow {
    const injected = JSON.parse(JSON.stringify(workflow)) as ComfyUIWorkflow;

    for (const [nodeIdentifier, values] of Object.entries(params)) {
      // Find node by ID, class_type, or title
      let targetNode: WorkflowNode | undefined;
      let targetNodeId: string | undefined;

      for (const [nodeId, node] of Object.entries(injected)) {
        if (
          nodeId === nodeIdentifier ||
          node.class_type === nodeIdentifier ||
          node._meta?.title === nodeIdentifier
        ) {
          targetNode = node;
          targetNodeId = nodeId;
          break;
        }
      }

      if (targetNode && targetNodeId) {
        injected[targetNodeId] = {
          ...targetNode,
          inputs: {
            ...targetNode.inputs,
            ...values,
          },
        };
      }
    }

    return injected;
  }

  /**
   * Prepare a workflow for image generation
   */
  prepareImageWorkflow(
    workflow: ComfyUIWorkflow,
    params: ImageGenerationParams
  ): ComfyUIWorkflow {
    const injections: Record<string, Record<string, unknown>> = {};

    // Find and inject into common node types
    for (const [nodeId, node] of Object.entries(workflow)) {
      // CLIP Text Encode nodes (positive/negative prompts)
      if (node.class_type === 'CLIPTextEncode') {
        const title = node._meta?.title?.toLowerCase() || '';
        // Check for negative first since "negative prompt" contains both keywords
        if (title.includes('negative')) {
          injections[nodeId] = { text: params.negativePrompt || '' };
        } else if (title.includes('positive') || title.includes('prompt')) {
          injections[nodeId] = { text: params.prompt };
        }
      }

      // EmptyLatentImage nodes (dimensions)
      if (node.class_type === 'EmptyLatentImage') {
        injections[nodeId] = {
          width: params.width ?? 1920,
          height: params.height ?? 1080,
        };
      }

      // KSampler nodes (seed, steps, cfg)
      if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
        injections[nodeId] = {
          ...(params.seed !== undefined && { seed: params.seed }),
          ...(params.steps !== undefined && { steps: params.steps }),
          ...(params.cfg !== undefined && { cfg: params.cfg }),
        };
      }
    }

    return this.injectParams(workflow, injections);
  }

  /**
   * Prepare a workflow for video generation
   */
  prepareVideoWorkflow(
    workflow: ComfyUIWorkflow,
    params: VideoGenerationParams
  ): ComfyUIWorkflow {
    const injections: Record<string, Record<string, unknown>> = {};

    for (const [nodeId, node] of Object.entries(workflow)) {
      // LoadImage nodes
      if (node.class_type === 'LoadImage') {
        injections[nodeId] = { image: path.basename(params.imageFile) };
      }

      // Text prompt nodes
      if (node.class_type === 'CLIPTextEncode') {
        const title = node._meta?.title?.toLowerCase() || '';
        if (title.includes('positive') || title.includes('prompt')) {
          injections[nodeId] = { text: params.prompt };
        }
      }

      // Video-specific nodes (WAN, SVD, etc.)
      if (node.class_type.includes('Video') || node.class_type.includes('SVD')) {
        injections[nodeId] = {
          ...(params.motionStrength !== undefined && { motion_bucket_id: Math.round(params.motionStrength * 255) }),
          ...(params.fps !== undefined && { fps: params.fps }),
          ...(params.seed !== undefined && { seed: params.seed }),
        };
      }
    }

    return this.injectParams(workflow, injections);
  }

  /**
   * Queue a workflow for execution
   */
  async queueWorkflow(workflow: ComfyUIWorkflow): Promise<string> {
    const payload = {
      prompt: workflow,
      client_id: this.clientId,
    };

    const response = await this.fetchWithRetry<QueueResponse>(
      `${this.baseUrl}/prompt`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (response.node_errors && Object.keys(response.node_errors).length > 0) {
      throw new ComfyUIError(
        'Workflow contains node errors',
        'WORKFLOW_NODE_ERRORS',
        response.node_errors
      );
    }

    return response.prompt_id;
  }

  /**
   * Poll for job completion using WebSocket
   */
  async pollProgress(
    promptId: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.wsUrl}/ws?clientId=${this.clientId}`);
      let resolved = false;
      let totalNodes = 0;
      let completedNodes = 0;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reject(new ComfyUIError('Timeout waiting for job completion', 'TIMEOUT'));
        }
      }, this.timeout);

      ws.on('open', () => {
        onProgress?.(0, 'Connected to ComfyUI');
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;

          if (message.type === 'execution_start' && message.data?.prompt_id === promptId) {
            onProgress?.(5, 'Execution started');
          }

          if (message.type === 'executing' && message.data?.prompt_id === promptId) {
            if (message.data.node === null) {
              // Execution complete
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                ws.close();
                onProgress?.(100, 'Complete');
                resolve();
              }
            } else {
              completedNodes++;
              if (totalNodes > 0) {
                const progress = Math.min(95, Math.round((completedNodes / totalNodes) * 90) + 5);
                onProgress?.(progress, `Processing node ${completedNodes}/${totalNodes}`);
              }
            }
          }

          if (message.type === 'progress' && message.data?.prompt_id === promptId) {
            const { value, max } = message.data;
            if (value !== undefined && max !== undefined && max > 0) {
              const stepProgress = Math.round((value / max) * 100);
              onProgress?.(Math.min(95, stepProgress), `Step ${value}/${max}`);
            }
          }

          if (message.type === 'execution_cached' && message.data?.prompt_id === promptId) {
            onProgress?.(50, 'Using cached nodes');
          }

          if (message.type === 'status' && message.data?.status?.exec_info) {
            totalNodes = message.data.status.exec_info.queue_remaining + completedNodes;
          }

          if (message.type === 'execution_error') {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              ws.close();
              reject(new ComfyUIError(
                'Execution error in ComfyUI',
                'EXECUTION_ERROR',
                message.data
              ));
            }
          }
        } catch {
          // Ignore parse errors for non-JSON messages
        }
      });

      ws.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new ComfyUIError(
            `WebSocket error: ${error.message}`,
            'WEBSOCKET_ERROR',
            error
          ));
        }
      });

      ws.on('close', () => {
        if (!resolved) {
          // Check if job completed via HTTP
          this.checkJobStatus(promptId)
            .then((completed) => {
              if (completed) {
                resolved = true;
                clearTimeout(timeout);
                resolve();
              } else {
                resolved = true;
                clearTimeout(timeout);
                reject(new ComfyUIError('WebSocket closed unexpectedly', 'WEBSOCKET_CLOSED'));
              }
            })
            .catch(reject);
        }
      });
    });
  }

  /**
   * Check job status via HTTP API
   */
  async checkJobStatus(promptId: string): Promise<boolean> {
    const response = await this.fetchWithRetry<HistoryResponse>(
      `${this.baseUrl}/history/${promptId}`
    );

    const job = response[promptId];
    return job?.status?.completed ?? false;
  }

  /**
   * Get job outputs from history
   */
  async getJobOutputs(promptId: string): Promise<string[]> {
    const response = await this.fetchWithRetry<HistoryResponse>(
      `${this.baseUrl}/history/${promptId}`
    );

    const job = response[promptId];
    if (!job || !job.outputs) {
      throw new ComfyUIError('Job not found or has no outputs', 'JOB_NOT_FOUND');
    }

    const files: string[] = [];
    for (const output of Object.values(job.outputs)) {
      if (output.images) {
        files.push(...output.images.map((img) => img.filename));
      }
      if (output.gifs) {
        files.push(...output.gifs.map((gif) => gif.filename));
      }
      if (output.videos) {
        files.push(...output.videos.map((vid) => vid.filename));
      }
    }

    return files;
  }

  /**
   * Download a file from ComfyUI output
   */
  async downloadFile(
    filename: string,
    subfolder: string = '',
    outputPath?: string
  ): Promise<string> {
    const params = new URLSearchParams({
      filename,
      subfolder,
      type: 'output',
    });

    const response = await fetch(`${this.baseUrl}/view?${params}`);
    if (!response.ok) {
      throw new ComfyUIError(
        `Failed to download file: ${response.statusText}`,
        'DOWNLOAD_ERROR'
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Determine output path
    const finalPath = outputPath || path.join(this.outputDir, filename);

    // Ensure directory exists
    await fs.mkdir(path.dirname(finalPath), { recursive: true });

    // Write file
    await fs.writeFile(finalPath, buffer);

    return finalPath;
  }

  /**
   * Generate an image using the specified workflow
   */
  async generateImage(
    workflowPath: string,
    params: ImageGenerationParams,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    onProgress?.(0, 'Loading workflow');
    const workflow = await this.loadWorkflow(workflowPath);

    onProgress?.(5, 'Preparing workflow');
    const prepared = this.prepareImageWorkflow(workflow, params);

    onProgress?.(10, 'Queueing workflow');
    const promptId = await this.queueWorkflow(prepared);

    await this.pollProgress(promptId, (progress, message) => {
      // Scale progress to 10-90 range during execution
      const scaledProgress = 10 + Math.round(progress * 0.8);
      onProgress?.(scaledProgress, message);
    });

    onProgress?.(92, 'Retrieving outputs');
    const outputs = await this.getJobOutputs(promptId);

    if (outputs.length === 0) {
      throw new ComfyUIError('No output files generated', 'NO_OUTPUT');
    }

    onProgress?.(95, 'Downloading file');
    const savedPath = await this.downloadFile(outputs[0], '', outputPath);

    onProgress?.(100, 'Complete');
    return savedPath;
  }

  /**
   * Generate a video using the specified workflow
   */
  async generateVideo(
    workflowPath: string,
    params: VideoGenerationParams,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    onProgress?.(0, 'Loading workflow');
    const workflow = await this.loadWorkflow(workflowPath);

    onProgress?.(5, 'Preparing workflow');
    const prepared = this.prepareVideoWorkflow(workflow, params);

    onProgress?.(10, 'Queueing workflow');
    const promptId = await this.queueWorkflow(prepared);

    await this.pollProgress(promptId, (progress, message) => {
      // Scale progress to 10-90 range during execution
      const scaledProgress = 10 + Math.round(progress * 0.8);
      onProgress?.(scaledProgress, message);
    });

    onProgress?.(92, 'Retrieving outputs');
    const outputs = await this.getJobOutputs(promptId);

    if (outputs.length === 0) {
      throw new ComfyUIError('No output files generated', 'NO_OUTPUT');
    }

    onProgress?.(95, 'Downloading file');
    const savedPath = await this.downloadFile(outputs[0], '', outputPath);

    onProgress?.(100, 'Complete');
    return savedPath;
  }

  /**
   * Check if ComfyUI server is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get system information from ComfyUI
   */
  async getSystemStats(): Promise<unknown> {
    return this.fetchWithRetry(`${this.baseUrl}/system_stats`);
  }

  /**
   * Get current queue status
   */
  async getQueueStatus(): Promise<{ queue_running: unknown[]; queue_pending: unknown[] }> {
    return this.fetchWithRetry(`${this.baseUrl}/queue`);
  }

  /**
   * Cancel a running or pending job
   */
  async cancelJob(promptId: string): Promise<void> {
    await this.fetchWithRetry(`${this.baseUrl}/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete: [promptId] }),
    });
  }

  /**
   * Interrupt the currently running job
   */
  async interrupt(): Promise<void> {
    await this.fetchWithRetry(`${this.baseUrl}/interrupt`, {
      method: 'POST',
    });
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry<T>(
    url: string,
    options?: RequestInit,
    retries: number = this.maxRetries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(30000), // 30 second timeout per request
        });

        if (!response.ok) {
          const text = await response.text();
          throw new ComfyUIError(
            `HTTP ${response.status}: ${text}`,
            'HTTP_ERROR',
            { status: response.status, body: text }
          );
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof ComfyUIError) {
          if (error.code === 'WORKFLOW_NODE_ERRORS') {
            throw error;
          }
        }

        // Wait before retry
        if (attempt < retries - 1) {
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw new ComfyUIError(
      `Failed after ${retries} retries: ${lastError?.message}`,
      'RETRY_EXHAUSTED',
      lastError
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a ComfyUI client instance from environment configuration
 */
export function createComfyUIClient(options?: Partial<ComfyUIClientOptions>): ComfyUIClient {
  const baseUrl = options?.baseUrl || process.env.COMFYUI_URL || 'http://localhost:8188';

  return new ComfyUIClient({
    baseUrl,
    timeout: options?.timeout,
    maxRetries: options?.maxRetries,
    retryDelay: options?.retryDelay,
    outputDir: options?.outputDir,
  });
}

// Export singleton instance for convenience
let defaultClient: ComfyUIClient | null = null;

export function getComfyUIClient(): ComfyUIClient {
  if (!defaultClient) {
    defaultClient = createComfyUIClient();
  }
  return defaultClient;
}
