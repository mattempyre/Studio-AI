# 🏛️ Architecture - VideoGen AI Studio

VideoGen AI Studio uses a **Distributed Orchestration Architecture** to manage the high latency and complexity of AI video generation.

## 🌉 Orchestration Flow

1. **User Input** ──> **Frontend (React)** ──> **Backend (Express)**
2. **Backend** ──> **Database (SQLite)** ──> **Job Queue (Inngest)**
3. **Inngest** ──> **Cloud APIs (Gemini/Veo)** ──> **Asset Storage (Local)**
4. **Local Assets** ──> **Frontend Preview (VideoPreview)**

## ⚙️ Backend Architecture (Service-Oriented)
- **API Layer**: Versioned REST endpoints for client communication.
- **Job Layer (Durable)**: Inngest functions handle long-running script and media generation with built-in retries.
- **Persistence Layer**: Drizzle ORM provides type-safe access to a portable SQLite database.
- **Real-time Layer**: WebSockets and SSE provide live generation feedback to the studio UI.

## ⚛️ Frontend Architecture (State-Lifted)
- **State Container**: `App.tsx` maintains the global project state.
- **Persistence**: Hybrid approach using local storage and periodic auto-saves to the backend API.
- **AI Bridges**: Specialized services (`geminiService`) wrap the raw Google SDKs for studio-specific tasks.

## ⛓️ Job Concurrency & Strategies
- **Text Tasks**: Highly parallel via multiple Inngest workers.
- **Media Tasks**: Sequential or limited concurrency to manage bandwidth and local processing overhead.
- **Regeneration**: "Dirty Flag" system in the `sentences` table ensures only modified segments are re-processed.
