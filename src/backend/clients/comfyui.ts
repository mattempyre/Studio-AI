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
 * Parameters for image-to-image generation with character reference
 */
export interface ImageToImageParams {
  referenceImage: string;      // Path to character reference image (local filesystem)
  prompt: string;              // Scene description
  negativePrompt?: string;
  seed?: number;
  steps?: number;              // Default: 20
  cfg?: number;                // Default: 5
}

/**
 * Parameters for inpainting (image editing with mask)
 * Uses Flux2 Klein 9B Inpainting workflow
 */
export interface InpaintParams {
  sourceImage: string;         // Path to source image to edit
  maskImage: string;           // Path to mask PNG (red channel = edit area)
  prompt: string;              // Description of desired changes
  negativePrompt?: string;
  seed?: number;
  steps?: number;              // Default: 4 (LanPaint KSampler)
}

/**
 * Parameters for video generation
 */
export interface VideoGenerationParams {
  imageFile: string;
  prompt: string;
  negativePrompt?: string;
  cameraMovement?: 'static' | 'pan_left' | 'pan_right' | 'zoom_in' | 'zoom_out' | 'orbit' | 'truck';
  motionStrength?: number;
  width?: number;
  height?: number;
  frames?: number;
  fps?: number;
  seed?: number;
  filenamePrefix?: string; // Output filename prefix for batch processing
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: number, message?: string) => void;

/**
 * Output file info with subfolder
 */
export interface OutputFile {
  filename: string;
  subfolder: string;
  type: string;
}

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
 * Get default output directory from environment or fallback
 */
function getDefaultOutputDir(): string {
  return process.env.OUTPUT_DIR || './data/projects';
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Omit<Required<Omit<ComfyUIClientOptions, 'baseUrl'>>, 'outputDir'> & { outputDir: null } = {
  timeout: 300000, // 5 minutes
  maxRetries: 3,
  retryDelay: 1000,
  outputDir: null, // Use getDefaultOutputDir() at runtime
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
    this.outputDir = options.outputDir ?? getDefaultOutputDir();
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

      // PrimitiveStringMultiline nodes (prompt input for some workflows like z-image turbo)
      if (node.class_type === 'PrimitiveStringMultiline') {
        const title = node._meta?.title?.toLowerCase() || '';
        if (title.includes('prompt')) {
          injections[nodeId] = { value: params.prompt };
        }
      }

      // EmptyLatentImage nodes (dimensions)
      if (node.class_type === 'EmptyLatentImage') {
        injections[nodeId] = {
          width: params.width ?? 1920,
          height: params.height ?? 1080,
        };
      }

      // EmptySD3LatentImage nodes (dimensions for SD3/turbo models)
      if (node.class_type === 'EmptySD3LatentImage') {
        injections[nodeId] = {
          width: params.width ?? 1920,
          height: params.height ?? 1088,
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
    let seedInjected = false;

    for (const [nodeId, node] of Object.entries(workflow)) {
      // LoadImage nodes - inject source image
      if (node.class_type === 'LoadImage') {
        injections[nodeId] = { image: path.basename(params.imageFile) };
      }

      // Text prompt nodes
      if (node.class_type === 'CLIPTextEncode') {
        const title = node._meta?.title?.toLowerCase() || '';
        // Check for negative first since "negative prompt" contains both keywords
        if (title.includes('negative')) {
          if (params.negativePrompt !== undefined) {
            injections[nodeId] = { text: params.negativePrompt };
          }
        } else if (title.includes('positive') || title.includes('prompt')) {
          injections[nodeId] = { text: params.prompt };
        }
      }

      // WanImageToVideo node - main i2v conditioning
      if (node.class_type === 'WanImageToVideo') {
        const updates: Record<string, unknown> = {};
        if (params.width !== undefined) updates.width = params.width;
        if (params.height !== undefined) updates.height = params.height;
        if (params.frames !== undefined) updates.length = params.frames;
        if (Object.keys(updates).length > 0) {
          injections[nodeId] = updates;
        }
      }

      // KSampler / KSamplerAdvanced nodes - inject seed (only first one to avoid conflicts)
      if ((node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') && !seedInjected) {
        if (params.seed !== undefined) {
          injections[nodeId] = { noise_seed: params.seed };
          seedInjected = true;
        }
      }

      // CreateVideo node - inject fps
      if (node.class_type === 'CreateVideo') {
        if (params.fps !== undefined) {
          injections[nodeId] = { fps: params.fps };
        }
      }

      // SVD-style video nodes (for other workflows)
      if (node.class_type.includes('SVD') && node.class_type.includes('Conditioning')) {
        const updates: Record<string, unknown> = {};
        if (params.motionStrength !== undefined) {
          updates.motion_bucket_id = Math.round(params.motionStrength * 255);
        }
        if (params.fps !== undefined) updates.fps = params.fps;
        if (Object.keys(updates).length > 0) {
          injections[nodeId] = updates;
        }
      }

      // SaveVideo node - inject filename prefix for batch processing
      if (node.class_type === 'SaveVideo') {
        if (params.filenamePrefix !== undefined) {
          injections[nodeId] = { filename_prefix: params.filenamePrefix };
        }
      }
    }

    return this.injectParams(workflow, injections);
  }

  /**
   * Prepare a Flux2 Klein image-to-image workflow for character reference generation
   * This workflow uses ReferenceLatent nodes to condition generation on an input image
   */
  prepareImageToImageWorkflow(
    workflow: ComfyUIWorkflow,
    params: ImageToImageParams
  ): ComfyUIWorkflow {
    const injections: Record<string, Record<string, unknown>> = {};

    for (const [nodeId, node] of Object.entries(workflow)) {
      // LoadImage node - Reference image (expects just filename in ComfyUI input folder)
      if (node.class_type === 'LoadImage') {
        injections[nodeId] = { image: path.basename(params.referenceImage) };
      }

      // CLIP Text Encode nodes - prompts
      if (node.class_type === 'CLIPTextEncode') {
        const title = node._meta?.title?.toLowerCase() || '';
        if (title.includes('negative')) {
          injections[nodeId] = { text: params.negativePrompt || '' };
        } else if (title.includes('positive') || title.includes('prompt')) {
          injections[nodeId] = { text: params.prompt };
        }
      }

      // RandomNoise node - Seed
      if (node.class_type === 'RandomNoise') {
        injections[nodeId] = {
          noise_seed: params.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
        };
      }

      // Flux2Scheduler node - Steps
      if (node.class_type === 'Flux2Scheduler') {
        if (params.steps !== undefined) {
          injections[nodeId] = { steps: params.steps };
        }
      }

      // CFGGuider node - CFG scale
      if (node.class_type === 'CFGGuider') {
        if (params.cfg !== undefined) {
          injections[nodeId] = { cfg: params.cfg };
        }
      }
    }

    return this.injectParams(workflow, injections);
  }

  /**
   * Upload an image to ComfyUI input folder for use in workflows
   * @param localPath - Path to local image file
   * @param targetFilename - Optional filename in ComfyUI (defaults to basename)
   * @returns The filename as it exists in ComfyUI's input folder
   */
  async uploadImage(localPath: string, targetFilename?: string): Promise<string> {
    const filename = targetFilename || path.basename(localPath);
    const imageBuffer = await fs.readFile(localPath);

    // Create form data for multipart upload
    const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
    const CRLF = '\r\n';

    // Build multipart body manually since Node.js FormData doesn't work with fetch directly
    const parts: Buffer[] = [];

    // Image file part
    parts.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="image"; filename="${filename}"${CRLF}` +
      `Content-Type: application/octet-stream${CRLF}${CRLF}`
    ));
    parts.push(imageBuffer);
    parts.push(Buffer.from(CRLF));

    // Overwrite flag part
    parts.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="overwrite"${CRLF}${CRLF}` +
      `true${CRLF}`
    ));

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--${CRLF}`));

    const body = Buffer.concat(parts);

    const response = await fetch(`${this.baseUrl}/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ComfyUIError(
        `Failed to upload image: ${response.statusText} - ${text}`,
        'UPLOAD_ERROR'
      );
    }

    const result = await response.json() as { name: string; subfolder: string; type: string };
    return result.name;
  }

  /**
   * Generate an image using image-to-image with character reference
   */
  async generateImageWithReference(
    workflowPath: string,
    params: ImageToImageParams,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    onProgress?.(0, 'Loading workflow');
    const workflow = await this.loadWorkflow(workflowPath);

    onProgress?.(5, 'Uploading reference image');
    // Upload the reference image to ComfyUI's input folder
    const uploadedFilename = await this.uploadImage(params.referenceImage);

    // Update params with the uploaded filename
    const updatedParams: ImageToImageParams = {
      ...params,
      referenceImage: uploadedFilename,
    };

    onProgress?.(10, 'Preparing workflow');
    const prepared = this.prepareImageToImageWorkflow(workflow, updatedParams);

    onProgress?.(15, 'Queueing workflow');
    const promptId = await this.queueWorkflow(prepared);

    await this.pollProgress(promptId, (progress, message) => {
      // Scale progress to 15-90 range during execution
      const scaledProgress = 15 + Math.round(progress * 0.75);
      onProgress?.(scaledProgress, message);
    });

    onProgress?.(92, 'Retrieving outputs');
    const outputs = await this.getJobOutputs(promptId);

    if (outputs.length === 0) {
      throw new ComfyUIError('No output files generated', 'NO_OUTPUT');
    }

    onProgress?.(95, 'Downloading file');
    const output = outputs[0];
    const savedPath = await this.downloadFile(output.filename, output.subfolder, outputPath);

    onProgress?.(100, 'Complete');
    return savedPath;
  }

  /**
   * Prepare inpainting workflow with source image, mask, and prompt
   * Uses Flux2 Klein 9B Inpainting workflow with LanPaint KSampler
   *
   * Node mapping for flux2_klein_9b_Inpainting.json:
   * - Node 151 (EditImage): LoadImage for source image
   * - Node 163 (MaskImage): LoadImage for mask (red channel)
   * - Node 107 (CLIP Text Encode (Positive Prompt)): Edit prompt
   * - Node 156 (LanPaint KSampler): seed, steps
   */
  prepareInpaintWorkflow(
    workflow: ComfyUIWorkflow,
    params: InpaintParams
  ): ComfyUIWorkflow {
    const injections: Record<string, Record<string, unknown>> = {};

    for (const [nodeId, node] of Object.entries(workflow)) {
      const title = node._meta?.title?.toLowerCase() || '';

      // LoadImage nodes - EditImage and MaskImage
      if (node.class_type === 'LoadImage') {
        if (title.includes('editimage') || title === 'editimage') {
          injections[nodeId] = { image: path.basename(params.sourceImage) };
        } else if (title.includes('maskimage') || title === 'maskimage') {
          injections[nodeId] = { image: path.basename(params.maskImage) };
        }
      }

      // CLIP Text Encode nodes - prompts
      if (node.class_type === 'CLIPTextEncode') {
        if (title.includes('negative')) {
          injections[nodeId] = { text: params.negativePrompt || '' };
        } else if (title.includes('positive') || title.includes('prompt')) {
          injections[nodeId] = { text: params.prompt };
        }
      }

      // LanPaint_KSampler node - seed, steps
      if (node.class_type === 'LanPaint_KSampler') {
        const updates: Record<string, unknown> = {};
        if (params.seed !== undefined) {
          updates.seed = params.seed;
        }
        if (params.steps !== undefined) {
          updates.steps = params.steps;
        }
        if (Object.keys(updates).length > 0) {
          injections[nodeId] = updates;
        }
      }

      // KSampler fallback (if workflow uses standard sampler)
      if (node.class_type === 'KSampler' || node.class_type === 'KSamplerAdvanced') {
        const updates: Record<string, unknown> = {};
        if (params.seed !== undefined) {
          updates.seed = params.seed;
        }
        if (params.steps !== undefined) {
          updates.steps = params.steps;
        }
        if (Object.keys(updates).length > 0) {
          injections[nodeId] = updates;
        }
      }
    }

    return this.injectParams(workflow, injections);
  }

  /**
   * Generate an edited image using inpainting workflow
   * Uploads both source image and mask to ComfyUI
   */
  async generateInpaint(
    workflowPath: string,
    params: InpaintParams,
    outputPath: string,
    onProgress?: ProgressCallback
  ): Promise<string> {
    onProgress?.(0, 'Loading workflow');
    const workflow = await this.loadWorkflow(workflowPath);

    onProgress?.(5, 'Uploading source image');
    const uploadedSourceFilename = await this.uploadImage(params.sourceImage);

    onProgress?.(10, 'Uploading mask image');
    const uploadedMaskFilename = await this.uploadImage(params.maskImage);

    // Update params with uploaded filenames
    const updatedParams: InpaintParams = {
      ...params,
      sourceImage: uploadedSourceFilename,
      maskImage: uploadedMaskFilename,
    };

    onProgress?.(15, 'Preparing workflow');
    const prepared = this.prepareInpaintWorkflow(workflow, updatedParams);

    onProgress?.(20, 'Queueing workflow');
    const promptId = await this.queueWorkflow(prepared);

    await this.pollProgress(promptId, (progress, message) => {
      // Scale progress to 20-90 range during execution
      const scaledProgress = 20 + Math.round(progress * 0.7);
      onProgress?.(scaledProgress, message);
    });

    onProgress?.(92, 'Retrieving outputs');
    const outputs = await this.getJobOutputs(promptId);

    if (outputs.length === 0) {
      throw new ComfyUIError('No output files generated', 'NO_OUTPUT');
    }

    onProgress?.(95, 'Downloading file');
    const output = outputs[0];
    const savedPath = await this.downloadFile(output.filename, output.subfolder, outputPath);

    onProgress?.(100, 'Complete');
    return savedPath;
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
   * Get job outputs from history (returns full file info including subfolder)
   */
  async getJobOutputs(promptId: string): Promise<OutputFile[]> {
    const response = await this.fetchWithRetry<HistoryResponse>(
      `${this.baseUrl}/history/${promptId}`
    );

    const job = response[promptId];
    if (!job || !job.outputs) {
      throw new ComfyUIError('Job not found or has no outputs', 'JOB_NOT_FOUND');
    }

    const files: OutputFile[] = [];
    for (const output of Object.values(job.outputs)) {
      if (output.images) {
        files.push(...output.images);
      }
      if (output.gifs) {
        files.push(...output.gifs);
      }
      if (output.videos) {
        files.push(...output.videos);
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
   * Queue an image workflow without waiting for completion.
   * Used for batch processing to keep models loaded in VRAM.
   * @returns promptId for tracking
   */
  async queueImageWorkflow(
    workflowPath: string,
    params: ImageGenerationParams
  ): Promise<{ promptId: string; workflow: ComfyUIWorkflow }> {
    const workflow = await this.loadWorkflow(workflowPath);
    const prepared = this.prepareImageWorkflow(workflow, params);
    const promptId = await this.queueWorkflow(prepared);
    return { promptId, workflow: prepared };
  }

  /**
   * Queue a video workflow without waiting for completion.
   * Used for batch processing to keep models loaded in VRAM.
   * @returns promptId for tracking
   */
  async queueVideoWorkflow(
    workflowPath: string,
    params: VideoGenerationParams
  ): Promise<{ promptId: string; workflow: ComfyUIWorkflow }> {
    const workflow = await this.loadWorkflow(workflowPath);
    const prepared = this.prepareVideoWorkflow(workflow, params);
    const promptId = await this.queueWorkflow(prepared);
    return { promptId, workflow: prepared };
  }

  /**
   * Wait for a batch of prompts to complete and download their outputs.
   * Processes completions as they happen via WebSocket.
   *
   * @param promptIds - Array of prompt IDs to wait for
   * @param outputPaths - Array of output paths corresponding to each prompt
   * @param onEachComplete - Callback fired when each prompt completes
   * @param onProgress - Callback fired after each completion with progress info
   * @param timeoutMs - Optional timeout in milliseconds (defaults to instance timeout)
   */
  async waitForPromptBatch(
    promptIds: string[],
    outputPaths: string[],
    onEachComplete?: (index: number, outputPath: string) => void | Promise<void>,
    onProgress?: (completed: number, total: number) => void | Promise<void>,
    timeoutMs?: number
  ): Promise<string[]> {
    const results: string[] = new Array(promptIds.length).fill('');
    const pending = new Set(promptIds);
    let completed = 0;

    // Use provided timeout or fall back to instance timeout
    const effectiveTimeout = timeoutMs ?? this.timeout;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${this.wsUrl}/ws?clientId=${this.clientId}`);
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          reject(new ComfyUIError(`Timeout waiting for batch completion after ${Math.round(effectiveTimeout / 1000)}s`, 'TIMEOUT'));
        }
      }, effectiveTimeout);

      const checkComplete = () => {
        if (pending.size === 0 && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve(results);
        }
      };

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;

          if (message.type === 'executing' && message.data?.prompt_id) {
            const promptId = message.data.prompt_id;
            const index = promptIds.indexOf(promptId);

            // null node means execution complete
            if (message.data.node === null && index !== -1 && pending.has(promptId)) {
              pending.delete(promptId);
              completed++;

              try {
                // Download the output
                const outputs = await this.getJobOutputs(promptId);
                if (outputs.length > 0) {
                  const output = outputs[0];
                  const savedPath = await this.downloadFile(
                    output.filename,
                    output.subfolder,
                    outputPaths[index]
                  );
                  results[index] = savedPath;
                  await onEachComplete?.(index, savedPath);
                }
              } catch (err) {
                console.error(`Failed to download output for prompt ${promptId}:`, err);
              }

              await onProgress?.(completed, promptIds.length);
              checkComplete();
            }
          }

          if (message.type === 'execution_error' && message.data?.prompt_id) {
            const promptId = message.data.prompt_id;
            if (pending.has(promptId)) {
              pending.delete(promptId);
              completed++;
              console.error(`Execution error for prompt ${promptId}:`, message.data);
              await onProgress?.(completed, promptIds.length);
              checkComplete();
            }
          }
        } catch {
          // Ignore parse errors
        }
      });

      ws.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new ComfyUIError(`WebSocket error: ${error.message}`, 'WEBSOCKET_ERROR', error));
        }
      });

      ws.on('close', () => {
        // Give a moment for any final processing
        setTimeout(() => {
          if (!resolved && pending.size > 0) {
            // Try to recover by checking status via HTTP
            this.recoverBatchStatus(promptIds, outputPaths, results, pending)
              .then(() => {
                resolved = true;
                clearTimeout(timeout);
                resolve(results);
              })
              .catch(reject);
          }
        }, 1000);
      });
    });
  }

  /**
   * Recover batch status via HTTP if WebSocket disconnects
   */
  private async recoverBatchStatus(
    promptIds: string[],
    outputPaths: string[],
    results: string[],
    pending: Set<string>
  ): Promise<void> {
    for (const promptId of pending) {
      const index = promptIds.indexOf(promptId);
      try {
        const isComplete = await this.checkJobStatus(promptId);
        if (isComplete) {
          const outputs = await this.getJobOutputs(promptId);
          if (outputs.length > 0) {
            const output = outputs[0];
            results[index] = await this.downloadFile(
              output.filename,
              output.subfolder,
              outputPaths[index]
            );
          }
        }
      } catch {
        // Ignore errors during recovery
      }
    }
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
    const output = outputs[0];
    const savedPath = await this.downloadFile(output.filename, output.subfolder, outputPath);

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
    const output = outputs[0];
    const savedPath = await this.downloadFile(output.filename, output.subfolder, outputPath);

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
