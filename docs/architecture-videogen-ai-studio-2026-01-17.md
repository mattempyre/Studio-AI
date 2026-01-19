# System Architecture: VideoGen AI Studio

**Date:** 2026-01-19 (Updated)
**Architect:** System Architect (BMAD)
**Version:** 1.1
**Status:** Approved

> **Changelog v1.1 (2026-01-19):**
> - Added new database tables: `generationModels`, `visualStyles`
> - Added WhisperClient for audio transcription/alignment
> - Added new services: audioAlignment, fileStorage, videoPromptService
> - Added new Inngest functions for prompt generation and batch audio
> - Added new API routes: sections, sentences, models, styles, prompts
> - Updated frontend component inventory with StyleBuilder, karaoke features
> - Added new event types for batch audio and prompt generation

---

## Executive Summary

This document defines the system architecture for VideoGen AI Studio, an end-to-end AI video creation platform. The architecture prioritizes **local-first processing**, **extensibility**, and **cloud-readiness** while supporting the generation of videos up to 3 hours in length.

**Key Architectural Decisions:**
- Modular monolith with clear service boundaries (easy to split later)
- Event-driven background processing via Inngest
- Local GPU utilization for all generation tasks
- WebSocket-based real-time progress updates
- Auth-ready design without current implementation

---

## Table of Contents

1. [Architectural Drivers](#1-architectural-drivers)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Technology Stack](#3-technology-stack)
4. [System Components](#4-system-components)
5. [Data Architecture](#5-data-architecture)
6. [API Architecture](#6-api-architecture)
7. [NFR Solutions](#7-nfr-solutions)
8. [Security Architecture](#8-security-architecture)
9. [Scalability & Performance](#9-scalability--performance)
10. [Reliability & Operations](#10-reliability--operations)
11. [Development & Deployment](#11-development--deployment)
12. [Traceability](#12-traceability)
13. [Trade-offs & Decisions](#13-trade-offs--decisions)

---

## 1. Architectural Drivers

These NFRs most significantly influence architectural decisions:

| Priority | NFR ID | Requirement | Architectural Impact |
|----------|--------|-------------|---------------------|
| **Critical** | NFR-002 | Local GPU processing | All generation via local ComfyUI/Chatterbox |
| **Critical** | NFR-003 | Parallel job processing | Inngest durable job queue required |
| **Critical** | NFR-005 | Job persistence | Inngest + SQLite job tracking |
| **High** | NFR-001 | 3-hour video support | ~2700 sentences, efficient pagination |
| **High** | NFR-007 | UI responsiveness | Async processing, WebSocket updates |
| **High** | NFR-012 | Local-first | Only Deepseek API is cloud-based |
| **Medium** | NFR-008/009 | Model extensibility | Modular workflow architecture |
| **Medium** | NFR-006 | Progress indicators | WebSocket real-time events |

---

## 2. High-Level Architecture

### 2.1 Architectural Pattern

**Pattern:** Modular Monolith with Event-Driven Background Processing

**Rationale:**
- Simple deployment for local use (single process + Docker services)
- Clear module boundaries allow future service extraction
- Event-driven jobs decouple long-running generation from API
- Easier to develop and debug than microservices

### 2.2 System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER CLIENT                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │ Dashboard │ │ScriptEdit │ │Storyboard │ │StyleBuild │ │VoiceOver  │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ HTTP/WebSocket
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EXPRESS SERVER (:3001)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API LAYER                                    │   │
│  │  /projects /characters /sections /sentences /models /styles /prompts│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      SERVICE LAYER                                   │   │
│  │  JobService  PromptService  AudioAlignment  VideoPromptService      │   │
│  │  OutputPaths  FileStorage                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CLIENT LAYER                                    │   │
│  │  DeepseekClient  ComfyUIClient  ChatterboxClient  WhisperClient     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       DATA LAYER                                     │   │
│  │  Drizzle ORM  SQLite Database  File Storage                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────┬───────────────────┬────────────────────────────┘
                             │                   │
              ┌──────────────┘                   └──────────────┐
              ▼                                                 ▼
┌──────────────────────────┐                     ┌──────────────────────────┐
│    INNGEST (:8288)       │                     │     SQLITE DATABASE      │
│    Job Orchestration     │                     │     data/studio.db       │
│  ┌────────────────────┐  │                     │  ┌────────────────────┐  │
│  │ script/generate    │  │                     │  │ projects           │  │
│  │ script/generate-   │  │                     │  │ sections           │  │
│  │   long             │  │                     │  │ sentences          │  │
│  │ audio/generate     │  │                     │  │ characters         │  │
│  │ audio/generate-    │  │                     │  │ generation_jobs    │  │
│  │   section          │  │                     │  │ script_outlines    │  │
│  │ prompts/generate-  │  │                     │  │ generation_models  │  │
│  │   image            │  │                     │  │ visual_styles      │  │
│  │ prompts/generate-  │  │                     │  │ project_cast       │  │
│  │   video            │  │                     │  └────────────────────┘  │
│  │ image/generate     │  │                     └──────────────────────────┘
│  │ video/generate     │  │
│  │ export/start       │  │
│  └────────────────────┘  │
└──────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICES (LOCAL)                             │
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │ COMFYUI (:8188)  │ │CHATTERBOX(:8004) │ │ WHISPER (:8005)  │            │
│  │ • Image Gen      │ │ • Text-to-Speech │ │ • Transcription  │            │
│  │ • Video Gen      │ │ • Voice Selection│ │ • Word Timing    │            │
│  │ • Flux 2, WAN2.2 │ │ • WAV Output     │ │ • Audio Align    │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                     DEEPSEEK (Cloud)                                  │  │
│  │  • Script Generation • Outline Creation • Prompt Generation          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        FILE STORAGE                                   │  │
│  │  data/projects/{projectId}/audio/  images/  videos/                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

```
User Input (Topic/Script)
        │
        ▼
┌───────────────────┐      ┌───────────────────┐
│ 1. Script Gen     │─────▶│ Deepseek API      │
│    (outline +     │◀─────│ (cloud)           │
│     sections)     │      └───────────────────┘
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐      ┌───────────────────┐
│ 2. Audio Gen      │─────▶│ Chatterbox TTS    │
│    (per sentence) │◀─────│ (local Docker)    │
└─────────┬─────────┘      └───────────────────┘
          │
          ▼
┌───────────────────┐      ┌───────────────────┐
│ 3. Image Gen      │─────▶│ ComfyUI           │
│    (per sentence) │◀─────│ (local GPU)       │
└─────────┬─────────┘      └───────────────────┘
          │
          ▼
┌───────────────────┐      ┌───────────────────┐
│ 4. Video Gen      │─────▶│ ComfyUI           │
│    (from images)  │◀─────│ (local GPU)       │
└─────────┬─────────┘      └───────────────────┘
          │
          ▼
┌───────────────────┐
│ 5. Export         │─────▶ ZIP file download
│    (all assets)   │
└───────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Framework** | React 19 | Modern, component-based, large ecosystem |
| **Language** | TypeScript | Type safety, better DX, refactoring support |
| **Build Tool** | Vite | Fast HMR, ESM-native, simple config |
| **Styling** | Tailwind CSS (CDN) | Rapid prototyping, utility-first |
| **Icons** | Lucide React | Consistent, lightweight icon set |
| **State** | Lifted state + useRef | Simple for single-user app |

**Trade-offs:**
- ✓ Fast development, no complex state management
- ✗ Would need Redux/Zustand for multi-user or complex state

### 3.2 Backend

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Runtime** | Node.js 20+ | JavaScript ecosystem, async I/O |
| **Framework** | Express 4 | Mature, simple, well-documented |
| **Language** | TypeScript | Type safety across full stack |
| **ORM** | Drizzle | Type-safe, lightweight, SQLite support |
| **Validation** | Zod | Runtime validation with TypeScript inference |
| **Hot Reload** | tsx | Fast TypeScript execution |

**Trade-offs:**
- ✓ Fast development, shared types with frontend
- ✗ CPU-bound work less efficient than Go/Rust (but GPU does heavy lifting)

### 3.3 Database

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Database** | SQLite | Local-first, zero config, file-based |
| **ORM** | Drizzle ORM | Type-safe queries, migrations |
| **Viewer** | Drizzle Studio | Visual DB inspection |

**Trade-offs:**
- ✓ Simple deployment, no separate DB server
- ✗ Would need PostgreSQL for cloud/multi-user (easy migration with Drizzle)

### 3.4 Job Queue

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Orchestration** | Inngest | Durable workflows, retries, concurrency control |
| **Deployment** | Docker | Local dev server, self-hostable |

**Trade-offs:**
- ✓ Durable jobs, automatic retries, step functions
- ✗ Additional Docker container required

### 3.5 External Services

| Service | Technology | Local/Cloud | Port | Purpose |
|---------|------------|-------------|------|---------|
| **Script Gen** | Deepseek API | Cloud | - | LLM for script/outline/prompt generation |
| **Image Gen** | ComfyUI | Local | 8188 | Flux 2, image workflows |
| **Video Gen** | ComfyUI | Local | 8188 | WAN 2.2, video workflows |
| **TTS** | Chatterbox | Local | 8004 | Text-to-speech generation |
| **Transcription** | Whisper | Local | 8005 | Audio transcription with word-level timing |

> **Note:** Whisper is used for batch audio alignment - when generating audio for an entire section at once, Whisper provides word-level timestamps to align sentences with their audio segments, enabling karaoke-style highlighting.

### 3.6 Infrastructure

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Containerization** | Docker Compose | Service orchestration |
| **File Storage** | Local filesystem | Simple, fast, no config |
| **Real-time** | WebSocket (ws) | Bidirectional progress updates |

---

## 4. System Components

### 4.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND COMPONENTS                         │
├─────────────────────────────────────────────────────────────────┤
│  App.tsx              │ Root, global state, routing             │
│  Dashboard.tsx        │ Project list, create new                │
│  ScriptEditorV2/      │ Script generation, editing, audio       │
│   ├─ Header.tsx       │  Header with project controls           │
│   ├─ Sidebar.tsx      │  Section navigation                     │
│   ├─ SectionCard.tsx  │  Section display and edit               │
│   ├─ SentenceRow.tsx  │  Sentence editing                       │
│   ├─ AudioPlayer.tsx  │  Audio playback controls                │
│   ├─ AudioToolbar.tsx │  Audio generation controls              │
│   ├─ KaraokeText.tsx  │  Word-level highlighting                │
│   └─ PromptsPanel.tsx │  Image/video prompt editing             │
│  Storyboard.tsx       │ Visual scene management                 │
│  VideoPreview.tsx     │ Timeline preview (future)               │
│  VoiceOver.tsx        │ Audio management                        │
│  StyleBuilder/        │ Model and style management              │
│   ├─ ModelGallery.tsx │  Available models grid                  │
│   ├─ ModelCard.tsx    │  Model display                          │
│   ├─ ModelForm.tsx    │  Model editing form                     │
│   ├─ StyleGallery.tsx │  Available styles grid                  │
│   ├─ StyleCard.tsx    │  Style display                          │
│   └─ StyleForm.tsx    │  Style editing form                     │
│  CharacterLibrary/    │ Character management                    │
│   ├─ CharacterGrid.tsx│  Character list                         │
│   ├─ CharacterCard.tsx│  Character display                      │
│   └─ CharacterModal   │  Character create/edit                  │
│  Layout.tsx           │ Navigation, header                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND COMPONENTS                          │
├─────────────────────────────────────────────────────────────────┤
│  API Layer            │                                         │
│  ├─ projects.ts       │ Project CRUD, cast management           │
│  ├─ characters.ts     │ Character library management            │
│  ├─ sections.ts       │ Section CRUD                            │
│  ├─ sentences.ts      │ Sentence CRUD                           │
│  ├─ scripts.ts        │ Script/outline generation triggers      │
│  ├─ images.ts         │ Image generation triggers               │
│  ├─ prompts.ts        │ Prompt generation triggers              │
│  ├─ models.ts         │ Generation models CRUD                  │
│  ├─ styles.ts         │ Visual styles CRUD                      │
│  ├─ health.ts         │ Health checks                           │
│  └─ inngest.ts        │ Inngest webhook handler                 │
├─────────────────────────────────────────────────────────────────┤
│  Service Layer        │                                         │
│  ├─ jobService.ts     │ Job status tracking                     │
│  ├─ outputPaths.ts    │ File path generation                    │
│  ├─ promptService.ts  │ Image prompt generation logic           │
│  ├─ videoPromptSvc.ts │ Video prompt generation logic           │
│  ├─ audioAlignment.ts │ Whisper-based sentence alignment        │
│  └─ fileStorage.ts    │ File storage utilities                  │
├─────────────────────────────────────────────────────────────────┤
│  Client Layer         │                                         │
│  ├─ deepseek.ts       │ Script/outline/prompt generation        │
│  ├─ comfyui.ts        │ Image/video generation                  │
│  ├─ chatterbox.ts     │ TTS generation                          │
│  └─ whisper.ts        │ Audio transcription & alignment         │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer           │                                         │
│  ├─ schema.ts         │ Drizzle table definitions               │
│  ├─ index.ts          │ Database connection                     │
│  └─ seed.ts           │ Database seeding                        │
├─────────────────────────────────────────────────────────────────┤
│  Inngest Layer        │                                         │
│  ├─ client.ts         │ Inngest client, event types             │
│  └─ functions/        │ Job handlers (see 4.2.6)                │
├─────────────────────────────────────────────────────────────────┤
│  WebSocket Layer      │                                         │
│  ├─ server.ts         │ WebSocket server setup                  │
│  ├─ broadcast.ts      │ Event broadcasting utilities            │
│  └─ types.ts          │ Message type definitions                │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Component Details

#### 4.2.1 API Gateway (Express Server)

**Purpose:** Single entry point for all client requests

**Responsibilities:**
- REST API routing
- Request validation (Zod schemas)
- Error handling and formatting
- WebSocket upgrade handling
- Inngest webhook endpoint

**Interfaces:**
- HTTP REST API (port 3001)
- WebSocket (port 3001, /ws path)
- Inngest webhook (/api/v1/inngest)

**FRs Addressed:** All (entry point for all features)

---

#### 4.2.2 DeepseekClient

**Purpose:** LLM integration for script generation

**Responsibilities:**
- Script generation from topics
- Outline generation for long-form content
- Section-by-section generation with context
- Running summary compression
- Retry logic and error handling

**Interfaces:**
```typescript
class DeepseekClient {
  generateScript(options: ScriptGenerationOptions): Promise<GeneratedScript>
  generateOutline(options: OutlineOptions): Promise<ScriptOutline>
  generateSectionWithContext(context: SectionContext): Promise<GeneratedSection>
  compressSummary(summary: string, section: GeneratedSection): Promise<string>
}
```

**Dependencies:** Deepseek API (cloud)

**FRs Addressed:** FR-101, FR-103, FR-104, FR-105, FR-106

---

#### 4.2.3 ChatterboxClient

**Purpose:** Text-to-speech generation

**Responsibilities:**
- Convert text to speech audio
- Voice selection
- WAV file output
- Duration extraction

**Interfaces:**
```typescript
class ChatterboxClient {
  generateSpeech(params: SpeechGenerationParams): Promise<SpeechGenerationResult>
  getVoices(): Promise<VoiceInfo[]>
  healthCheck(): Promise<boolean>
}
```

**Dependencies:** Chatterbox Docker container (local)

**FRs Addressed:** FR-301, FR-302, FR-304

---

#### 4.2.4 WhisperClient (NEW)

**Purpose:** Audio transcription with word-level timing

**Responsibilities:**
- Transcribe audio files to text
- Provide word-level timestamps
- Support sentence alignment for batch audio

**Interfaces:**
```typescript
class WhisperClient {
  transcribe(audioPath: string, language?: string): Promise<TranscriptionResult>
  healthCheck(): Promise<boolean>
  getInfo(): Promise<{ model: string; device: string; computeType: string }>
}

interface TranscriptionResult {
  text: string;
  language: string;
  duration: number;
  segments: SegmentTiming[];
  words: WordTiming[];  // For sentence alignment
}
```

**Dependencies:** Whisper Docker container (local, port 8005)

**FRs Addressed:** FR-302 (enhanced audio alignment), karaoke highlighting

---

#### 4.2.5 ComfyUIClient

**Purpose:** Image and video generation via ComfyUI workflows

**Responsibilities:**
- Queue workflow execution
- Progress polling via WebSocket
- File download and storage
- Workflow parameter injection
- Multiple model support

**Interfaces:**
```typescript
class ComfyUIClient {
  generateImage(params: ImageGenerationParams): Promise<string>
  generateVideo(params: VideoGenerationParams): Promise<string>
  getProgress(promptId: string): Promise<ProgressInfo>
}
```

**Dependencies:** ComfyUI (local GPU)

**FRs Addressed:** FR-401, FR-402, FR-501, FR-502, FR-503, FR-504, FR-506

---

#### 4.2.5 JobService

**Purpose:** Track generation job status

**Responsibilities:**
- Create job records
- Update job progress
- Query job status
- Handle job completion/failure

**Interfaces:**
```typescript
class JobService {
  createJob(params: CreateJobParams): Promise<GenerationJob>
  updateProgress(jobId: string, progress: number): Promise<void>
  completeJob(jobId: string, result: JobResult): Promise<void>
  failJob(jobId: string, error: string): Promise<void>
  getJobsByProject(projectId: string): Promise<GenerationJob[]>
}
```

**FRs Addressed:** NFR-003, NFR-005, NFR-006

---

#### 4.2.7 Inngest Functions

**Purpose:** Durable background job execution

**Implemented Functions:**

| Function | Trigger Event | Purpose | Concurrency |
|----------|---------------|---------|-------------|
| `helloFunction` | `test/hello` | Test Inngest connectivity | 1 |
| `generateScriptFunction` | `script/generate` | Short-form script (<10 min) | 1 |
| `generateLongScriptFunction` | `script/generate-long` | Long-form script (up to 3 hr) | 1 |
| `generateOutlineOnlyFunction` | `script/generate-long` (mode: outline) | Generate outline without full script | 1 |
| `generateAudioFunction` | `audio/generate` | TTS for single sentence | 4 |
| `generateSectionAudioFunction` | `audio/generate-section` | Batch TTS for entire section | 2 |
| `retroactiveAudioAlignmentFunction` | `audio/retroactive-align` | Align existing audio with Whisper | 2 |
| `generateImagePromptsFunction` | `prompts/generate-image` | LLM-generated image prompts | 1 |
| `generateVideoPromptsFunction` | `prompts/generate-video` | LLM-generated video prompts | 1 |
| `generateImageFunction` | `image/generate` | Image for single sentence | 1 |

**Planned Functions (TODO):**

| Function | Trigger Event | Purpose | Concurrency |
|----------|---------------|---------|-------------|
| `generateVideo` | `video/generate` | Video from image | 1 |
| `exportProject` | `export/start` | Bundle all assets | 1 |

**FRs Addressed:** NFR-003, NFR-005, FR-302, FR-401, FR-501, FR-702

---

## 5. Data Architecture

### 5.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│    projects     │       │   characters    │       │generation_models│
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)         │       │ id (PK)         │
│ name            │       │ name            │       │ name            │
│ topic           │       │ description     │       │ description     │
│ targetDuration  │       │ referenceImages │       │ workflowFile    │
│ modelId (FK)    │───────│ styleLora       │       │ workflowCategory│
│ styleId (FK)    │─┐     │ createdAt       │       │ workflowType    │
│ visualStyle*    │ │     └────────┬────────┘       │ defaultSteps    │
│ voiceId         │ │              │                │ defaultCfg      │
│ status          │ │              │                │ defaultFrames   │
│ createdAt       │ │              │                │ defaultFps      │
│ updatedAt       │ │              │                │ isActive        │
└────────┬────────┘ │              │                └─────────────────┘
         │          │              │
         │          │  ┌───────────┴────────────────┐
         │          │  │       project_cast         │
         │          │  ├────────────────────────────┤
         │          │  │ projectId (FK)             │
         │          │  │ characterId (FK)           │
         │          │  └────────────────────────────┘
         │          │
         │          │  ┌─────────────────┐
         │          └─▶│  visual_styles  │
         │             ├─────────────────┤
         │             │ id (PK)         │
         │             │ name            │
         │             │ description     │
         │             │ styleType       │
         │             │ promptPrefix    │
         │             │ loraFile        │
         │             │ loraStrength    │
         │             │ compatibleModels│
         │             │ requiresCharRef │
         │             │ isActive        │
         │             └─────────────────┘
         │
         │    ┌─────────────────┐
         │    │ script_outlines │
         │    ├─────────────────┤
         ├───▶│ id (PK)         │
         │    │ projectId (FK)  │
         │    │ title           │
         │    │ topic           │
         │    │ totalTargetMins │
         │    │ visualStyle     │
         │    │ sections (JSON) │
         │    │ runningSummary  │
         │    │ coveredTopics   │
         │    │ currentSectionIdx│
         │    │ status          │
         │    └─────────────────┘
         │
         │    ┌─────────────────┐       ┌─────────────────────┐
         │    │    sections     │       │     sentences       │
         │    ├─────────────────┤       ├─────────────────────┤
         └───▶│ id (PK)         │──────▶│ id (PK)             │
              │ projectId (FK)  │       │ sectionId (FK)      │
              │ title           │       │ text                │
              │ order           │       │ order               │
              │ createdAt       │       │ imagePrompt         │
              └─────────────────┘       │ videoPrompt         │
                                        │ cameraMovement      │
                                        │ motionStrength      │
                                        │ audioFile           │
                                        │ audioDuration       │
                                        │ audioStartMs (NEW)  │
                                        │ audioEndMs (NEW)    │
                                        │ sectionAudioFile(NEW)│
                                        │ wordTimings (NEW)   │
                                        │ imageFile           │
                                        │ videoFile           │
                                        │ isAudioDirty        │
                                        │ isImageDirty        │
                                        │ isVideoDirty        │
                                        │ status              │
                                        └─────────────────────┘

┌─────────────────┐
│ generation_jobs │
├─────────────────┤
│ id (PK)         │
│ sentenceId (FK) │
│ projectId (FK)  │
│ outlineId (FK)  │
│ jobType         │
│ status          │
│ progress        │
│ totalSteps      │
│ currentStep     │
│ stepName        │
│ inngestRunId    │
│ errorMessage    │
│ resultFile      │
│ startedAt       │
│ completedAt     │
│ createdAt       │
└─────────────────┘

* visualStyle is legacy field, kept for backwards compatibility
```

### 5.2 Table Definitions

```typescript
// projects - Main container for video projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  topic: text('topic'),
  targetDuration: integer('target_duration').notNull().default(8),
  visualStyle: text('visual_style').notNull().default('cinematic'),
  voiceId: text('voice_id').default('puck'),
  status: text('status').notNull().default('draft'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// sections - Logical groupings within a script
export const sections = sqliteTable('sections', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// sentences - Individual units mapped to visuals
export const sentences = sqliteTable('sentences', {
  id: text('id').primaryKey(),
  sectionId: text('section_id').references(() => sections.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  order: integer('order').notNull(),
  imagePrompt: text('image_prompt'),
  videoPrompt: text('video_prompt'),
  cameraMovement: text('camera_movement').default('static'),
  motionStrength: real('motion_strength').default(0.5),
  audioFile: text('audio_file'),
  audioDuration: integer('audio_duration'),
  imageFile: text('image_file'),
  videoFile: text('video_file'),
  isAudioDirty: integer('is_audio_dirty', { mode: 'boolean' }).default(true),
  isImageDirty: integer('is_image_dirty', { mode: 'boolean' }).default(true),
  isVideoDirty: integer('is_video_dirty', { mode: 'boolean' }).default(true),
  status: text('status').default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// script_outlines - Long-form script planning (STORY-006)
export const scriptOutlines = sqliteTable('script_outlines', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  totalTargetMinutes: integer('total_target_minutes').notNull(),
  sections: text('sections', { mode: 'json' }).$type<SectionOutline[]>(),
  runningSummary: text('running_summary'),
  coveredTopics: text('covered_topics', { mode: 'json' }).$type<string[]>(),
  currentSectionIndex: integer('current_section_index').default(0),
  status: text('status').default('draft'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// generation_jobs - Background job tracking
export const generationJobs = sqliteTable('generation_jobs', {
  id: text('id').primaryKey(),
  sentenceId: text('sentence_id').references(() => sentences.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  jobType: text('job_type').notNull(),
  status: text('status').default('queued'),
  progress: integer('progress').default(0),
  totalSteps: integer('total_steps'),
  currentStep: integer('current_step'),
  stepName: text('step_name'),
  inngestRunId: text('inngest_run_id'),
  errorMessage: text('error_message'),
  resultFile: text('result_file'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// characters - Reusable character library
export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  referenceImages: text('reference_images', { mode: 'json' }).$type<string[]>(),
  styleLora: text('style_lora'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// project_cast - Many-to-many projects <-> characters
export const projectCast = sqliteTable('project_cast', {
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  characterId: text('character_id').references(() => characters.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.projectId, table.characterId] }),
}));

// NEW: generation_models - ComfyUI workflow configurations
export const generationModels = sqliteTable('generation_models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  workflowFile: text('workflow_file'), // Path to ComfyUI workflow JSON
  workflowCategory: text('workflow_category').notNull().default('image'), // 'image' | 'video'
  workflowType: text('workflow_type').notNull().default('text-to-image'), // 'text-to-image' | 'image-to-image' | 'image-to-video'
  defaultSteps: integer('default_steps').default(4),
  defaultCfg: real('default_cfg').default(1.0),
  defaultFrames: integer('default_frames'), // For video models
  defaultFps: integer('default_fps'), // For video models
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// NEW: visual_styles - Prompt prefixes and LoRA configurations
export const visualStyles = sqliteTable('visual_styles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  styleType: text('style_type').notNull().default('prompt'), // 'prompt' | 'lora'
  promptPrefix: text('prompt_prefix'), // For prompt-based styles
  loraFile: text('lora_file'), // For LoRA-based styles
  loraStrength: real('lora_strength').default(1.0),
  compatibleModels: text('compatible_models', { mode: 'json' }).$type<string[]>().default([]),
  requiresCharacterRef: integer('requires_character_ref', { mode: 'boolean' }).notNull().default(false),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
```

### 5.3 File Storage Structure

```
data/
├── studio.db                      # SQLite database
├── characters/
│   └── {characterId}/
│       └── ref_{n}.png            # Character reference images
└── projects/
    └── {projectId}/
        ├── audio/
        │   └── {sentenceId}.wav   # Generated speech
        ├── images/
        │   └── {sentenceId}.png   # Generated images
        └── videos/
            └── {sentenceId}.mp4   # Generated videos
```

---

## 6. API Architecture

### 6.1 API Design Principles

- **RESTful** resource-oriented design
- **JSON** request/response format
- **Zod** validation on all inputs
- **Consistent** error response format
- **Versioned** endpoints (`/api/v1/`)

### 6.2 API Endpoints

#### Projects

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| GET | `/api/v1/projects` | List all projects | FR-107 |
| POST | `/api/v1/projects` | Create new project | FR-106, FR-107 |
| GET | `/api/v1/projects/:id` | Get project with sections/sentences | - |
| PUT | `/api/v1/projects/:id` | Update project metadata | - |
| DELETE | `/api/v1/projects/:id` | Delete project and assets | - |

#### Script Generation

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| POST | `/api/v1/projects/:id/generate-outline` | Generate script outline | FR-101, FR-103 |
| POST | `/api/v1/projects/:id/generate-script` | Generate full script | FR-101, FR-104 |
| GET | `/api/v1/projects/:id/generation-status` | SSE stream for progress | NFR-006 |

#### Sentences

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| PUT | `/api/v1/sentences/:id` | Update sentence text/prompts | FR-102, FR-406, FR-505 |
| POST | `/api/v1/sentences/:id/regenerate` | Regenerate specific assets | FR-408, FR-508 |

#### Audio Generation

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| POST | `/api/v1/projects/:id/generate-audio` | Generate all audio | FR-302 |
| POST | `/api/v1/sentences/:id/generate-audio` | Generate single audio | FR-302 |

#### Image Generation

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| POST | `/api/v1/projects/:id/generate-images` | Generate all images | FR-606 |
| POST | `/api/v1/sentences/:id/generate-image` | Generate single image | FR-408 |

#### Video Generation

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| POST | `/api/v1/projects/:id/generate-videos` | Generate all videos | FR-606 |
| POST | `/api/v1/sentences/:id/generate-video` | Generate single video | FR-508 |

#### Sections (NEW)

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| GET | `/api/v1/sections/:id` | Get section with sentences | - |
| PUT | `/api/v1/sections/:id` | Update section | - |
| DELETE | `/api/v1/sections/:id` | Delete section | - |
| POST | `/api/v1/sections/:id/generate-audio` | Generate audio for section | FR-302 |

#### Sentences (NEW)

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| GET | `/api/v1/sentences/:id` | Get sentence details | - |
| PUT | `/api/v1/sentences/:id` | Update sentence text/prompts | FR-102, FR-406, FR-505 |
| DELETE | `/api/v1/sentences/:id` | Delete sentence | - |
| POST | `/api/v1/sentences/:id/regenerate` | Regenerate specific assets | FR-408, FR-508 |

#### Characters

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| GET | `/api/v1/characters` | List all characters | FR-201 |
| POST | `/api/v1/characters` | Create character | FR-201, FR-203 |
| PUT | `/api/v1/characters/:id` | Update character | FR-203 |
| DELETE | `/api/v1/characters/:id` | Delete character | - |
| POST | `/api/v1/projects/:id/cast` | Add character to project | FR-204 |
| DELETE | `/api/v1/projects/:id/cast/:characterId` | Remove from cast | FR-204 |

#### Generation Models (NEW - Style Builder)

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| GET | `/api/v1/models` | List all generation models | NFR-008 |
| POST | `/api/v1/models` | Create generation model | NFR-008 |
| GET | `/api/v1/models/:id` | Get model details | - |
| PUT | `/api/v1/models/:id` | Update model | NFR-008 |
| DELETE | `/api/v1/models/:id` | Delete model | - |

#### Visual Styles (NEW - Style Builder)

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| GET | `/api/v1/styles` | List all visual styles | FR-107 |
| POST | `/api/v1/styles` | Create visual style | FR-107 |
| GET | `/api/v1/styles/:id` | Get style details | - |
| PUT | `/api/v1/styles/:id` | Update style | FR-107 |
| DELETE | `/api/v1/styles/:id` | Delete style | - |

#### Prompt Generation (NEW)

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| POST | `/api/v1/projects/:id/prompts/image` | Generate image prompts for project | FR-403 |
| POST | `/api/v1/projects/:id/prompts/video` | Generate video prompts for project | FR-403 |

#### Export (Planned)

| Method | Endpoint | Description | FRs |
|--------|----------|-------------|-----|
| POST | `/api/v1/projects/:id/export` | Start export job | FR-702 |
| GET | `/api/v1/exports/:id/download` | Download export zip | FR-702 |

#### Health & WebSocket

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| WS | `/ws` | WebSocket connection for real-time updates |

### 6.3 WebSocket Events

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
  jobType: 'script' | 'script-long' | 'audio' | 'audio-section' |
           'image' | 'image-prompts' | 'video' | 'video-prompts' | 'export';
  progress: number;
  message?: string;
  stepName?: string;      // For multi-step jobs
  currentStep?: number;
  totalSteps?: number;
}

interface JobCompleteEvent {
  type: 'job_complete';
  jobId: string;
  jobType: string;
  sentenceId?: string;
  sectionId?: string;     // NEW: For section-level audio
  result: {
    file?: string;
    duration?: number;
    wordTimings?: Array<{  // NEW: For karaoke highlighting
      word: string;
      startMs: number;
      endMs: number;
    }>;
  };
}

interface JobFailedEvent {
  type: 'job_failed';
  jobId: string;
  jobType: string;
  error: string;
}
```

### 6.4 Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;          // e.g., 'VALIDATION_ERROR', 'NOT_FOUND'
    message: string;       // Human-readable message
    details?: unknown;     // Additional context (validation errors, etc.)
  };
}
```

---

## 7. NFR Solutions

### NFR-001: Performance (20-minute → 3-hour video support)

**Requirement:** Support combined video length up to 3 hours (~2700 sentences)

**Solution:**
- Efficient database queries with proper indexing
- Pagination for sentence lists (100 per page)
- Virtualized rendering in frontend lists
- Lazy loading of generated assets
- Efficient outline-based generation (STORY-006)

**Implementation:**
```sql
-- Indexes for efficient queries
CREATE INDEX idx_sections_project ON sections(project_id, "order");
CREATE INDEX idx_sentences_section ON sentences(section_id, "order");
CREATE INDEX idx_jobs_project ON generation_jobs(project_id, status);
```

**Validation:** Load test with 2700-sentence project

---

### NFR-002: Local GPU Processing

**Requirement:** Full GPU utilization for generation

**Solution:**
- ComfyUI handles all GPU workloads
- Sequential processing prevents GPU memory exhaustion
- Configurable concurrency limits

**Implementation:**
```typescript
// Inngest concurrency configuration
const imageGeneration = inngest.createFunction(
  { id: 'image-generate', concurrency: { limit: 1 } }, // GPU-bound
  { event: 'image/generate' },
  async ({ event, step }) => { /* ... */ }
);
```

**Validation:** Monitor GPU utilization during generation

---

### NFR-003: Parallel Job Processing

**Requirement:** Process jobs via Inngest queue

**Solution:**
- Inngest for durable job orchestration
- Concurrency limits per job type:
  - Audio: 4 (CPU-bound)
  - Image: 1 (GPU-bound)
  - Video: 1 (GPU-bound)
  - Script: 1 (API rate limits)

**Validation:** Run mixed workload, verify parallel audio with sequential GPU jobs

---

### NFR-004: Graceful Error Handling

**Requirement:** Retry logic, clear error messages

**Solution:**
- Inngest automatic retries (3 attempts, exponential backoff)
- Error messages stored in `generation_jobs` table
- Frontend displays errors with retry option
- Circuit breaker for external services

**Implementation:**
```typescript
const audioGeneration = inngest.createFunction(
  {
    id: 'audio-generate',
    retries: 3,
    backoff: { type: 'exponential', base: '10s' }
  },
  // ...
);
```

**Validation:** Simulate failures, verify retry behavior

---

### NFR-005: Job Queue Persistence

**Requirement:** Jobs survive app restart

**Solution:**
- Inngest maintains job state independently
- Job records in SQLite track status
- On restart, Inngest resumes pending jobs
- Frontend queries job status on reconnect

**Validation:** Kill server mid-generation, restart, verify resume

---

### NFR-006: Progress Indicators

**Requirement:** Show generation progress for all assets

**Solution:**
- WebSocket broadcasts progress events
- Per-job progress (0-100%)
- Per-project aggregate progress
- Step-level detail for multi-step jobs

**Implementation:**
```typescript
// Broadcast progress
function broadcastProgress(projectId: string, event: ProgressEvent) {
  const clients = projectSubscriptions.get(projectId) || [];
  clients.forEach(ws => ws.send(JSON.stringify(event)));
}
```

**Validation:** Generate project, verify real-time UI updates

---

### NFR-007: UI Responsiveness

**Requirement:** UI remains responsive during generation

**Solution:**
- All generation is async (Inngest background jobs)
- Optimistic UI updates
- Web Workers for heavy frontend computation (future)
- Debounced saves

**Validation:** Interact with UI during generation, verify no blocking

---

### NFR-008/009: Model Extensibility

**Requirement:** Easy to add new image/video models

**Solution:**
- Workflow JSON files define generation pipelines
- Model selection passed as parameter
- New models = new workflow file + UI option

**Structure:**
```
workflows/
├── image/
│   ├── flux-2.json
│   ├── qwen.json
│   └── z-image-turbo.json
└── video/
    ├── wan-2.2.json
    └── ltx-2.json
```

**Validation:** Add new model workflow, verify it works without code changes

---

### NFR-010: NLE Compatibility

**Requirement:** Export compatible with DaVinci, Premiere, FCP

**Solution:**
- Sequential file naming: `001_section-slug_audio.wav`
- Standard formats: WAV (audio), PNG (images), MP4 (video)
- Organized folder structure
- EDL/XML export (future enhancement)

**Validation:** Import export into DaVinci Resolve, verify proper ordering

---

### NFR-011: Versioned Workflows

**Requirement:** Versioned ComfyUI workflows

**Solution:**
- Workflow JSON files stored in `workflows/` directory
- Version in filename: `flux-2-v1.json`
- Workflow version tracked per generated asset
- Git-tracked for history

**Validation:** Compare workflow versions, verify reproducibility

---

### NFR-012: Local-First / Cost Optimization

**Requirement:** Minimize cloud API costs

**Solution:**
- Only Deepseek API is cloud-based
- All generation (TTS, image, video) runs locally
- Deepseek costs: ~$0.03-0.10 per 3-hour script
- Cache script outlines for regeneration

**Validation:** Monitor Deepseek API costs per project

---

## 8. Security Architecture

### 8.1 Current State (Local-Only)

For MVP local deployment, security is minimal:

- No authentication required
- CORS allows localhost only
- No sensitive data encryption
- File access limited to data directory

### 8.2 Auth-Ready Design

The architecture is designed for easy auth addition:

```typescript
// Middleware placeholder for future auth
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Currently: pass-through
  // Future: JWT validation, session check
  next();
}

// Route protection ready
router.use('/api/v1/projects', authMiddleware, projectsRouter);
```

### 8.3 Future Auth Implementation (SaaS)

When converting to SaaS:

1. **Authentication:** JWT tokens via Auth0 or custom
2. **Authorization:** User owns projects, RBAC for teams
3. **Multi-tenancy:** Add `userId` to all tables
4. **API Keys:** For programmatic access
5. **Rate Limiting:** Per-user request limits

```typescript
// Future schema additions
export const projects = sqliteTable('projects', {
  // ... existing fields
  userId: text('user_id').notNull(), // Add for multi-tenancy
  organizationId: text('organization_id'), // Optional team support
});
```

### 8.4 Security Best Practices (Applied)

| Practice | Implementation |
|----------|----------------|
| Input validation | Zod schemas on all endpoints |
| SQL injection prevention | Drizzle ORM parameterized queries |
| Path traversal prevention | Validated file paths in outputPaths.ts |
| Error information leakage | Generic errors in production |
| Dependency security | Regular npm audit |

---

## 9. Scalability & Performance

### 9.1 Current Capacity (Local)

| Metric | Capacity |
|--------|----------|
| Concurrent projects | 1 (single user) |
| Max project size | 3 hours (~2700 sentences) |
| Parallel audio jobs | 4 |
| Parallel GPU jobs | 1 |

### 9.2 Performance Optimizations

**Database:**
- Indexed queries for common access patterns
- Batch inserts for script generation
- Efficient dirty flag queries

**Generation:**
- Sequential GPU jobs prevent memory exhaustion
- Audio parallelization (CPU-bound)
- Progress polling vs. push (ComfyUI limitation)

**Frontend:**
- Virtualized lists for long scripts
- Lazy image loading
- Debounced saves

### 9.3 Cloud Scaling Path

When moving to cloud:

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLOUD ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Users     │───▶│   CDN       │───▶│  Frontend   │        │
│  └─────────────┘    └─────────────┘    │  (Vercel)   │        │
│                                         └──────┬──────┘        │
│                                                │               │
│                                                ▼               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                   API GATEWAY                            │  │
│  │                 (AWS API Gateway)                        │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                          │                                     │
│            ┌─────────────┼─────────────┐                      │
│            ▼             ▼             ▼                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │  Backend     │ │  Inngest     │ │  PostgreSQL  │          │
│  │  (ECS/K8s)   │ │  (Managed)   │ │  (RDS)       │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│            │                                                   │
│            ▼                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              GPU WORKERS (Spot Instances)                 │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │ │
│  │  │ ComfyUI │  │ ComfyUI │  │ ComfyUI │  │ TTS     │     │ │
│  │  │ Worker  │  │ Worker  │  │ Worker  │  │ Worker  │     │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │ │
│  └──────────────────────────────────────────────────────────┘ │
│            │                                                   │
│            ▼                                                   │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                    S3 (File Storage)                      │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Reliability & Operations

### 10.1 Error Handling

| Layer | Strategy |
|-------|----------|
| API | Try-catch with consistent error format |
| Inngest | Automatic retries with exponential backoff |
| External services | Circuit breaker pattern |
| Database | Transaction rollback on failure |

### 10.2 Logging

```typescript
// Structured logging format
interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: {
    projectId?: string;
    jobId?: string;
    sentenceId?: string;
    error?: string;
  };
}
```

### 10.3 Health Checks

| Endpoint | Checks |
|----------|--------|
| `/health` | Server running |
| `/health/db` | Database connection |
| `/health/comfyui` | ComfyUI reachable |
| `/health/chatterbox` | Chatterbox reachable |

### 10.4 Backup Strategy

**Local:**
- SQLite file backup (simple copy)
- Generated assets in `data/projects/`

**Future (Cloud):**
- PostgreSQL automated backups
- S3 versioning for assets

---

## 11. Development & Deployment

### 11.1 Development Environment

```bash
# Start all services
npm run dev:all

# Individual services
npm run dev          # Frontend (Vite, :3000)
npm run server       # Backend (Express, :3001)
docker-compose up inngest  # Inngest (:8288)
```

### 11.2 Project Structure

```
├── src/
│   └── backend/
│       ├── api/           # REST endpoints
│       ├── clients/       # External service clients
│       ├── db/            # Database schema & connection
│       ├── inngest/       # Job functions
│       ├── services/      # Business logic
│       └── server.ts      # Express entry point
├── components/            # React components
├── services/              # Frontend services
├── types.ts               # Shared types
├── App.tsx                # Root component
├── index.tsx              # Entry point
├── data/                  # SQLite DB & generated files
├── workflows/             # ComfyUI workflow JSONs
└── tests/                 # Test files
```

### 11.3 Testing Strategy

| Type | Tools | Coverage Target |
|------|-------|-----------------|
| Unit | Vitest | 80% for services/clients |
| Integration | Supertest | All API endpoints |
| E2E | (Future) Playwright | Critical user flows |

### 11.4 CI/CD Pipeline (Future)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test
      - run: npm run build
```

---

## 12. Traceability

### 12.1 FR to Component Mapping

| FR ID | Requirement | Components |
|-------|-------------|------------|
| FR-101 | AI script generation | DeepseekClient, API/projects |
| FR-102 | Manual script editing | Frontend/ScriptEditor, API/sentences |
| FR-103 | Auto-segmentation | DeepseekClient |
| FR-104 | Sentence-level granularity | Schema/sentences, API |
| FR-105 | Search grounding toggle | DeepseekClient |
| FR-106 | Target duration selection | Schema/projects, Frontend |
| FR-107 | Visual style presets | Schema/projects, Frontend |
| FR-201 | Character library | Schema/characters, API/characters |
| FR-202 | LoRA support | Schema/characters, ComfyUIClient |
| FR-203 | Character descriptions | Schema/characters, API |
| FR-204 | Project cast | Schema/projectCast, API |
| FR-301 | TTS via Chatterbox | ChatterboxClient, Inngest/audio |
| FR-302 | Audio per sentence | Inngest/audio, JobService |
| FR-303 | Auto-regeneration | API/sentences (dirty flags) |
| FR-304 | Voice selection | Schema/projects, ChatterboxClient |
| FR-401 | ComfyUI integration | ComfyUIClient |
| FR-402 | Multiple image models | Workflows, ComfyUIClient |
| FR-403 | Auto prompt generation | DeepseekClient |
| FR-404 | Character reference injection | ComfyUIClient |
| FR-405 | Style LoRA application | ComfyUIClient |
| FR-406 | Manual prompt override | API/sentences, Frontend |
| FR-407 | 16:9 aspect ratio | ComfyUI workflows |
| FR-408 | Regenerate individual images | API/sentences, Inngest/image |
| FR-501 | ComfyUI video workflow | ComfyUIClient, Workflows |
| FR-502 | Image-to-video | Inngest/video |
| FR-503 | Camera movement presets | Schema/sentences, ComfyUIClient |
| FR-504 | Motion strength control | Schema/sentences, ComfyUIClient |
| FR-505 | Manual video prompt override | API/sentences |
| FR-506 | Multiple video models | Workflows |
| FR-507 | 20 min combined video | Full pipeline |
| FR-508 | Regenerate individual videos | API/sentences, Inngest/video |
| FR-601 | Table view | Frontend/Storyboard |
| FR-602 | Grid view | Frontend/Storyboard |
| FR-603 | Scene inspector | Frontend/Storyboard |
| FR-604 | Section navigation | Frontend/Storyboard |
| FR-605 | Regenerate buttons | Frontend/Storyboard |
| FR-606 | Generate scenes from script | API, Inngest bulk jobs |
| FR-701 | Sequential file naming | ExportService |
| FR-702 | Batch export | Inngest/export |
| FR-703 | Folder structure | ExportService |
| FR-704 | NLE compatibility | ExportService |
| FR-705 | Include script.txt | ExportService |
| FR-706 | Include metadata.json | ExportService |
| FR-801 | Track dependencies | Schema (dirty flags) |
| FR-802 | Minimal regeneration | API/sentences, Inngest |
| FR-803 | Section edit triggers regen | API/sentences |
| FR-804 | Sentence edit triggers regen | API/sentences |
| FR-805 | Prompt edit triggers regen | API/sentences |

### 12.2 NFR to Solution Mapping

| NFR ID | Requirement | Solution |
|--------|-------------|----------|
| NFR-001 | 3-hour video support | Efficient queries, pagination, virtualization |
| NFR-002 | Local GPU processing | ComfyUI local instance |
| NFR-003 | Parallel job processing | Inngest with concurrency limits |
| NFR-004 | Graceful error handling | Retries, error storage, UI feedback |
| NFR-005 | Job persistence | Inngest + SQLite job tracking |
| NFR-006 | Progress indicators | WebSocket real-time events |
| NFR-007 | UI responsiveness | Async jobs, optimistic updates |
| NFR-008 | Image model extensibility | Workflow JSON files |
| NFR-009 | Video model extensibility | Workflow JSON files |
| NFR-010 | NLE compatibility | Standard formats, sequential naming |
| NFR-011 | Versioned workflows | Git-tracked JSON files |
| NFR-012 | Local-first / cost | Only Deepseek is cloud-based |

---

## 13. Trade-offs & Decisions

### Decision 1: Modular Monolith vs Microservices

**Choice:** Modular Monolith

**Trade-offs:**
- ✓ Simple deployment (single process)
- ✓ Easy debugging and development
- ✓ No distributed system complexity
- ✗ Harder to scale individual components
- ✗ Single point of failure

**Rationale:** For single-user local deployment, simplicity outweighs scaling benefits. Module boundaries allow future extraction.

---

### Decision 2: SQLite vs PostgreSQL

**Choice:** SQLite

**Trade-offs:**
- ✓ Zero configuration
- ✓ File-based (easy backup)
- ✓ Fast for single-user workloads
- ✗ Single-writer limitation
- ✗ No built-in replication

**Rationale:** Perfect for local single-user. Drizzle ORM makes PostgreSQL migration trivial when needed.

---

### Decision 3: WebSocket vs SSE for Progress

**Choice:** WebSocket

**Trade-offs:**
- ✓ Bidirectional communication
- ✓ Can send subscription messages
- ✓ Better reconnection handling
- ✗ More complex than SSE
- ✗ Requires upgrade handling

**Rationale:** Bidirectional allows client to subscribe to specific projects, more flexible for future features.

---

### Decision 4: Inngest vs BullMQ/Custom Queue

**Choice:** Inngest

**Trade-offs:**
- ✓ Durable step functions
- ✓ Automatic retries
- ✓ Built-in concurrency control
- ✓ Great dashboard for debugging
- ✗ Additional Docker container
- ✗ Less control than custom solution

**Rationale:** Durability and step functions are essential for long-running generation jobs. Dashboard accelerates debugging.

---

### Decision 5: Local Generation vs Cloud APIs

**Choice:** Local (ComfyUI, Chatterbox) + Minimal Cloud (Deepseek)

**Trade-offs:**
- ✓ Low ongoing costs
- ✓ No rate limits for generation
- ✓ Full control over models
- ✗ Requires capable GPU
- ✗ More setup complexity

**Rationale:** Cost-effective for heavy use. Only script generation (text) uses cloud API (~$0.03-0.10 per 3-hour script).

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Sentence** | Smallest unit of content, maps to one visual |
| **Section** | Logical grouping of sentences (chapter) |
| **Dirty Flag** | Indicates asset needs regeneration |
| **Outline** | Plan for long-form script with section targets |
| **Running Summary** | Compressed context from previous sections |
| **Workflow** | ComfyUI JSON defining generation pipeline |

---

## Appendix B: Related Documents

- [PRD](./prd-videogen-ai-studio-2026-01-16.md)
- [Product Brief](./product-brief-videogen-ai-studio-2026-01-16.md)
- [Sprint Plan](./sprint-plan-videogen-ai-studio-2026-01-16.md)
- [STORY-006: Long-Form Script Generation](./stories/STORY-006-long-form-script-generation.md)
- [Research: Long-Form Script Generation](./research-long-form-script-generation.md)

---

## Appendix C: Implementation Status (as of 2026-01-19)

### ✅ Fully Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | ✅ Complete | All 8 tables implemented including new models/styles tables |
| API Routes | ✅ Complete | 12 route modules (projects, characters, sections, sentences, scripts, images, models, styles, prompts, health, inngest) |
| External Clients | ✅ Complete | Deepseek, ComfyUI, Chatterbox, Whisper |
| WebSocket | ✅ Complete | Real-time progress updates with project subscriptions |
| Script Generation | ✅ Complete | Short-form, long-form with outline support |
| Audio Generation | ✅ Complete | Per-sentence and per-section batch modes with karaoke support |
| Image Prompts | ✅ Complete | LLM-generated image prompts |
| Video Prompts | ✅ Complete | LLM-generated video prompts |
| Image Generation | ✅ Complete | Via ComfyUI workflows |
| Style Builder UI | ✅ Complete | Models and styles CRUD |
| Character Library | ✅ Complete | CRUD with reference images |

### 🚧 Partially Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| VideoPreview | 🚧 Planned | Timeline editor not yet implemented |

> **Note:** Storyboard UI (EPIC-06) was completed during earlier development:
> - ✅ Table view, Grid view, Scene inspector panel, Section navigation sidebar - all done

### ❌ Not Yet Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Video Generation | ❌ TODO | Inngest function exists in events but handler not implemented |
| Export Service | ❌ TODO | Export to ZIP with NLE-compatible structure |
| Export UI | ❌ TODO | Download and progress tracking |

### 📝 New Features Not in Original Architecture

| Feature | Description |
|---------|-------------|
| Whisper Integration | Audio transcription for sentence alignment and karaoke highlighting |
| Batch Audio Generation | Generate TTS for entire section at once (more natural flow) |
| Word-level Timing | Karaoke-style highlighting during audio playback |
| Generation Models Table | Database-driven ComfyUI workflow configurations |
| Visual Styles Table | Database-driven prompt prefixes and LoRA configurations |
| Style Builder | Admin UI for managing models and styles |
| Retroactive Audio Alignment | Align existing audio with sentences using Whisper |

---

*Created by BMAD Method v6 - System Architect*
*Architecture Version: 1.1*
*Last Updated: 2026-01-19*
