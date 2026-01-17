/**
 * useWebSocket Hook for Real-Time Progress Updates
 * STORY-007: Frontend hook for WebSocket connection
 *
 * Features:
 * - Auto-connect and subscribe to project channel
 * - Auto-reconnect with exponential backoff
 * - Returns connection status and latest events
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// Types (mirroring backend types for client-side use)
// =============================================================================

export type JobType = 'script' | 'script-long' | 'audio' | 'image' | 'video' | 'export';

export interface ProgressEvent {
  type: 'progress';
  projectId: string;
  jobId: string;
  jobType: JobType;
  sentenceId?: string;
  progress: number;
  message?: string;
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

export type WebSocketEvent = ProgressEvent | JobCompleteEvent | JobFailedEvent;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

// =============================================================================
// Configuration
// =============================================================================

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';
const RECONNECT_BASE_DELAY = 1000; // 1 second
const RECONNECT_MAX_DELAY = 30000; // 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

// =============================================================================
// Hook
// =============================================================================

export interface UseWebSocketOptions {
  /** Called when a progress event is received */
  onProgress?: (event: ProgressEvent) => void;
  /** Called when a job completes */
  onJobComplete?: (event: JobCompleteEvent) => void;
  /** Called when a job fails */
  onJobFailed?: (event: JobFailedEvent) => void;
  /** Called on any event */
  onEvent?: (event: WebSocketEvent) => void;
  /** Whether to auto-connect (default: true) */
  autoConnect?: boolean;
}

export interface UseWebSocketReturn {
  /** Current connection status */
  status: ConnectionStatus;
  /** The most recent event received */
  lastEvent: WebSocketEvent | null;
  /** Client ID assigned by server */
  clientId: string | null;
  /** Whether currently subscribed to the project */
  isSubscribed: boolean;
  /** Manually connect to WebSocket */
  connect: () => void;
  /** Manually disconnect from WebSocket */
  disconnect: () => void;
  /** Subscribe to a different project */
  subscribe: (projectId: string) => void;
  /** Unsubscribe from current project */
  unsubscribe: () => void;
}

export function useWebSocket(
  projectId: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    onProgress,
    onJobComplete,
    onJobFailed,
    onEvent,
    autoConnect = true,
  } = options;

  // State
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Refs for connection management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentProjectId = useRef<string | null>(projectId);

  // Update ref when projectId changes
  useEffect(() => {
    currentProjectId.current = projectId;
  }, [projectId]);

  // Clear reconnect timeout
  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
  }, []);

  // Subscribe to project
  const subscribeToProject = useCallback((ws: WebSocket, pid: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'subscribe', projectId: pid }));
    }
  }, []);

  // Unsubscribe from project
  const unsubscribeFromProject = useCallback((ws: WebSocket, pid: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'unsubscribe', projectId: pid }));
      setIsSubscribed(false);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setStatus('connecting');
    clearReconnectTimeout();

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connected');
        setStatus('connected');
        reconnectAttempts.current = 0;

        // Auto-subscribe if we have a projectId
        if (currentProjectId.current) {
          subscribeToProject(ws, currentProjectId.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              setClientId(message.clientId);
              break;

            case 'subscribed':
              setIsSubscribed(true);
              console.log(`[WebSocket] Subscribed to project ${message.projectId}`);
              break;

            case 'unsubscribed':
              setIsSubscribed(false);
              console.log(`[WebSocket] Unsubscribed from project ${message.projectId}`);
              break;

            case 'progress':
              setLastEvent(message as ProgressEvent);
              onProgress?.(message as ProgressEvent);
              onEvent?.(message as ProgressEvent);
              break;

            case 'job_complete':
              setLastEvent(message as JobCompleteEvent);
              onJobComplete?.(message as JobCompleteEvent);
              onEvent?.(message as JobCompleteEvent);
              break;

            case 'job_failed':
              setLastEvent(message as JobFailedEvent);
              onJobFailed?.(message as JobFailedEvent);
              onEvent?.(message as JobFailedEvent);
              break;

            case 'error':
              console.error('[WebSocket] Server error:', message.message);
              break;

            default:
              console.warn('[WebSocket] Unknown message type:', message.type);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason})`);
        setStatus('disconnected');
        setIsSubscribed(false);
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
            RECONNECT_MAX_DELAY
          );
          reconnectAttempts.current++;

          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[WebSocket] Max reconnection attempts reached');
          setStatus('error');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
      setStatus('error');
    }
  }, [clearReconnectTimeout, subscribeToProject, onProgress, onJobComplete, onJobFailed, onEvent]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // Prevent reconnection

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setStatus('disconnected');
    setIsSubscribed(false);
    setClientId(null);
  }, [clearReconnectTimeout]);

  // Public subscribe function
  const subscribe = useCallback((pid: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Unsubscribe from current project first
      if (currentProjectId.current && currentProjectId.current !== pid) {
        unsubscribeFromProject(wsRef.current, currentProjectId.current);
      }
      subscribeToProject(wsRef.current, pid);
      currentProjectId.current = pid;
    }
  }, [subscribeToProject, unsubscribeFromProject]);

  // Public unsubscribe function
  const unsubscribe = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN && currentProjectId.current) {
      unsubscribeFromProject(wsRef.current, currentProjectId.current);
    }
  }, [unsubscribeFromProject]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Handle projectId changes
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Unsubscribe from previous project
      if (currentProjectId.current && currentProjectId.current !== projectId) {
        unsubscribeFromProject(wsRef.current, currentProjectId.current);
      }

      // Subscribe to new project
      if (projectId) {
        subscribeToProject(wsRef.current, projectId);
      }
    }
  }, [projectId, subscribeToProject, unsubscribeFromProject]);

  return {
    status,
    lastEvent,
    clientId,
    isSubscribed,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}

export default useWebSocket;
