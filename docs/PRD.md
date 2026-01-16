# Studio AI - Product Requirements Document

**AI-Powered Video Creation Platform**  
Version 1.0 MVP | January 2026

---

## Table of Contents

1. [Core Architecture](#1-core-architecture)
2. [Feature Requirements](#2-feature-requirements)
3. [Technical Architecture](#3-technical-architecture)
4. [MVP Scope & Prioritization](#4-mvp-scope--prioritization)
5. [User Interface Specifications](#5-user-interface-specifications)
6. [Risks & Mitigations](#6-risks--mitigations)
7. [Open Questions](#7-open-questions)
8. [Appendices](#appendices)

---

## 1. Core Architecture

### 1.1 Script as Source of Truth

The script is the authoritative data source. All other assets (audio, images, videos) are derived from and linked to specific script segments.

**Dependency Graph:**
```
Project
└── Section[]
    └── Sentence[]
        ├── Audio Segment
        ├── Image
        │   └── Video Clip
        └── Prompts (image, video)
```

### 1.2 Cascading Regeneration Logic

When script content changes, the system determines the minimal set of assets requiring regeneration:

| Change Type | Regeneration Scope |
|-------------|-------------------|
| Entire section modified | All images, videos, and audio for that section |
| Single sentence edited | Only image, video, and audio for that sentence |
| Image prompt manually modified | Only that image and its derived video |
| Video prompt manually modified | Only that video |

### 1.3 Scene Segmentation

The AI automatically segments scripts into logical sections during generation:

- Each **section** has a descriptive title (e.g., "Introduction & Hook", "Technology Deep Dive")
- Each **sentence** within a section becomes a discrete visual unit
- This ensures visuals change frequently enough to maintain viewer engagement while respecting narrative structure

---

## 2. Feature Requirements

### 2.1 Script Generation & Management

#### Requirements

- AI script generation using Deepseek via API
- Manual script entry and editing
- Auto-segmentation into sections with descriptive titles
- Sentence-level granularity for visual generation
- Search grounding toggle for fact-checking via web search integration
- Target duration selection (8m, 15m, 30m, 1h, 1h30m, 2h)
- Visual style presets (Cinematic, Documentary, Abstract, etc.)

#### User Stories

> As a creator, I want to enter a topic and have AI generate a complete, segmented script so I can quickly start production.

> As a creator, I want the script to be fact-checked against current information so my content is accurate.

> As a creator, I want to edit individual sentences without regenerating the entire video so I can iterate efficiently.

#### Data Model

```typescript
interface ScriptSection {
  id: string;
  title: string;
  order: number;
  sentences: Sentence[];
}

interface Sentence {
  id: string;
  text: string;
  order: number;
  imagePrompt?: string;
  videoPrompt?: string;
  audioFile?: string;
  imageFile?: string;
  videoFile?: string;
  cameraMovement?: CameraMovement;
  visualStyle?: string;
}
```

---

### 2.2 Cast & Character System

#### Requirements

- Character library with reference images for visual consistency
- LoRA support for style consistency (e.g., Family Guy style, photorealistic documentary)
- Character descriptions stored with reference images
- Ability to add characters to project cast for inclusion in generated visuals

#### MVP Scope

- Single voice for narration (Chatterbox TTS)
- Multiple characters supported for visual generation only

#### Data Model

```typescript
interface Character {
  id: string;
  name: string;
  description: string;
  referenceImages: string[];  // file paths
  styleLora?: string;         // LoRA identifier
}

interface ProjectCast {
  projectId: string;
  characters: Character[];
}
```

---

### 2.3 Voice Generation

#### Requirements

- Text-to-speech via locally hosted Chatterbox TTS (Docker)
- Audio generated per sentence for granular sync
- Automatic regeneration when associated script text changes
- Voice selection from platform voices (Puck, Kore, Fenrir, Charon, Zephyr)
- Future: Voice cloning capability

#### API Integration

```typescript
interface TTSRequest {
  text: string;
  voice: 'puck' | 'kore' | 'fenrir' | 'charon' | 'zephyr';
  outputFormat: 'wav';
}

interface TTSResponse {
  audioFile: Buffer;
  duration: number;  // milliseconds
}
```

---

### 2.4 Image Generation

#### Requirements

- ComfyUI integration via custom workflows called by API
- Initial model support: Flux 2, Z Image Turbo, Qwen
- Automatic prompt generation from script sentences
- Character reference image injection for consistency
- Style LoRA application based on project visual style
- Manual prompt override and regeneration per image
- 16:9 aspect ratio (9:16 support planned for future)
- Extensible architecture to add new models

#### Workflow Structure

```
Input:
├── Sentence text
├── Character reference images (optional)
├── Style LoRA (optional)
└── Visual style preset

Process:
├── LLM generates image prompt from sentence
├── ComfyUI workflow selected based on model/style
└── Image generated with character/style conditioning

Output:
├── Generated image (PNG)
└── Stored prompt for reference/editing
```

---

### 2.5 Video Generation

#### Requirements

- ComfyUI integration via custom workflows
- Initial model support: WAN 2.2, LTX-2
- Image-to-video generation from generated stills
- Camera movement presets:
  - Pan Right / Pan Left
  - Zoom In / Zoom Out
  - Orbit
  - Truck Left / Truck Right
  - Static
- Motion strength control (slider)
- Manual prompt override and regeneration per video
- Support for combined video length up to 20 minutes
- Future: Premium cloud models (Kling, VEO)

#### Camera Movement Enum

```typescript
type CameraMovement = 
  | 'pan_right' 
  | 'pan_left' 
  | 'zoom_in' 
  | 'zoom_out' 
  | 'orbit' 
  | 'truck_left' 
  | 'truck_right' 
  | 'static';
```

---

### 2.6 Storyboard View

#### Requirements

- **Table view:** Linear list with narration text and thumbnails
- **Grid view:** Card-based layout showing image, narration, camera movement, and style
- Scene Inspector panel for detailed image/video settings
- Section navigation sidebar
- Regenerate individual images or videos
- "Generate Scenes from Script" action
- "Preview Full Video" capability

#### Scene Inspector Panel

```
┌─────────────────────────────┐
│ IMAGE                 VIDEO │  ← Tab selector
├─────────────────────────────┤
│ IMAGE PROMPT                │
│ [Editable text area]        │
│                             │
│ [Regenerate Image]          │
├─────────────────────────────┤
│ VISUAL STYLE                │
│ [Dropdown: Cinematic ▼]     │
└─────────────────────────────┘

┌─────────────────────────────┐
│ IMAGE                 VIDEO │  ← Tab selector (VIDEO active)
├─────────────────────────────┤
│ VIDEO PROMPT                │
│ [Editable text area]        │
├─────────────────────────────┤
│ CAMERA MOVEMENT             │
│ [Dropdown: Pan Right ▼]     │
├─────────────────────────────┤
│ MOTION STRENGTH             │
│ [━━━━━━━●━━━━━━]            │
├─────────────────────────────┤
│ [Generate Video]            │
└─────────────────────────────┘
```

---

### 2.7 Export System (MVP Priority)

#### Requirements

- Sequential file naming convention for NLE compatibility
- Naming format: `{sequence}_{section-slug}_{type}.{ext}`
- Batch export of all images, videos, and audio files
- Export to organized folder structure
- Compatible with DaVinci Resolve, Premiere Pro, Final Cut Pro

#### File Naming Convention

```
001_intro-hook_image.png
001_intro-hook_video.mp4
001_intro-hook_audio.wav
002_intro-hook_image.png
002_intro-hook_video.mp4
002_intro-hook_audio.wav
...
007_tech-deep-dive_image.png
007_tech-deep-dive_video.mp4
007_tech-deep-dive_audio.wav
```

#### Export Folder Structure

```
project-name/
├── audio/
│   ├── 001_intro-hook_audio.wav
│   ├── 002_intro-hook_audio.wav
│   └── ...
├── images/
│   ├── 001_intro-hook_image.png
│   ├── 002_intro-hook_image.png
│   └── ...
├── videos/
│   ├── 001_intro-hook_video.mp4
│   ├── 002_intro-hook_video.mp4
│   └── ...
└── script.txt
```

---

### 2.8 Video Editor (Post-MVP)

A full video editor with the following features is planned for a future release:

- Timeline with multiple tracks
- Music track layer
- SFX track layer
- Text overlays
- Final render export

The MVP focuses on generating and exporting assets for use in external editing software.

---

## 3. Technical Architecture

### 3.1 System Overview

Studio AI runs as a local application with a web-based frontend. All AI processing occurs on the user's local hardware, with GPU acceleration for image and video generation.

```
┌─────────────────────────────────────────────────────────┐
│                    Web Frontend                          │
│              (React/Next.js Application)                 │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Backend API                            │
│               (Node.js/Python)                           │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                    Inngest                               │
│              (Job Queue Manager)                         │
└───┬─────────────┬─────────────┬─────────────┬───────────┘
    │             │             │             │
┌───▼───┐   ┌─────▼─────┐   ┌───▼───┐   ┌─────▼─────┐
│Deepseek│   │Chatterbox │   │ComfyUI│   │  ComfyUI  │
│  API   │   │TTS Docker │   │ Image │   │   Video   │
└────────┘   └───────────┘   └───────┘   └───────────┘
```

### 3.2 Technology Stack

| Component | Technology |
|-----------|------------|
| Script Generation | Deepseek API |
| Text-to-Speech | Chatterbox TTS (local Docker) |
| Image Generation | ComfyUI (Flux 2, Z Image Turbo, Qwen) |
| Video Generation | ComfyUI (WAN 2.2, LTX-2) |
| Job Queue | Inngest |
| Character Consistency | Reference images + LoRAs for style |

### 3.3 Processing Pipeline

The system uses Inngest for job queue management, enabling parallel processing where possible.

#### Pipeline Stages

1. **Script Processing:** Parse script into sections and sentences, generate metadata
2. **Audio Generation:** Generate TTS for all sentences (parallelizable)
3. **Prompt Generation:** Create image prompts from sentences using LLM
4. **Image Generation:** Generate images via ComfyUI (parallelizable based on GPU capacity)
5. **Video Prompt Generation:** Create video prompts including camera movements
6. **Video Generation:** Generate videos from images via ComfyUI

#### Inngest Job Structure

```typescript
// Example Inngest function for image generation
inngest.createFunction(
  { id: "generate-image" },
  { event: "studio/image.generate" },
  async ({ event, step }) => {
    const { sentenceId, prompt, characterRefs, styleLora } = event.data;
    
    // Call ComfyUI workflow
    const image = await step.run("comfyui-generate", async () => {
      return await comfyuiClient.runWorkflow("image-generation", {
        prompt,
        characterRefs,
        styleLora,
        aspectRatio: "16:9"
      });
    });
    
    // Store result
    await step.run("store-image", async () => {
      return await storage.saveImage(sentenceId, image);
    });
    
    // Trigger video generation
    await step.sendEvent("studio/video.generate", {
      sentenceId,
      imageFile: image.path
    });
  }
);
```

### 3.4 ComfyUI Integration

Custom ComfyUI workflows are pre-built and called via API. The system does not dynamically construct workflows.

#### Workflow Management

- Workflows stored as JSON files
- Selected based on chosen model and style parameters
- Versioned for stability
- Allows fine-tuned optimization of each workflow

#### API Interface

```typescript
interface ComfyUIClient {
  runWorkflow(
    workflowName: string,
    inputs: WorkflowInputs
  ): Promise<WorkflowOutput>;
  
  getProgress(jobId: string): Promise<ProgressInfo>;
  
  cancelJob(jobId: string): Promise<void>;
}

interface WorkflowInputs {
  prompt: string;
  negativePrompt?: string;
  characterRefs?: string[];
  styleLora?: string;
  aspectRatio: '16:9' | '9:16';
  // Video-specific
  sourceImage?: string;
  cameraMovement?: CameraMovement;
  motionStrength?: number;
}
```

### 3.5 Data Model

#### Project

```typescript
interface Project {
  id: string;
  name: string;
  targetDuration: number;  // minutes
  visualStyle: VisualStyle;
  cast: Character[];
  sections: Section[];
  createdAt: Date;
  updatedAt: Date;
}

type VisualStyle = 
  | 'cinematic' 
  | 'documentary' 
  | 'abstract' 
  | 'cyberpunk' 
  | 'artistic'
  | 'tech'
  | 'data';
```

#### Section

```typescript
interface Section {
  id: string;
  projectId: string;
  title: string;
  order: number;
  sentences: Sentence[];
}
```

#### Sentence

```typescript
interface Sentence {
  id: string;
  sectionId: string;
  text: string;
  order: number;
  
  // Generated content
  imagePrompt?: string;
  videoPrompt?: string;
  audioFile?: string;
  imageFile?: string;
  videoFile?: string;
  
  // Settings
  cameraMovement: CameraMovement;
  visualStyle?: VisualStyle;
  motionStrength: number;  // 0-1
  
  // Metadata
  audioDuration?: number;  // milliseconds
  status: GenerationStatus;
}

type GenerationStatus = 
  | 'pending'
  | 'generating_audio'
  | 'generating_image'
  | 'generating_video'
  | 'complete'
  | 'error';
```

#### Character

```typescript
interface Character {
  id: string;
  name: string;
  description: string;
  referenceImages: string[];
  styleLora?: string;
}
```

---

## 4. MVP Scope & Prioritization

### 4.1 MVP (Must Have)

- [x] Script generation with AI (Deepseek) and manual editing
- [x] Auto-segmentation of scripts into sections/sentences
- [x] Search grounding for fact-checking
- [x] Voice generation via Chatterbox TTS
- [x] Image generation via ComfyUI (Flux 2, Z Image Turbo, Qwen)
- [x] Video generation via ComfyUI (WAN 2.2, LTX-2)
- [x] Character library with reference images
- [x] Storyboard view (table and grid)
- [x] Cascading regeneration system
- [x] Sequential export with NLE-compatible naming
- [x] 16:9 aspect ratio support
- [x] Support for up to 20 minutes combined video

### 4.2 Post-MVP (Nice to Have)

- [ ] Full video editor with timeline
- [ ] Music and SFX track layers
- [ ] Text overlay and graphics
- [ ] Final render export from within app
- [ ] Voice cloning
- [ ] Multiple voice support
- [ ] 9:16 vertical video support

### 4.3 Future (Commercial Version)

- [ ] Cloud-hosted deployment
- [ ] Premium video models (Kling, VEO)
- [ ] Credit-based rendering system
- [ ] Team collaboration features
- [ ] Project templates and presets library

---

## 5. User Interface Specifications

### 5.1 Navigation Structure

Left sidebar navigation with four main sections:

| Section | Description | MVP Status |
|---------|-------------|------------|
| Dashboard | Project management | ✅ |
| Script & Audio | Script editing and voice generation | ✅ |
| Storyboard | Visual scene management | ✅ |
| Video Editor | Timeline editing | ❌ Post-MVP |

### 5.2 Script & Audio Page

#### Components

- **Prompt Input:** Video concept/theme text area
- **Target Duration:** Selector (8m, 15m, 30m, 1h, 1h30m, 2h)
- **Visual Style:** Dropdown (Cinematic, Documentary, etc.)
- **Cast Panel:** Add characters to project
- **Search Grounding:** Toggle for fact-checking
- **Script Sections:** Editable section/sentence list
- **Generate Controls:** "Generate Initial Script", "Generate All Audio"

#### Right Panel Tabs

- **CAST:** Character library with thumbnails and "Add to project" action
- **VOICE:** TTS voice selection with preview samples

### 5.3 Storyboard Page

#### View Modes

**Table View:**
- Linear list format
- Columns: Thumbnail, Narration, Section
- Click to select and show in Scene Inspector

**Grid View:**
- Card-based layout
- Each card shows: Image, Narration excerpt, Camera movement tag, Style tag
- Visual hierarchy by section

#### Scene Inspector

Right panel with IMAGE/VIDEO tabs:
- Image prompt (editable)
- Video prompt (editable)
- Camera movement selector
- Motion strength slider
- Visual style override
- Regenerate buttons

### 5.4 Design System

#### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#1a1a2e` | Main background |
| `--bg-surface` | `#16213e` | Cards, panels |
| `--accent` | `#e63946` | Primary actions, highlights |
| `--text-primary` | `#ffffff` | Headings, important text |
| `--text-secondary` | `#a0a0a0` | Body text, labels |
| `--border` | `#2a2a4e` | Subtle borders |

#### Typography

- **Font Family:** System sans-serif stack
- **Headings:** Bold, white
- **Body:** Regular, gray hierarchy
- **Monospace:** Code, file paths

---

## 6. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| GPU memory limitations | Cannot run multiple models simultaneously | High | Sequential processing with smart batching via Inngest |
| Character consistency failures | Characters look different across scenes | Medium | Reference images + LoRA training + manual regeneration option |
| Long generation times | Poor UX, workflow interruption | High | Progress indicators, background processing, granular regeneration |
| Model version changes | Workflows break with updates | Medium | Versioned workflow files, abstracted model interface |
| ComfyUI API instability | Generation failures | Low | Retry logic, error handling, fallback workflows |

---

## 7. Open Questions

1. **Duration Mapping:** What is the optimal sentence-to-visual duration ratio for engaging content?

2. **Visual Duration:** How should the system handle scenes that naturally require longer visual duration than the narration?

3. **Prompt Visibility:** What level of prompt visibility/editability do users actually need?

4. **Draft Mode:** Should there be a preview/draft quality mode for faster iteration before final render?

5. **Batch Operations:** Should users be able to select multiple scenes and regenerate them together?

6. **Version History:** Should the system maintain version history for generated assets?

---

## Appendices

### Appendix A: File Export Structure

```
project-name/
├── audio/
│   ├── 001_intro-hook_audio.wav
│   ├── 002_intro-hook_audio.wav
│   ├── 003_intro-hook_audio.wav
│   ├── 004_intro-hook_audio.wav
│   ├── 005_tech-deep-dive_audio.wav
│   ├── 006_tech-deep-dive_audio.wav
│   └── 007_tech-deep-dive_audio.wav
├── images/
│   ├── 001_intro-hook_image.png
│   ├── 002_intro-hook_image.png
│   ├── 003_intro-hook_image.png
│   ├── 004_intro-hook_image.png
│   ├── 005_tech-deep-dive_image.png
│   ├── 006_tech-deep-dive_image.png
│   └── 007_tech-deep-dive_image.png
├── videos/
│   ├── 001_intro-hook_video.mp4
│   ├── 002_intro-hook_video.mp4
│   ├── 003_intro-hook_video.mp4
│   ├── 004_intro-hook_video.mp4
│   ├── 005_tech-deep-dive_video.mp4
│   ├── 006_tech-deep-dive_video.mp4
│   └── 007_tech-deep-dive_video.mp4
├── script.txt
└── metadata.json
```

### Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Cascading Regeneration** | The automatic process of regenerating downstream assets when their source content changes |
| **ComfyUI** | A node-based UI for Stable Diffusion that allows complex image and video generation workflows |
| **Inngest** | A workflow orchestration platform for managing background job queues and parallel processing |
| **LoRA** | Low-Rank Adaptation, a technique for fine-tuning AI models to achieve specific visual styles |
| **NLE** | Non-Linear Editor, professional video editing software like DaVinci Resolve, Premiere Pro, or Final Cut Pro |
| **Reference Image** | A source image used to maintain character consistency across generated visuals |
| **Scene** | A single visual unit corresponding to one sentence in the script |
| **Section** | A logical grouping of related sentences in the script (e.g., Introduction, Deep Dive) |
| **Search Grounding** | Using web search to fact-check and enhance AI-generated script content |

### Appendix C: API Endpoints (Draft)

```
# Script
POST   /api/scripts/generate          Generate script from prompt
PUT    /api/scripts/:id               Update script
POST   /api/scripts/:id/segment       Re-segment script

# Sections
PUT    /api/sections/:id              Update section
DELETE /api/sections/:id              Delete section

# Sentences
PUT    /api/sentences/:id             Update sentence text
POST   /api/sentences/:id/regenerate  Regenerate assets for sentence

# Generation
POST   /api/generate/audio/:sentenceId    Generate audio
POST   /api/generate/image/:sentenceId    Generate image
POST   /api/generate/video/:sentenceId    Generate video
POST   /api/generate/all/:projectId       Generate all assets

# Export
POST   /api/export/:projectId         Export project assets

# Characters
GET    /api/characters                List characters
POST   /api/characters                Create character
PUT    /api/characters/:id            Update character
DELETE /api/characters/:id            Delete character
```
