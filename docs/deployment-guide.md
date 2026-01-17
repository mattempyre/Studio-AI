# 🚢 Deployment & Infrastructure - VideoGen AI Studio

VideoGen AI Studio is currently architected as a **Prosumer/Developer Studio** designed for local-first or private-cloud deployment.

## 🏗️ Infrastructure Requirements

### 💻 System Requirements
- **Memory**: 8GB+ (16GB+ recommended for AI processing)
- **Storage**: SSD-based storage for high-speed media read/write
- **Networking**: High-speed internet for Gemini/Veo cloud API calls

### 🐋 Docker Services
The studio relies on the following containerized services:
- **Inngest Dev Server**: Manages job persistence and retries.
  - Port: `8288`
  - Purpose: Orchestrates multi-stage AI script generation.

## ☁️ API Environments
The studio interfaces with the following cloud services:
1. **Google Gemini API**: 
   - `gemini-3-flash-preview` (Scripting)
   - `gemini-2.5-flash-image` (Image Gen)
   - `veo-3.1-fast-generate-preview` (Video Gen)
2. **Inngest Cloud** (Optional): Can replace local Docker for production-scale job management.

## 📂 Data Storage
- **Database**: `studio.db` (SQLite) located in binary root.
- **Media Assets**: Locally stored in the `public/` or configured output directory.
- **Environment**: Configuration via `.env.local` for local secrets management.

## 🛠️ Operational Tasks
- **DB Viewing**: `npm run db:studio` (Opens 🗃️ Drizzle Studio).
- **Inngest Monitor**: Access the Inngest UI at `http://localhost:8288`.
