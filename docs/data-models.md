# 🗄️ Data Models - VideoGen AI Studio

The project uses a **SQLite** database managed by **Drizzle ORM**. The schema is optimized for parent-child hierarchies and asset tracking.

## 🗺️ Entity Relationship Map

- **Project** (1) ── (N) **Sections** (1) ── (N) **Sentences**
- **Project** (1) ── (N) **Cast** (N) ── (1) **Characters**
- **Project** (1) ── (N) **ScriptOutlines**
- **Sentence** (1) ── (N) **GenerationJobs**

## 📑 Core Tables

### `projects`
Main container for video projects.
- `id` (PK): Unique string (nanoid).
- `name`: Project name.
- `topic`: Base topic/concept.
- `targetDuration`: Target length (minutes).
- `visualStyle`: Cinematic, Anime, etc.
- `voiceId`: Selected TTS voice identifier.
- `status`: `draft`, `generating`, `ready`.

### `characters`
Reusable character library for consistency.
- `name`, `description`: Character details.
- `referenceImages`: Array of base64/paths (JSON).
- `styleLora`: LoRA identifier for stable diffusion consistency.

### `sections`
Logical groupings within a script.
- `projectId`: (FK) Parent project.
- `title`: Section heading.
- `order`: Integer sequence.

### `sentences`
The unit of asset generation.
- `text`: The spoken narration.
- `imagePrompt`: AI prompt for visual generation.
- `videoPrompt`: AI prompt for motion generation.
- `cameraMovement`: static, pan, zoom, etc.
- `audioFile`, `imageFile`, `videoFile`: Paths to generated assets.
- `is[Asset]Dirty`: Boolean flags for incremental updates.

### `script_outlines`
Blueprint for multi-section generation.
- `sections`: Large JSON array containing the planned hierarchical structure.
- `status`: `draft`, `approved`, `completed`.
- `coveredTopics`: Array of concepts included in the script.

### `generation_jobs`
Async status tracker.
- `jobType`: `script`, `audio`, `image`, `video`.
- `status`: `queued`, `running`, `completed`, `failed`.
- `progress`: 0-100 percentage.
- `inngestRunId`: Reference to Inngest cloud task.
