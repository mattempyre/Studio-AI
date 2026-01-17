# 📡 API Contracts - VideoGen AI Studio

The VideoGen AI Studio backend provides a RESTful API for project management, script generation, and asset orchestration.

**Base URL**: `http://localhost:3001/api/v1`

## 📂 Projects
Endpoints for managing video projects and their metadata.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/projects` | List all projects with section and sentence counts. |
| `POST` | `/projects` | Create a new project draft. |
| `GET` | `/projects/:id` | Get full project details including sections, sentences, and cast. |
| `PUT` | `/projects/:id` | Update project metadata (topic, style, duration). |
| `DELETE` | `/projects/:id` | Delete project and all associated media files. |
| `POST` | `/projects/:id/cast` | Add a character to the project cast. |
| `POST` | `/projects/:id/cast/batch` | Add multiple characters to the cast. |
| `DELETE` | `/projects/:id/cast/:charId` | Remove a character from the cast. |

## 📝 Script Generation
Advanced AI-powered script generation workflows.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/projects/:id/quick-generate` | Synchronous script generation for immediate results. |
| `POST` | `/projects/:id/generate-outline` | Generate a JSON outline for user review/approval. |
| `POST` | `/projects/:id/generate-script-short` | Trigger async generation for scripts < 10 mins. |
| `POST` | `/projects/:id/generate-script` | Trigger long-form async generation (requires outline). |
| `GET` | `/projects/:id/generation-status` | **SSE Endpoint**: Stream live generation progress. |
| `GET` | `/projects/:id/outlines` | Get all generated outlines for a project. |
| `POST` | `/outlines/:id/regenerate-section` | Regenerate a specific section within an outline. |

## 🧩 Sections & Sentences
Granular control over script components.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/sections/:id` | Get section details with ordered sentences. |
| `POST` | `/sections/:id/ai-expand` | Get AI suggestions to expand a section. |
| `POST` | `/sections/:id/ai-expand/accept` | Accept and insert AI-generated sentences. |
| `POST` | `/sections/reorder` | Reorder sections within a project. |
| `POST` | `/sentences/reorder` | Reorder sentences within a section. |
| `POST` | `/sentences/:id/move` | Move a sentence to a different section/position. |

## ⚙️ System
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Check system status and connectivity. |
| `POST` | `/inngest` | **Inngest Serve**: Background job orchestration endpoint. |
| `WS` | `/ws` | WebSocket endpoint for real-time events. |
