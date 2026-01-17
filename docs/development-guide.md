# 🛠️ Development Guide - VideoGen AI Studio

Welcome to the development guide for VideoGen AI Studio. This project uses a modern, multi-server architecture designed for high-performance AI orchestration.

## 📋 Prerequisites
- **Node.js**: v18+ (v20+ recommended)
- **Docker**: Required for Inngest Dev Server
- **Environment**: `.env.local` configured with AI API keys

## ⚙️ Initial Setup
1. **Clone the repository** and install dependencies:
   ```bash
   npm install
   ```
2. **Setup environment variables**:
   ```bash
   cp .env.example .env.local
   # Fill in GEMINI_API_KEY
   ```
3. **Initialize the database**:
   ```bash
   npm run db:init
   ```

## 🚀 Running the Studio
The easiest way to start everything is using the unified dev command:
```bash
npm run dev:all
```
This starts:
- **Frontend**: Vite (Port 3000)
- **Backend API**: tsx watch (Port 3001)
- **Inngest**: Docker (Port 8288)

## 🏗️ Worktree Workflow (Advanced)
To work on multiple stories in parallel, use Git Worktrees:
1. **Add a worktree**:
   ```bash
   git worktree add ../Studio-AI-STORY-XXX -b feature/STORY-XXX
   ```
2. **Configure Ports**:
   ```bash
   cd ../Studio-AI-STORY-XXX && npm run setup:ports
   ```
This automatically shifts ports (e.g., 31XXX) to avoid conflicts with your main worktree!

## 🧪 Testing
- **Unit/Component**: `npm run test` (Vitest)
- **E2E**: `npm run test:e2e` (Playwright)
- **Coverage**: `npm run test:coverage`
