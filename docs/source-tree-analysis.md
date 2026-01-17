# 🌳 Source Tree Analysis - VideoGen AI Studio

Annotated map of the VideoGen AI Studio project structure.

```text
Studio-AI/
├── components/          # ⚛️ React Frontend Components
│   ├── CharacterLibrary/ # Character management UI
│   ├── ProjectSettings/  # Configuration modals
│   ├── ScriptEditorV2/   # Modern, multi-section script editor
│   ├── ScriptEditor.tsx  # Classic editor
│   └── VideoPreview.tsx  # Live Veo/Image preview player
├── context/             # 🌍 Global React Contexts
├── docs/                # 📝 Project Documentation & Stories
├── src/                 # ⚙️ Core Logic
│   └── backend/         # 🌐 Express API & Orchestration
│       ├── api/         # REST API Route Handlers
│       ├── db/          # Drizzle ORM Schema & Migrations
│       ├── inngest/     # ⛓️ Background Job Definitions
│       ├── services/    # Business Logic (Jobs, Disk I/O)
│       ├── websocket/   # ⚡ Real-time Event Handling
│       └── server.ts    # Application entry point
├── services/            # 🤖 AI & API Clients
│   ├── backendApi.ts    # Frontend -> Backend communicator
│   └── geminiService.ts # Frontend -> Google Gemini SDK
├── scripts/             # 🛠️ Maintenance & Dev Utilities
├── tests/               # 🧪 E2E & Component Tests
├── drizzle/             # 🗃️ Generated DB Migrations
└── data/                # 📂 Local SQLite DB Storage
```

## 🚀 Key Entry Points
- **Frontend**: `index.tsx` -> `App.tsx` -> `routes.tsx`
- **Backend**: `src/backend/server.ts`
- **Background Jobs**: `src/backend/api/inngest.ts` (Endpoint)

## 📁 Critical Directories
- **`src/backend/inngest/functions/`**: Contains the complex logic for multi-stage script generation and asset processing.
- **`components/ScriptEditorV2/`**: The most complex UI module, managing tree-based script states.
- **`services/geminiService.ts`**: The central gateway for all Google AI capability integration.
