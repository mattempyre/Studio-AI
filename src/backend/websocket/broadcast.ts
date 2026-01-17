/**
 * Broadcast Utilities for WebSocket Events
 * STORY-007: Provides convenient functions for broadcasting job events
 *
 * These functions are called from JobService and Inngest functions to notify
 * connected clients about job progress and completion.
 */

import { broadcastToProject } from './server.js';
import type {
  ProgressEvent,
  JobCompleteEvent,
  JobFailedEvent,
} from './types.js';
import type { JobType } from '../services/jobService.js';

// =============================================================================
// Progress Broadcast
// =============================================================================

export interface BroadcastProgressParams {
  projectId: string;
  jobId: string;
  jobType: JobType;
  progress: number;
  sentenceId?: string;
  message?: string;
  totalSteps?: number;
  currentStep?: number;
  stepName?: string;
}

/**
 * Broadcast a progress update for a job.
 * Called during job execution to update clients in real-time.
 */
export function broadcastProgress(params: BroadcastProgressParams): void {
  const event: ProgressEvent = {
    type: 'progress',
    projectId: params.projectId,
    jobId: params.jobId,
    jobType: params.jobType,
    progress: params.progress,
    ...(params.sentenceId && { sentenceId: params.sentenceId }),
    ...(params.message && { message: params.message }),
    ...(params.totalSteps !== undefined && { totalSteps: params.totalSteps }),
    ...(params.currentStep !== undefined && { currentStep: params.currentStep }),
    ...(params.stepName && { stepName: params.stepName }),
  };

  broadcastToProject(params.projectId, event);
}

// =============================================================================
// Job Completion Broadcast
// =============================================================================

export interface BroadcastCompleteParams {
  projectId: string;
  jobId: string;
  jobType: JobType;
  sentenceId?: string;
  result?: {
    file?: string;
    duration?: number;
  };
}

/**
 * Broadcast a job completion event.
 * Called when a job finishes successfully.
 */
export function broadcastJobComplete(params: BroadcastCompleteParams): void {
  const event: JobCompleteEvent = {
    type: 'job_complete',
    projectId: params.projectId,
    jobId: params.jobId,
    jobType: params.jobType,
    ...(params.sentenceId && { sentenceId: params.sentenceId }),
    result: params.result || {},
  };

  broadcastToProject(params.projectId, event);
}

// =============================================================================
// Job Failure Broadcast
// =============================================================================

export interface BroadcastFailedParams {
  projectId: string;
  jobId: string;
  jobType: JobType;
  sentenceId?: string;
  error: string;
}

/**
 * Broadcast a job failure event.
 * Called when a job fails after retries are exhausted.
 */
export function broadcastJobFailed(params: BroadcastFailedParams): void {
  const event: JobFailedEvent = {
    type: 'job_failed',
    projectId: params.projectId,
    jobId: params.jobId,
    jobType: params.jobType,
    ...(params.sentenceId && { sentenceId: params.sentenceId }),
    error: params.error,
  };

  broadcastToProject(params.projectId, event);
}
