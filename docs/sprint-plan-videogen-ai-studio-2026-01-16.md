# Sprint Plan: VideoGen AI Studio

**Date:** 2026-01-16
**Scrum Master:** matte
**Project Level:** 3 (Complex)
**Total Stories:** 36
**Total Points:** 150
**Planned Sprints:** 5
**Sprint Capacity:** 30 points/sprint

---

## Executive Summary

This sprint plan breaks down the VideoGen AI Studio MVP into 36 implementable stories across 5 two-week sprints. The plan prioritizes infrastructure setup first, followed by core generation features, then UI and export capabilities.

**Key Metrics:**
| Metric | Value |
|--------|-------|
| Total Stories | 36 |
| Total Points | 150 |
| Sprints | 5 (10 weeks) |
| Team Capacity | 30 points/sprint |
| Target Completion | Late March 2026 |

---

## Story Inventory

### Infrastructure Stories (EPIC-00)

#### STORY-001: Project Setup & Database Schema
**Epic:** Infrastructure
**Priority:** Must Have
**Points:** 5

**User Story:**
As a developer, I want the project infrastructure set up with database schema so I can start implementing features.

**Acceptance Criteria:**
- [ ] Node.js + Express backend initialized with TypeScript
- [ ] SQLite + Drizzle ORM configured
- [ ] All database tables created (projects, sections, sentences, characters, jobs)
- [ ] Drizzle Studio accessible for data viewing
- [ ] Basic API structure in place

**Technical Notes:**
- Follow architecture: `src/backend/` structure
- Use Drizzle schema from architecture doc
- Set up `npx drizzle-kit studio` command

**Dependencies:** None

---

#### STORY-002: Inngest Job Queue Integration
**Epic:** Infrastructure
**Priority:** Must Have
**Points:** 5

**User Story:**
As a developer, I want Inngest integrated so I can queue and manage background generation jobs.

**Acceptance Criteria:**
- [ ] Inngest dev server running via Docker
- [ ] Inngest client configured in backend
- [ ] Test function that logs "Hello from Inngest"
- [ ] Event sending and receiving working
- [ ] Job status tracking in database

**Technical Notes:**
- Follow Inngest TypeScript SDK patterns
- Configure concurrency limits per architecture

**Dependencies:** STORY-001

---

#### STORY-003: ComfyUI Client Integration
**Epic:** Infrastructure
**Priority:** Must Have
**Points:** 5

**User Story:**
As a developer, I want a ComfyUI client so I can send workflows and receive generated images/videos.

**Acceptance Criteria:**
- [ ] ComfyUI client class with queue/poll/download methods
- [ ] Workflow JSON loading and parameter injection
- [ ] Progress polling via ComfyUI WebSocket
- [ ] File download and storage
- [ ] Error handling and retry logic

**Technical Notes:**
- ComfyUI runs on localhost:8188
- Store workflows in `workflows/` directory

**Dependencies:** STORY-001

---

#### STORY-004: Chatterbox TTS Client Integration
**Epic:** Infrastructure
**Priority:** Must Have
**Points:** 3

**User Story:**
As a developer, I want a Chatterbox TTS client so I can generate speech from text.

**Acceptance Criteria:**
- [ ] Docker container running Chatterbox
- [ ] TTS client class with generateSpeech method
- [ ] Voice selection parameter (Puck, Kore, etc.)
- [ ] WAV file output and storage
- [ ] Duration extraction from generated audio

**Technical Notes:**
- Chatterbox runs on localhost:8080
- Return audio duration in milliseconds

**Dependencies:** STORY-001

---

#### STORY-005: Deepseek API Client Integration
**Epic:** Infrastructure
**Priority:** Must Have
**Points:** 3

**User Story:**
As a developer, I want a Deepseek client so I can generate scripts from topics.

**Acceptance Criteria:**
- [ ] Deepseek API client with proper authentication
- [ ] Script generation with structured output (sections/sentences)
- [ ] Search grounding option for fact-checking
- [ ] Duration targeting in prompt
- [ ] Error handling for API failures

**Technical Notes:**
- API key from environment variable
- Parse response into Section/Sentence structure

**Dependencies:** STORY-001

---

#### STORY-006: Long-Form Script Generation
**Epic:** Infrastructure
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want to generate scripts for videos from 1 minute to 3 hours so I can create long-form content without repetition.

**Acceptance Criteria:**
- [ ] Generate script outlines with section targets (1-180 min)
- [ ] Section-by-section generation with context passing
- [ ] Running summary prevents repetition across sections
- [ ] Support "auto" mode (topic → complete script)
- [ ] Support "outline-first" mode (topic → outline → review → generate)
- [ ] Real-time progress updates via SSE
- [ ] Resume interrupted generation from saved state

**Technical Notes:**
- Implements AgentWrite pattern with recursive summarization
- New `script_outlines` table for outline storage
- Extends DeepseekClient with `generateOutline()`, `generateSectionWithContext()`, `compressSummary()`
- See `docs/stories/STORY-006-long-form-script-generation.md` for full spec

**Dependencies:** STORY-005

---

#### STORY-007: WebSocket Progress Server
**Epic:** Infrastructure
**Priority:** Must Have
**Points:** 3

**User Story:**
As a developer, I want a WebSocket server so I can push real-time progress updates to the frontend.

**Acceptance Criteria:**
- [ ] WebSocket server running alongside Express
- [ ] Client subscription to project channels
- [ ] Progress event broadcasting
- [ ] Connection handling (connect/disconnect)
- [ ] Frontend WebSocket hook

**Technical Notes:**
- Use `ws` library
- Broadcast progress from Inngest job handlers

**Dependencies:** STORY-001

---

### EPIC-01: Script Management (FR-1xx)

#### STORY-008: Project CRUD API
**Epic:** Script Management
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to create and manage projects so I can organize my video productions.

**Acceptance Criteria:**
- [ ] POST /api/projects - Create project
- [ ] GET /api/projects - List all projects
- [ ] GET /api/projects/:id - Get project with sections/sentences
- [ ] PUT /api/projects/:id - Update project metadata
- [ ] DELETE /api/projects/:id - Delete project and all assets

**Technical Notes:**
- Include targetDuration, visualStyle in project

**Dependencies:** STORY-001
**FRs Covered:** FR-106, FR-107

---

#### STORY-009: AI Script Generation
**Epic:** Script Management
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want to enter a topic and have AI generate a segmented script so I can quickly start production.

**Acceptance Criteria:**
- [ ] POST /api/projects/:id/generate-script endpoint
- [ ] Deepseek generates script based on topic and duration
- [ ] Script auto-segmented into sections with titles
- [ ] Each sentence stored as separate record
- [ ] Search grounding toggle supported
- [ ] Progress updates via WebSocket

**Technical Notes:**
- Use Inngest for async generation
- Parse Deepseek response into sections/sentences

**Dependencies:** STORY-005, STORY-007, STORY-008
**FRs Covered:** FR-101, FR-103, FR-104, FR-105

---

#### STORY-010: Script Editor Component
**Epic:** Script Management
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want to edit my script with section/sentence structure visible so I can refine the content.

**Acceptance Criteria:**
- [ ] Script editor UI with sections and sentences
- [ ] Inline editing of sentence text
- [ ] Section title editing
- [ ] Add/remove sentences within sections
- [ ] Reorder sentences via drag-and-drop
- [ ] Save changes to backend

**Technical Notes:**
- Use existing React patterns from codebase
- Mark sentences as "dirty" when edited

**Dependencies:** STORY-008
**FRs Covered:** FR-102, FR-104

---

### EPIC-02: Character System (FR-2xx)

#### STORY-011: Character Library CRUD
**Epic:** Character System
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to manage a library of characters so I can reuse them across projects.

**Acceptance Criteria:**
- [ ] GET/POST/PUT/DELETE /api/characters endpoints
- [ ] Character name, description, referenceImages storage
- [ ] Image upload and storage (local filesystem)
- [ ] LoRA identifier field (optional)

**Technical Notes:**
- Store images in `data/characters/{id}/` folder
- Support multiple reference images per character

**Dependencies:** STORY-001
**FRs Covered:** FR-201, FR-203

---

#### STORY-012: Character Library UI
**Epic:** Character System
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want a character library panel so I can browse and manage my characters.

**Acceptance Criteria:**
- [ ] Character library panel component
- [ ] Grid view with character thumbnails
- [ ] Create/edit character modal
- [ ] Image upload functionality
- [ ] Delete character with confirmation

**Technical Notes:**
- Reuse existing panel patterns

**Dependencies:** STORY-011
**FRs Covered:** FR-201, FR-203

---

#### STORY-013: Project Cast Management
**Epic:** Character System
**Priority:** Must Have
**Points:** 2

**User Story:**
As a creator, I want to add characters to my project cast so they're included in generated visuals.

**Acceptance Criteria:**
- [ ] POST /api/projects/:id/cast endpoint
- [ ] Add character from library to project
- [ ] Remove character from project cast
- [ ] Cast displayed in project settings
- [ ] Cast passed to image generation

**Technical Notes:**
- Many-to-many relationship via project_cast table

**Dependencies:** STORY-011, STORY-008
**FRs Covered:** FR-204

---

### EPIC-03: Voice Generation (FR-3xx)

#### STORY-014: Audio Generation Job
**Epic:** Voice Generation
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want audio automatically generated for each sentence so I have narration.

**Acceptance Criteria:**
- [ ] Inngest audio/generate function
- [ ] Calls Chatterbox TTS for each sentence
- [ ] Stores WAV file in data/projects/{id}/audio/
- [ ] Updates sentence.audioFile and audioDuration
- [ ] Progress updates via WebSocket
- [ ] Handles errors with retry

**Technical Notes:**
- Concurrency: 4 (CPU-bound)
- Process sentences in order

**Dependencies:** STORY-002, STORY-004
**FRs Covered:** FR-301, FR-302

---

#### STORY-015: Voice Selection UI
**Epic:** Voice Generation
**Priority:** Must Have
**Points:** 2

**User Story:**
As a creator, I want to select from different voices so I can pick one that fits my content.

**Acceptance Criteria:**
- [ ] Voice selector dropdown in project settings
- [ ] Options: Puck, Kore, Fenrir, Charon, Zephyr
- [ ] Voice preview samples (pre-recorded)
- [ ] Selected voice stored in project
- [ ] Voice passed to audio generation

**Technical Notes:**
- Store sample audio files in public/voices/

**Dependencies:** STORY-010
**FRs Covered:** FR-304

---

#### STORY-016: Bulk Audio Generation
**Epic:** Voice Generation
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to generate audio for all sentences at once so I can proceed efficiently.

**Acceptance Criteria:**
- [ ] "Generate All Audio" button in script editor
- [ ] Queues audio/generate events for all sentences
- [ ] Progress bar showing completion percentage
- [ ] Audio playback inline with each sentence
- [ ] Status indicators (pending/generating/complete)

**Technical Notes:**
- Queue events in order, Inngest handles parallelism

**Dependencies:** STORY-014, STORY-010
**FRs Covered:** FR-302

---

### EPIC-04: Image Generation (FR-4xx)

#### STORY-017: Image Prompt Generation
**Epic:** Image Generation
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want image prompts automatically generated from my script so I don't have to write them manually.

**Acceptance Criteria:**
- [ ] LLM generates image prompt from sentence text
- [ ] Includes character descriptions if in cast
- [ ] Includes visual style from project settings
- [ ] Stores imagePrompt on sentence record
- [ ] Editable in UI

**Technical Notes:**
- Use Deepseek for prompt generation
- Batch process to reduce API calls

**Dependencies:** STORY-005, STORY-013
**FRs Covered:** FR-403

---

#### STORY-018: Image Generation Job
**Epic:** Image Generation
**Priority:** Must Have
**Points:** 8

**User Story:**
As a creator, I want images generated via ComfyUI so I have visuals for each sentence.

**Acceptance Criteria:**
- [ ] Inngest image/generate function
- [ ] Loads appropriate ComfyUI workflow (Flux 2)
- [ ] Injects prompt, character refs, style LoRA
- [ ] 16:9 aspect ratio output
- [ ] Stores PNG in data/projects/{id}/images/
- [ ] Updates sentence.imageFile
- [ ] Progress updates via WebSocket

**Technical Notes:**
- Concurrency: 1 (GPU-bound)
- Workflow: workflows/image/flux-2.json

**Dependencies:** STORY-002, STORY-003, STORY-017
**FRs Covered:** FR-401, FR-402, FR-404, FR-407

---

#### STORY-019: Image Regeneration & Override
**Epic:** Image Generation
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to edit image prompts and regenerate individual images so I have creative control.

**Acceptance Criteria:**
- [ ] Edit imagePrompt field in scene inspector
- [ ] "Regenerate Image" button
- [ ] Only regenerates selected image
- [ ] Old image replaced with new
- [ ] Progress indicator during generation

**Technical Notes:**
- Triggers single image/generate event

**Dependencies:** STORY-018
**FRs Covered:** FR-406, FR-408

---

### EPIC-05: Video Generation (FR-5xx)

#### STORY-020: Video Generation Job
**Epic:** Video Generation
**Priority:** Must Have
**Points:** 8

**User Story:**
As a creator, I want images converted to video clips so my content has motion.

**Acceptance Criteria:**
- [ ] Inngest video/generate function
- [ ] Loads ComfyUI video workflow (WAN 2.2)
- [ ] Image-to-video with camera movement
- [ ] Motion strength parameter
- [ ] Stores MP4 in data/projects/{id}/videos/
- [ ] Updates sentence.videoFile
- [ ] Progress updates via WebSocket

**Technical Notes:**
- Concurrency: 1 (GPU-bound)
- Workflow: workflows/video/wan-2.2.json

**Dependencies:** STORY-002, STORY-003, STORY-018
**FRs Covered:** FR-501, FR-502, FR-506

---

#### STORY-021: Camera Movement Controls
**Epic:** Video Generation
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to select camera movements so each scene has appropriate motion.

**Acceptance Criteria:**
- [ ] Camera movement dropdown in scene inspector
- [ ] Options: Pan Right/Left, Zoom In/Out, Orbit, Truck, Static
- [ ] Motion strength slider (0-100%)
- [ ] Settings stored on sentence record
- [ ] Passed to video generation

**Technical Notes:**
- Default: Static, 50% strength

**Dependencies:** STORY-020
**FRs Covered:** FR-503, FR-504

---

#### STORY-022: Video Regeneration & Override
**Epic:** Video Generation
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to edit video prompts and regenerate individual videos so I can fine-tune motion.

**Acceptance Criteria:**
- [ ] Edit videoPrompt field in scene inspector
- [ ] "Regenerate Video" button
- [ ] Only regenerates selected video
- [ ] Old video replaced with new
- [ ] Progress indicator during generation

**Technical Notes:**
- Triggers single video/generate event

**Dependencies:** STORY-020
**FRs Covered:** FR-505, FR-508

---

### EPIC-06: Storyboard UI (FR-6xx)

#### STORY-023: Storyboard Table View
**Epic:** Storyboard UI
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want a table view of all scenes so I can see the linear flow.

**Acceptance Criteria:**
- [ ] Storyboard page with table layout
- [ ] Columns: #, Thumbnail, Narration, Section, Status
- [ ] Click row to select scene
- [ ] Section grouping headers
- [ ] Scroll to navigate long scripts

**Technical Notes:**
- Use virtualized list for 20+ min videos (400+ rows)

**Dependencies:** STORY-010, STORY-018
**FRs Covered:** FR-601

---

#### STORY-024: Storyboard Grid View
**Epic:** Storyboard UI
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want a grid view of all scenes so I can see the visual overview.

**Acceptance Criteria:**
- [ ] Toggle between table and grid views
- [ ] Grid shows: image thumbnail, narration excerpt, camera tag
- [ ] Cards grouped by section
- [ ] Click card to select scene
- [ ] Visual status indicators

**Technical Notes:**
- Responsive grid layout

**Dependencies:** STORY-023
**FRs Covered:** FR-602

---

#### STORY-025: Scene Inspector Panel
**Epic:** Storyboard UI
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want a scene inspector panel so I can view and edit scene details.

**Acceptance Criteria:**
- [ ] Right panel with IMAGE/VIDEO tabs
- [ ] Image tab: prompt (editable), style, regenerate button
- [ ] Video tab: prompt, camera movement, motion strength, regenerate
- [ ] Preview of current image/video
- [ ] Audio playback for sentence

**Technical Notes:**
- Slide-in panel on scene selection

**Dependencies:** STORY-023, STORY-019, STORY-022
**FRs Covered:** FR-603, FR-605

---

#### STORY-026: Section Navigation Sidebar
**Epic:** Storyboard UI
**Priority:** Must Have
**Points:** 2

**User Story:**
As a creator, I want section navigation so I can quickly jump to specific parts.

**Acceptance Criteria:**
- [ ] Left sidebar with section list
- [ ] Section titles with scene counts
- [ ] Click to scroll to section
- [ ] Progress indicator per section
- [ ] Collapsible on small screens

**Technical Notes:**
- Sticky sidebar

**Dependencies:** STORY-023
**FRs Covered:** FR-604

---

#### STORY-027: Bulk Scene Generation
**Epic:** Storyboard UI
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to generate all images and videos at once so I can proceed efficiently.

**Acceptance Criteria:**
- [ ] "Generate All Images" button
- [ ] "Generate All Videos" button
- [ ] "Generate All" (audio → images → videos)
- [ ] Overall progress indicator
- [ ] Cancellation support

**Technical Notes:**
- Queue all events at once

**Dependencies:** STORY-016, STORY-018, STORY-020
**FRs Covered:** FR-606

---

### EPIC-07: Export System (FR-7xx)

#### STORY-028: Export Service
**Epic:** Export System
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want to export all assets with proper naming so I can import into my video editor.

**Acceptance Criteria:**
- [ ] POST /api/projects/:id/export endpoint
- [ ] Creates folder structure: audio/, images/, videos/
- [ ] Sequential naming: 001_section-slug_type.ext
- [ ] Copies all generated files
- [ ] Creates script.txt
- [ ] Returns zip file path

**Technical Notes:**
- Use archiver for zip creation

**Dependencies:** STORY-018, STORY-020
**FRs Covered:** FR-701, FR-702, FR-703, FR-705

---

#### STORY-029: Export UI & Download
**Epic:** Export System
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want an export button that downloads my project assets as a zip file.

**Acceptance Criteria:**
- [ ] Export button in project header
- [ ] Progress indicator during export
- [ ] Automatic download of zip file
- [ ] Success notification with folder structure info
- [ ] Error handling with retry option

**Technical Notes:**
- Use browser download API

**Dependencies:** STORY-028
**FRs Covered:** FR-704

---

#### STORY-030: Export Metadata
**Epic:** Export System
**Priority:** Should Have
**Points:** 2

**User Story:**
As a creator, I want metadata.json included in exports so I have project information.

**Acceptance Criteria:**
- [ ] metadata.json in export root
- [ ] Includes: project name, sections, sentence count, timestamps
- [ ] Scene-by-scene data: text, duration, files
- [ ] Export timestamp

**Technical Notes:**
- JSON structure for potential re-import

**Dependencies:** STORY-028
**FRs Covered:** FR-706

---

### EPIC-08: Cascading Regeneration (FR-8xx)

#### STORY-031: Dependency Tracking
**Epic:** Cascading Regen
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want the system to track asset dependencies so changes cascade correctly.

**Acceptance Criteria:**
- [ ] Sentence tracks: audio, image, video file references
- [ ] "dirty" flags for each asset type
- [ ] When text changes: mark audio, image, video as dirty
- [ ] When imagePrompt changes: mark image, video as dirty
- [ ] When videoPrompt changes: mark video as dirty

**Technical Notes:**
- Add isDirty flags to sentence schema

**Dependencies:** STORY-001
**FRs Covered:** FR-801

---

#### STORY-032: Sentence Edit Regeneration
**Epic:** Cascading Regen
**Priority:** Must Have
**Points:** 5

**User Story:**
As a creator, I want only affected assets to regenerate when I edit a sentence so I save time.

**Acceptance Criteria:**
- [ ] Edit sentence text → marks audio/image/video dirty
- [ ] "Regenerate" button appears for dirty assets
- [ ] Bulk "Regenerate All Dirty" option
- [ ] Only queues events for dirty assets
- [ ] Clears dirty flags on completion

**Technical Notes:**
- Event chain: audio → image → video

**Dependencies:** STORY-031, STORY-014, STORY-018, STORY-020
**FRs Covered:** FR-802, FR-804

---

#### STORY-033: Prompt Edit Regeneration
**Epic:** Cascading Regen
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want downstream assets to regenerate when I edit a prompt.

**Acceptance Criteria:**
- [ ] Edit imagePrompt → mark image, video dirty
- [ ] Edit videoPrompt → mark video dirty
- [ ] Automatic regeneration option (toggle)
- [ ] Manual regeneration if auto disabled

**Technical Notes:**
- Use Inngest event chaining

**Dependencies:** STORY-031, STORY-019, STORY-022
**FRs Covered:** FR-805

---

### Polish & Integration Stories

#### STORY-034: Progress Dashboard
**Epic:** Polish
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want to see overall generation progress so I know when my project is ready.

**Acceptance Criteria:**
- [ ] Dashboard shows project status
- [ ] Per-stage progress: script, audio, images, videos
- [ ] Completion percentage
- [ ] Estimated time remaining
- [ ] Error count and retry options

**Technical Notes:**
- Subscribe to WebSocket events

**Dependencies:** STORY-007, STORY-027
**FRs Covered:** NFR-006

---

#### STORY-035: Error Handling & Retry UI
**Epic:** Polish
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want clear error messages and retry options so I can recover from failures.

**Acceptance Criteria:**
- [ ] Error state indicators on scenes
- [ ] Error message display in inspector
- [ ] "Retry" button for failed generations
- [ ] "Retry All Failed" bulk option
- [ ] Error log accessible

**Technical Notes:**
- Error messages from Inngest stored in DB

**Dependencies:** STORY-025
**FRs Covered:** NFR-004

---

#### STORY-036: Project Dashboard
**Epic:** Polish
**Priority:** Must Have
**Points:** 3

**User Story:**
As a creator, I want a dashboard to see all my projects so I can manage multiple productions.

**Acceptance Criteria:**
- [ ] Dashboard page as app home
- [ ] Project cards with thumbnail, name, status
- [ ] Create new project button
- [ ] Open existing project
- [ ] Delete project with confirmation

**Technical Notes:**
- Use first image as project thumbnail

**Dependencies:** STORY-008
**FRs Covered:** -

---

## Sprint Allocation

### Sprint 1 (Weeks 1-2) - Infrastructure & Foundation
**Goal:** Set up development infrastructure and core integrations

**Capacity:** 30 points
**Committed:** 27 points (90%)

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-001 | Project Setup & Database Schema | 5 | Must |
| STORY-002 | Inngest Job Queue Integration | 5 | Must |
| STORY-003 | ComfyUI Client Integration | 5 | Must |
| STORY-004 | Chatterbox TTS Client Integration | 3 | Must |
| STORY-005 | Deepseek API Client Integration | 3 | Must |
| STORY-007 | WebSocket Progress Server | 3 | Must |
| STORY-008 | Project CRUD API | 3 | Must |

**Sprint 1 Total:** 27 points

**Deliverables:**
- Backend running with all external service integrations
- Database schema deployed
- Can create projects via API
- All clients tested independently

**Risks:**
- ComfyUI setup complexity
- Docker network configuration

---

### Sprint 2 (Weeks 3-4) - Script & Audio
**Goal:** Complete script generation and audio pipeline

**Capacity:** 30 points
**Committed:** 33 points (110%) - *Consider moving 1 story to Sprint 3*

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-006 | Long-Form Script Generation | 5 | Must |
| STORY-009 | AI Script Generation | 5 | Must |
| STORY-010 | Script Editor Component | 5 | Must |
| STORY-011 | Character Library CRUD | 3 | Must |
| STORY-012 | Character Library UI | 3 | Must |
| STORY-013 | Project Cast Management | 2 | Must |
| STORY-014 | Audio Generation Job | 5 | Must |
| STORY-015 | Voice Selection UI | 2 | Must |
| STORY-016 | Bulk Audio Generation | 3 | Must |

**Sprint 2 Total:** 33 points

**Deliverables:**
- Can generate long-form scripts (1 min to 3 hours)
- Can generate script from topic
- Can edit script in UI
- Can manage characters
- Can generate audio for all sentences
- Audio playback working

**Dependencies:**
- Sprint 1 complete

---

### Sprint 3 (Weeks 5-6) - Image Generation
**Goal:** Complete image generation pipeline

**Capacity:** 30 points
**Committed:** 27 points (90%)

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-017 | Image Prompt Generation | 3 | Must |
| STORY-018 | Image Generation Job | 8 | Must |
| STORY-019 | Image Regeneration & Override | 3 | Must |
| STORY-023 | Storyboard Table View | 5 | Must |
| STORY-024 | Storyboard Grid View | 5 | Must |
| STORY-031 | Dependency Tracking | 3 | Must |

**Sprint 3 Total:** 27 points

**Deliverables:**
- Can generate images for all sentences
- Storyboard views working
- Can regenerate individual images
- Dependency tracking in place

**Dependencies:**
- Sprint 2 complete
- ComfyUI workflows tested

---

### Sprint 4 (Weeks 7-8) - Video Generation & UI
**Goal:** Complete video generation and scene inspector

**Capacity:** 30 points
**Committed:** 29 points (97%)

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-020 | Video Generation Job | 8 | Must |
| STORY-021 | Camera Movement Controls | 3 | Must |
| STORY-022 | Video Regeneration & Override | 3 | Must |
| STORY-025 | Scene Inspector Panel | 5 | Must |
| STORY-026 | Section Navigation Sidebar | 2 | Must |
| STORY-027 | Bulk Scene Generation | 3 | Must |
| STORY-032 | Sentence Edit Regeneration | 5 | Must |

**Sprint 4 Total:** 29 points

**Deliverables:**
- Can generate videos from images
- Camera movement controls working
- Scene inspector fully functional
- Can generate all assets in sequence
- Cascading regeneration working

**Dependencies:**
- Sprint 3 complete
- Video ComfyUI workflows tested

---

### Sprint 5 (Weeks 9-10) - Export & Polish
**Goal:** Complete export system and polish

**Capacity:** 30 points
**Committed:** 22 points (73%) + buffer

| Story | Title | Points | Priority |
|-------|-------|--------|----------|
| STORY-028 | Export Service | 5 | Must |
| STORY-029 | Export UI & Download | 3 | Must |
| STORY-030 | Export Metadata | 2 | Should |
| STORY-033 | Prompt Edit Regeneration | 3 | Must |
| STORY-034 | Progress Dashboard | 3 | Must |
| STORY-035 | Error Handling & Retry UI | 3 | Must |
| STORY-036 | Project Dashboard | 3 | Must |

**Sprint 5 Total:** 22 points

**Buffer:** 8 points for bug fixes, polish, unforeseen issues

**Deliverables:**
- Can export all assets as zip
- NLE-compatible folder structure
- Project dashboard
- Progress tracking
- Error handling complete
- MVP ready for personal use!

**Dependencies:**
- Sprint 4 complete

---

## Epic Traceability

| Epic ID | Epic Name | Stories | Total Points | Sprints |
|---------|-----------|---------|--------------|---------|
| EPIC-00 | Infrastructure | 001-007 | 29 | 1-2 |
| EPIC-01 | Script Management | 008-010 | 13 | 1-2 |
| EPIC-02 | Character System | 011-013 | 8 | 2 |
| EPIC-03 | Voice Generation | 014-016 | 10 | 2 |
| EPIC-04 | Image Generation | 017-019 | 14 | 3 |
| EPIC-05 | Video Generation | 020-022 | 14 | 4 |
| EPIC-06 | Storyboard UI | 023-027 | 20 | 3-4 |
| EPIC-07 | Export System | 028-030 | 10 | 5 |
| EPIC-08 | Cascading Regen | 031-033 | 11 | 3-4 |
| EPIC-09 | Polish | 034-036 | 9 | 5 |

---

## Functional Requirements Coverage

| FR ID | Requirement | Story | Sprint |
|-------|-------------|-------|--------|
| FR-101 | AI script generation | STORY-009 | 2 |
| FR-102 | Manual script editing | STORY-010 | 2 |
| FR-103 | Auto-segmentation | STORY-009 | 2 |
| FR-104 | Sentence-level granularity | STORY-009, 009 | 2 |
| FR-105 | Search grounding toggle | STORY-009 | 2 |
| FR-106 | Target duration selection | STORY-008 | 1 |
| FR-107 | Visual style presets | STORY-008 | 1 |
| FR-201 | Character library | STORY-011, 011 | 2 |
| FR-202 | LoRA support | STORY-011 | 2 |
| FR-203 | Character descriptions | STORY-011, 011 | 2 |
| FR-204 | Add to project cast | STORY-013 | 2 |
| FR-301 | TTS via Chatterbox | STORY-014 | 2 |
| FR-302 | Audio per sentence | STORY-014, 015 | 2 |
| FR-303 | Auto-regeneration | STORY-032 | 4 |
| FR-304 | Voice selection | STORY-015 | 2 |
| FR-401 | ComfyUI integration | STORY-018 | 3 |
| FR-402 | Multiple image models | STORY-018 | 3 |
| FR-403 | Auto prompt generation | STORY-017 | 3 |
| FR-404 | Character reference injection | STORY-018 | 3 |
| FR-405 | Style LoRA application | STORY-018 | 3 |
| FR-406 | Manual prompt override | STORY-019 | 3 |
| FR-407 | 16:9 aspect ratio | STORY-018 | 3 |
| FR-408 | Regenerate individual images | STORY-019 | 3 |
| FR-501 | ComfyUI video workflow | STORY-020 | 4 |
| FR-502 | Image-to-video | STORY-020 | 4 |
| FR-503 | Camera movement presets | STORY-021 | 4 |
| FR-504 | Motion strength control | STORY-021 | 4 |
| FR-505 | Manual video prompt override | STORY-022 | 4 |
| FR-506 | Multiple video models | STORY-020 | 4 |
| FR-507 | 20 min combined video | STORY-020 | 4 |
| FR-508 | Regenerate individual videos | STORY-022 | 4 |
| FR-601 | Table view | STORY-023 | 3 |
| FR-602 | Grid view | STORY-024 | 3 |
| FR-603 | Scene inspector | STORY-025 | 4 |
| FR-604 | Section navigation | STORY-026 | 4 |
| FR-605 | Regenerate buttons | STORY-025 | 4 |
| FR-606 | Generate scenes from script | STORY-027 | 4 |
| FR-701 | Sequential file naming | STORY-028 | 5 |
| FR-702 | Batch export | STORY-028 | 5 |
| FR-703 | Folder structure | STORY-028 | 5 |
| FR-704 | NLE-compatible | STORY-029 | 5 |
| FR-705 | Include script.txt | STORY-028 | 5 |
| FR-706 | Include metadata.json | STORY-030 | 5 |
| FR-801 | Track dependencies | STORY-031 | 3 |
| FR-802 | Minimal regeneration | STORY-032 | 4 |
| FR-803 | Section edit regen | STORY-032 | 4 |
| FR-804 | Sentence edit regen | STORY-032 | 4 |
| FR-805 | Prompt edit regen | STORY-033 | 5 |

**Coverage:** 100% of Must Have FRs (45/45)

---

## Risks and Mitigation

### High Priority

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| ComfyUI workflow failures | Image/video generation broken | Medium | Test workflows early; have fallback models |
| GPU memory issues | Generation crashes | Medium | Sequential processing; monitor VRAM |
| Chatterbox voice quality | User dissatisfaction | Low | Test all voices; allow selection |

### Medium Priority

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Deepseek API changes | Script generation breaks | Low | Abstract client; version pin |
| Long generation times | Poor UX | Medium | Progress indicators; background processing |
| Character consistency | Visual inconsistency | Medium | Reference images; test with multiple characters |

### Low Priority

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Browser compatibility | UI issues | Low | Test on Chrome, Firefox, Edge |
| Large project handling | Performance issues | Low | Virtualized lists; pagination |

---

## Dependencies

### External Dependencies

| Dependency | Required By | Status |
|------------|-------------|--------|
| ComfyUI installed + models | Sprint 3 | Setup needed |
| Chatterbox Docker image | Sprint 2 | Setup needed |
| Deepseek API key | Sprint 2 | Have key |
| ComfyUI workflows (Flux, WAN) | Sprint 3-4 | Create workflows |

### Infrastructure Dependencies

| Dependency | Required By | Status |
|------------|-------------|--------|
| Node.js 20+ | Sprint 1 | Installed |
| Docker | Sprint 1 | Installed |
| GPU with 8GB+ VRAM | Sprint 3 | Available |

---

## Definition of Done

For a story to be considered complete:

- [ ] Code implemented and committed to main branch
- [ ] Unit tests for new functions (≥80% coverage)
- [ ] Integration tests for API endpoints
- [ ] Manual testing of user flow
- [ ] No console errors or warnings
- [ ] Code reviewed (self-review for solo dev)
- [ ] Works with existing features (regression check)
- [ ] Acceptance criteria validated

---

## Sprint Ceremonies

**Sprint Length:** 2 weeks (10 working days)

| Ceremony | When | Duration |
|----------|------|----------|
| Sprint Planning | Monday, Week 1 | 1 hour |
| Daily Standup | Each morning | 15 min (self-check) |
| Sprint Review | Friday, Week 2 | 30 min |
| Retrospective | Friday, Week 2 | 30 min |

---

## Next Steps

**Immediate:** Begin Sprint 1

1. Set up development environment
2. Initialize database schema
3. Integrate Inngest
4. Build external service clients

**Commands:**
- `/dev-story STORY-001` - Start implementing first story
- `/create-story STORY-001` - Generate detailed story document
- `/sprint-status` - Check current sprint progress

---

**This plan was created using BMAD Method v6 - Phase 4 (Implementation Planning)**

*Run `/workflow-status` to see your progress and next recommended workflow.*
