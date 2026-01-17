# STORY-007: WebSocket Progress Server

**Epic:** Infrastructure (EPIC-00)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 1

---

## User Story

As a **developer**
I want **a WebSocket server for real-time progress updates**
So that **the frontend can show live generation status without polling**

---

## Description

### Background
Generation jobs (audio, image, video, script) can take seconds to minutes. Without real-time updates, users would need to constantly refresh or poll the API, creating poor UX and unnecessary server load. A WebSocket server enables push-based updates as jobs progress.

### Scope
**In scope:**
- WebSocket server running alongside Express on port 3001
- Client subscription to project-specific channels
- Progress event broadcasting from Inngest job handlers
- Connection lifecycle management (connect/disconnect)
- Frontend React hook for WebSocket connection

**Out of scope:**
- Authentication (will be added when auth is implemented)
- Message persistence (events are ephemeral)
- Room-based multi-user features

### User Flow
1. Frontend connects to WebSocket on page load
2. Frontend sends subscription message for current project
3. Backend registers client in project channel
4. Inngest jobs broadcast progress to project channel
5. Frontend receives real-time updates
6. Frontend unsubscribes when leaving project view

---

## Acceptance Criteria

- [ ] WebSocket server starts alongside Express on `/ws` path
- [ ] Client can connect and receive `connected` acknowledgment
- [ ] Client can subscribe to a project channel via `{ type: 'subscribe', projectId: string }`
- [ ] Client receives `subscribed` confirmation with project ID
- [ ] Progress events broadcast to all clients subscribed to a project
- [ ] Events include: `progress`, `job_complete`, `job_failed`
- [ ] Client can unsubscribe from project channel
- [ ] Connection cleanup on disconnect (remove from all subscriptions)
- [ ] React hook `useWebSocket(projectId)` returns connection status and latest events
- [ ] Hook auto-reconnects on connection loss with exponential backoff
- [ ] JobService can broadcast progress via exported function

---

## Technical Notes

### Components
- **Backend:** `src/backend/websocket/server.ts` - WebSocket server setup
- **Backend:** `src/backend/websocket/broadcast.ts` - Broadcast utility functions
- **Frontend:** `src/hooks/useWebSocket.ts` - React hook for WebSocket connection

### Dependencies
- `ws` npm package for WebSocket server
- Express server must be running

### WebSocket Message Types

```typescript
// Client → Server
interface SubscribeMessage {
  type: 'subscribe';
  projectId: string;
}

interface UnsubscribeMessage {
  type: 'unsubscribe';
  projectId: string;
}

// Server → Client
interface ConnectedMessage {
  type: 'connected';
  clientId: string;
}

interface SubscribedMessage {
  type: 'subscribed';
  projectId: string;
}

interface ProgressEvent {
  type: 'progress';
  jobId: string;
  jobType: 'script' | 'audio' | 'image' | 'video' | 'export';
  sentenceId?: string;
  progress: number; // 0-100
  message?: string;
}

interface JobCompleteEvent {
  type: 'job_complete';
  jobId: string;
  jobType: string;
  sentenceId?: string;
  result: {
    file?: string;
    duration?: number;
  };
}

interface JobFailedEvent {
  type: 'job_failed';
  jobId: string;
  jobType: string;
  sentenceId?: string;
  error: string;
}
```

### Implementation Approach

```typescript
// src/backend/websocket/server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { nanoid } from 'nanoid';

const projectSubscriptions = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    const clientId = nanoid();
    ws.send(JSON.stringify({ type: 'connected', clientId }));

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      handleMessage(ws, message);
    });

    ws.on('close', () => {
      // Remove from all subscriptions
      projectSubscriptions.forEach((clients) => clients.delete(ws));
    });
  });

  return wss;
}
```

### Broadcast Utility

```typescript
// src/backend/websocket/broadcast.ts
export function broadcastToProject(projectId: string, event: object) {
  const clients = projectSubscriptions.get(projectId);
  if (!clients) return;

  const message = JSON.stringify(event);
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
```

### Frontend Hook

```typescript
// src/hooks/useWebSocket.ts
export function useWebSocket(projectId: string) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastEvent, setLastEvent] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3001/ws`);
    // Connection logic with auto-reconnect...
  }, [projectId]);

  return { status, lastEvent };
}
```

### Security Considerations
- Validate projectId format before subscribing
- Rate limit subscription requests
- Sanitize all outgoing event data

---

## Dependencies

**Prerequisite Stories:**
- STORY-001: Project Setup & Database Schema (server must exist)

**Blocked Stories:**
- STORY-009: AI Script Generation (uses WebSocket for progress)
- STORY-014: Audio Generation Job (uses WebSocket for progress)
- STORY-018: Image Generation Job (uses WebSocket for progress)
- STORY-020: Video Generation Job (uses WebSocket for progress)
- STORY-034: Progress Dashboard (displays WebSocket events)

**External Dependencies:**
- `ws` npm package

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] WebSocket connection lifecycle tests
  - [ ] Subscription/unsubscription tests
  - [ ] Broadcast delivery tests
  - [ ] Disconnect cleanup tests
- [ ] Integration tests passing
  - [ ] End-to-end connection test
  - [ ] Multi-client broadcast test
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] WebSocket message format documented
  - [ ] Hook usage examples
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing completed

---

## Story Points Breakdown

- **WebSocket server setup:** 1 point
- **Message handling & subscriptions:** 1 point
- **Frontend hook:** 1 point
- **Total:** 3 points

**Rationale:** Standard WebSocket implementation with clear patterns. The `ws` library handles most complexity. Frontend hook is straightforward React/hooks pattern.

---

## Additional Notes

The WebSocket server will be the foundation for all real-time features. Consider future enhancements:
- Heartbeat/ping-pong for connection health
- Message queue for offline clients (reconnect buffer)
- Authentication token validation

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
