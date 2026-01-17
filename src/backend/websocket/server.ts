/**
 * WebSocket Server for Real-Time Progress Updates
 * STORY-007: Enables push-based updates for generation jobs
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { nanoid } from 'nanoid';
import type {
  ClientMessage,
  ServerMessage,
  ClientInfo,
  ConnectedMessage,
  SubscribedMessage,
  UnsubscribedMessage,
  ErrorMessage,
} from './types.js';

// =============================================================================
// State Management
// =============================================================================

/** Map of projectId → Set of WebSocket connections */
let projectSubscriptions = new Map<string, Set<WebSocket>>();

/** Map of WebSocket → ClientInfo for tracking client state */
let clientInfoMap = new WeakMap<WebSocket, ClientInfo>();

/** WebSocket server instance (initialized by setupWebSocket) */
let wss: WebSocketServer | null = null;

// =============================================================================
// WebSocket Server Setup
// =============================================================================

/**
 * Initialize the WebSocket server and attach it to the HTTP server.
 * @param server - The HTTP server to attach to
 * @returns The WebSocket server instance
 */
export function setupWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({
    server,
    path: '/ws',
  });

  console.log('[WebSocket] Server initialized on /ws path');

  wss.on('connection', handleConnection);
  wss.on('error', (error) => {
    console.error('[WebSocket] Server error:', error);
  });

  return wss;
}

/**
 * Get the WebSocket server instance.
 * @returns The WebSocket server or null if not initialized
 */
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

// =============================================================================
// Connection Handling
// =============================================================================

function handleConnection(ws: WebSocket): void {
  const clientId = nanoid();

  // Initialize client info
  const clientInfo: ClientInfo = {
    id: clientId,
    subscribedProjects: new Set(),
  };
  clientInfoMap.set(ws, clientInfo);

  console.log(`[WebSocket] Client connected: ${clientId}`);

  // Send connected acknowledgment
  sendMessage(ws, {
    type: 'connected',
    clientId,
  } satisfies ConnectedMessage);

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;
      handleMessage(ws, message, clientInfo);
    } catch (error) {
      console.error(`[WebSocket] Invalid message from ${clientId}:`, error);
      sendMessage(ws, {
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: 'Failed to parse message',
      } satisfies ErrorMessage);
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    handleDisconnect(ws, clientInfo);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error(`[WebSocket] Client ${clientId} error:`, error);
    handleDisconnect(ws, clientInfo);
  });
}

function handleMessage(ws: WebSocket, message: ClientMessage, clientInfo: ClientInfo): void {
  switch (message.type) {
    case 'subscribe':
      handleSubscribe(ws, message.projectId, clientInfo);
      break;
    case 'unsubscribe':
      handleUnsubscribe(ws, message.projectId, clientInfo);
      break;
    default:
      sendMessage(ws, {
        type: 'error',
        code: 'UNKNOWN_MESSAGE_TYPE',
        message: `Unknown message type: ${(message as { type: string }).type}`,
      } satisfies ErrorMessage);
  }
}

// =============================================================================
// Subscription Management
// =============================================================================

function handleSubscribe(ws: WebSocket, projectId: string, clientInfo: ClientInfo): void {
  // Validate projectId format (basic validation)
  if (!projectId || typeof projectId !== 'string' || projectId.length > 50) {
    sendMessage(ws, {
      type: 'error',
      code: 'INVALID_PROJECT_ID',
      message: 'Invalid project ID format',
    } satisfies ErrorMessage);
    return;
  }

  // Add client to project subscriptions
  if (!projectSubscriptions.has(projectId)) {
    projectSubscriptions.set(projectId, new Set());
  }
  projectSubscriptions.get(projectId)!.add(ws);

  // Track subscription in client info
  clientInfo.subscribedProjects.add(projectId);

  console.log(`[WebSocket] Client ${clientInfo.id} subscribed to project ${projectId}`);

  // Send confirmation
  sendMessage(ws, {
    type: 'subscribed',
    projectId,
  } satisfies SubscribedMessage);
}

function handleUnsubscribe(ws: WebSocket, projectId: string, clientInfo: ClientInfo): void {
  // Remove client from project subscriptions
  const clients = projectSubscriptions.get(projectId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) {
      projectSubscriptions.delete(projectId);
    }
  }

  // Remove from client tracking
  clientInfo.subscribedProjects.delete(projectId);

  console.log(`[WebSocket] Client ${clientInfo.id} unsubscribed from project ${projectId}`);

  // Send confirmation
  sendMessage(ws, {
    type: 'unsubscribed',
    projectId,
  } satisfies UnsubscribedMessage);
}

function handleDisconnect(ws: WebSocket, clientInfo: ClientInfo): void {
  console.log(`[WebSocket] Client disconnected: ${clientInfo.id}`);

  // Remove client from all project subscriptions
  for (const projectId of clientInfo.subscribedProjects) {
    const clients = projectSubscriptions.get(projectId);
    if (clients) {
      clients.delete(ws);
      if (clients.size === 0) {
        projectSubscriptions.delete(projectId);
      }
    }
  }

  // Clear client info
  clientInfo.subscribedProjects.clear();
}

// =============================================================================
// Message Sending
// =============================================================================

function sendMessage(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// =============================================================================
// Public API for Broadcasting
// =============================================================================

/**
 * Broadcast a message to all clients subscribed to a project.
 * @param projectId - The project to broadcast to
 * @param event - The event to broadcast
 */
export function broadcastToProject(projectId: string, event: ServerMessage): void {
  const clients = projectSubscriptions.get(projectId);
  if (!clients || clients.size === 0) {
    return;
  }

  const message = JSON.stringify(event);
  let sentCount = 0;

  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      sentCount++;
    }
  });

  if (sentCount > 0) {
    console.log(`[WebSocket] Broadcast to ${sentCount} client(s) for project ${projectId}: ${event.type}`);
  }
}

/**
 * Get the number of clients subscribed to a project.
 * @param projectId - The project to check
 * @returns Number of subscribed clients
 */
export function getSubscriberCount(projectId: string): number {
  const clients = projectSubscriptions.get(projectId);
  return clients ? clients.size : 0;
}

/**
 * Get total number of connected clients.
 * @returns Total connected clients
 */
export function getTotalClients(): number {
  return wss ? wss.clients.size : 0;
}

/**
 * Close the WebSocket server gracefully.
 */
export function closeWebSocket(): void {
  if (wss) {
    wss.clients.forEach((ws) => {
      ws.close(1000, 'Server shutting down');
    });
    wss.close();
    wss = null;
    // Reset state
    projectSubscriptions = new Map();
    clientInfoMap = new WeakMap();
    console.log('[WebSocket] Server closed');
  }
}

/**
 * Reset WebSocket state (for testing).
 */
export function resetWebSocketState(): void {
  projectSubscriptions = new Map();
  clientInfoMap = new WeakMap();
}
