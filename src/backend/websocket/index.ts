/**
 * WebSocket Module Exports
 * STORY-007: Real-Time Progress Updates
 */

// Server setup and management
export {
  setupWebSocket,
  getWebSocketServer,
  broadcastToProject,
  getSubscriberCount,
  getTotalClients,
  closeWebSocket,
} from './server.js';

// Broadcast utilities for job events
export {
  broadcastProgress,
  broadcastJobComplete,
  broadcastJobFailed,
  type BroadcastProgressParams,
  type BroadcastCompleteParams,
  type BroadcastFailedParams,
} from './broadcast.js';

// Message types
export type {
  // Client → Server
  SubscribeMessage,
  UnsubscribeMessage,
  ClientMessage,
  // Server → Client
  ConnectedMessage,
  SubscribedMessage,
  UnsubscribedMessage,
  ProgressEvent,
  JobCompleteEvent,
  JobFailedEvent,
  ErrorMessage,
  ServerMessage,
  // Internal
  ClientInfo,
} from './types.js';
