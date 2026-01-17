/**
 * WebSocket Message Types for STORY-007
 * Defines all message types for client-server communication
 */

import type { JobType, JobStatus } from '../services/jobService.js';

// =============================================================================
// Client → Server Messages
// =============================================================================

export interface SubscribeMessage {
  type: 'subscribe';
  projectId: string;
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  projectId: string;
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage;

// =============================================================================
// Server → Client Messages
// =============================================================================

export interface ConnectedMessage {
  type: 'connected';
  clientId: string;
}

export interface SubscribedMessage {
  type: 'subscribed';
  projectId: string;
}

export interface UnsubscribedMessage {
  type: 'unsubscribed';
  projectId: string;
}

export interface ProgressEvent {
  type: 'progress';
  projectId: string;
  jobId: string;
  jobType: JobType;
  sentenceId?: string;
  progress: number; // 0-100
  message?: string;
  // Step tracking for multi-step jobs
  totalSteps?: number;
  currentStep?: number;
  stepName?: string;
}

export interface JobCompleteEvent {
  type: 'job_complete';
  projectId: string;
  jobId: string;
  jobType: JobType;
  sentenceId?: string;
  result: {
    file?: string;
    duration?: number;
  };
}

export interface JobFailedEvent {
  type: 'job_failed';
  projectId: string;
  jobId: string;
  jobType: JobType;
  sentenceId?: string;
  error: string;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export type ServerMessage =
  | ConnectedMessage
  | SubscribedMessage
  | UnsubscribedMessage
  | ProgressEvent
  | JobCompleteEvent
  | JobFailedEvent
  | ErrorMessage;

// =============================================================================
// Internal Types
// =============================================================================

export interface ClientInfo {
  id: string;
  subscribedProjects: Set<string>;
}
