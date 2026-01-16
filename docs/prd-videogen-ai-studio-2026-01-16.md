# Product Requirements Document: VideoGen AI Studio

**Date:** 2026-01-16
**Author:** matte
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3 (Complex)
**Status:** Draft

---

## Document Overview

This Product Requirements Document (PRD) defines the functional and non-functional requirements for VideoGen AI Studio. It serves as the source of truth for what will be built and provides traceability from requirements through implementation.

**Related Documents:**
- Product Brief: `docs/product-brief-videogen-ai-studio-2026-01-16.md`
- Original PRD: `docs/PRD.md` (detailed technical specifications)

---

## Executive Summary

Studio AI is an end-to-end AI video creation platform that transforms written scripts into fully produced videos with generated imagery, animations, and voiceover. The system uses the script as a single source of truth, automatically generating appropriate prompts for images and videos while maintaining consistency across the entire production.

---

## Product Goals

### Business Objectives

- Build a functional MVP for personal use by end of January 2026
- Achieve 5x speed improvement over manual AI video production workflow
- Enable production of YouTube content with minimal manual intervention
- Establish foundation for potential future commercial offering

### Success Metrics

| Metric | Target |
|--------|--------|
| Time reduction | 80% faster than manual workflow |
| Video length support | Up to 20 minutes combined |
| Export compatibility | DaVinci Resolve, Premiere Pro, Final Cut Pro |
| Processing | Local GPU utilization |

---

## Functional Requirements

Functional Requirements (FRs) define **what** the system does - specific features and behaviors.

Priority: **Must Have (M)** / **Should Have (S)** / **Could Have (C)** / **Won't Have (W)**

---

### FR-1xx: Script Generation & Management

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-101 | M | AI script generation using Deepseek API | User enters topic, receives segmented script |
| FR-102 | M | Manual script entry and editing | User can type/paste script and edit any text |
| FR-103 | M | Auto-segmentation into sections with titles | Script is divided into logical sections automatically |
| FR-104 | M | Sentence-level granularity for visuals | Each sentence maps to one visual unit |
| FR-105 | M | Search grounding toggle for fact-checking | Toggle enables/disables web search verification |
| FR-106 | M | Target duration selection | Options: 8m, 15m, 30m, 1h, 1h30m, 2h |
| FR-107 | M | Visual style presets | Dropdown: Cinematic, Documentary, Abstract, etc. |

---

### FR-2xx: Cast & Character System

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-201 | M | Character library with reference images | Store characters with name, description, images |
| FR-202 | S | LoRA support for style consistency | Apply LoRA identifiers to characters |
| FR-203 | M | Character descriptions stored with images | Each character has text description + images |
| FR-204 | M | Add characters to project cast | Select from library to add to current project |

---

### FR-3xx: Voice Generation

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-301 | M | TTS via locally hosted Chatterbox TTS | Docker container generates speech |
| FR-302 | M | Audio generated per sentence | Each sentence has independent audio file |
| FR-303 | M | Auto-regeneration on text change | Editing text triggers new audio generation |
| FR-304 | M | Voice selection from platform voices | Options: Puck, Kore, Fenrir, Charon, Zephyr |
| FR-305 | C | Voice cloning capability | Clone voice from audio sample (Post-MVP) |

---

### FR-4xx: Image Generation

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-401 | M | ComfyUI integration via custom workflows | API calls to local ComfyUI instance |
| FR-402 | M | Multiple model support | Flux 2, Z Image Turbo, Qwen available |
| FR-403 | M | Auto prompt generation from sentences | LLM creates image prompts from script text |
| FR-404 | M | Character reference image injection | Reference images included in generation |
| FR-405 | S | Style LoRA application | Apply visual style LoRA to generation |
| FR-406 | M | Manual prompt override per image | User can edit generated prompt |
| FR-407 | M | 16:9 aspect ratio support | All images generated in 16:9 |
| FR-408 | M | Regenerate individual images | Button to regenerate single image |
| FR-409 | S | Extensible model architecture | Easy to add new image models |

---

### FR-5xx: Video Generation

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-501 | M | ComfyUI video workflow integration | API calls for video generation |
| FR-502 | M | Image-to-video generation | Convert generated stills to video clips |
| FR-503 | M | Camera movement presets | Pan, Zoom, Orbit, Truck, Static options |
| FR-504 | M | Motion strength slider control | 0-100% motion intensity |
| FR-505 | M | Manual video prompt override | User can edit video generation prompt |
| FR-506 | M | Multiple model support | WAN 2.2, LTX-2 available |
| FR-507 | M | Support 20 min combined video | Handle projects with many clips |
| FR-508 | M | Regenerate individual videos | Button to regenerate single video |

---

### FR-6xx: Storyboard View

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-601 | M | Table view - linear list format | Shows thumbnail, narration, section |
| FR-602 | M | Grid view - card-based layout | Shows image, narration, camera, style |
| FR-603 | M | Scene Inspector panel | Right panel with image/video settings |
| FR-604 | M | Section navigation sidebar | Click to jump to section |
| FR-605 | M | Regenerate buttons in inspector | One-click regenerate for image or video |
| FR-606 | M | Generate scenes from script action | Bulk generate all visuals |
| FR-607 | S | Preview full video | Play assembled preview in app |

---

### FR-7xx: Export System

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-701 | M | Sequential file naming | Format: `{seq}_{section-slug}_{type}.{ext}` |
| FR-702 | M | Batch export all assets | Export images, videos, audio in one action |
| FR-703 | M | Organized folder structure | Separate audio/, images/, videos/ folders |
| FR-704 | M | NLE-compatible output | Works with DaVinci Resolve, Premiere, FCP |
| FR-705 | M | Include script.txt in export | Plain text script included |
| FR-706 | S | Include metadata.json | Export project metadata |

---

### FR-8xx: Cascading Regeneration

| ID | Priority | Requirement | Acceptance Criteria |
|----|----------|-------------|---------------------|
| FR-801 | M | Track asset dependencies | System knows which assets derive from which |
| FR-802 | M | Minimal regeneration on change | Only affected assets regenerate |
| FR-803 | M | Section edit triggers full section regen | Modifying section regenerates all its assets |
| FR-804 | M | Sentence edit triggers sentence regen | Modifying sentence regenerates its assets only |
| FR-805 | M | Prompt edit triggers downstream regen | Image prompt change regenerates image + video |

---

## Non-Functional Requirements

Non-Functional Requirements (NFRs) define **how** the system performs - quality attributes and constraints.

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR-001 | Performance | Support combined video length | Up to 20 minutes |
| NFR-002 | Performance | Local GPU processing | Full GPU utilization |
| NFR-003 | Performance | Parallel job processing | Via Inngest queue |
| NFR-004 | Reliability | Graceful error handling | Retry logic, clear error messages |
| NFR-005 | Reliability | Job queue persistence | Jobs survive app restart |
| NFR-006 | Usability | Progress indicators | Show generation progress for all assets |
| NFR-007 | Usability | Background processing | UI remains responsive during generation |
| NFR-008 | Extensibility | Add new image models | Modular workflow architecture |
| NFR-009 | Extensibility | Add new video models | Same modular approach |
| NFR-010 | Compatibility | Export to major NLEs | DaVinci, Premiere, FCP |
| NFR-011 | Maintainability | Versioned ComfyUI workflows | JSON workflow files |
| NFR-012 | Cost | Local-first processing | Minimize cloud API costs |

---

## Epics

Epics are logical groupings of related functionality that will be broken down into user stories during sprint planning.

| Epic ID | Epic Name | Description | FRs Covered | Est. Stories |
|---------|-----------|-------------|-------------|--------------|
| EPIC-01 | Script Management | Script generation, editing, segmentation | FR-1xx | 5-7 |
| EPIC-02 | Character System | Character library, reference images, LoRAs | FR-2xx | 3-5 |
| EPIC-03 | Voice Generation | TTS integration, audio management | FR-3xx | 4-6 |
| EPIC-04 | Image Generation | ComfyUI image workflows, prompt generation | FR-4xx | 6-8 |
| EPIC-05 | Video Generation | ComfyUI video workflows, camera movements | FR-5xx | 6-8 |
| EPIC-06 | Storyboard UI | Table/grid views, scene inspector | FR-6xx | 5-7 |
| EPIC-07 | Export System | File naming, batch export, folder structure | FR-7xx | 4-5 |
| EPIC-08 | Cascading Regen | Dependency tracking, minimal regeneration | FR-8xx | 4-5 |

---

## User Stories (High-Level)

### EPIC-01: Script Management

- As a creator, I want to enter a topic and have AI generate a complete, segmented script so I can quickly start production.
- As a creator, I want the script to be fact-checked against current information so my content is accurate.
- As a creator, I want to edit individual sentences without regenerating the entire video so I can iterate efficiently.
- As a creator, I want to choose a target duration so the AI generates an appropriately-sized script.
- As a creator, I want to select a visual style preset so my entire video has a consistent look.

### EPIC-02: Character System

- As a creator, I want to maintain a library of characters with reference images so I can reuse them across projects.
- As a creator, I want characters to appear consistent across all scenes so my video looks professional.
- As a creator, I want to add characters to my project cast so they're included in generated visuals.

### EPIC-03: Voice Generation

- As a creator, I want narration automatically generated from my script so I don't have to record myself.
- As a creator, I want to choose from different voice options so I can pick one that fits my content.
- As a creator, I want audio to automatically regenerate when I edit text so everything stays in sync.

### EPIC-04: Image Generation

- As a creator, I want images automatically generated for each sentence so I don't have to write prompts manually.
- As a creator, I want to override image prompts when needed so I have creative control.
- As a creator, I want to regenerate individual images without affecting others so I can iterate quickly.

### EPIC-05: Video Generation

- As a creator, I want still images converted to video clips so my content has motion.
- As a creator, I want to select camera movements so each scene has appropriate motion.
- As a creator, I want to control motion intensity so some scenes are subtle and others dynamic.

### EPIC-06: Storyboard UI

- As a creator, I want to see all my scenes in a visual grid so I can review the whole video at a glance.
- As a creator, I want a detailed inspector panel so I can fine-tune individual scene settings.
- As a creator, I want to navigate by section so I can quickly jump to specific parts.

### EPIC-07: Export System

- As a creator, I want to export all assets with sequential naming so I can import them into my video editor.
- As a creator, I want files organized into folders so my project stays organized.
- As a creator, I want export to work with DaVinci Resolve so I can do final editing there.

---

## User Personas

### Primary Persona: Alex - YouTube Educational Creator

**Background:**
- Creates educational/explainer videos for YouTube
- Produces 2-4 videos per month
- Has a capable GPU workstation
- Comfortable with technical tools but not a developer

**Goals:**
- Reduce video production time by 80%
- Maintain consistent visual quality
- Keep creative control over final output

**Pain Points:**
- Writing image prompts for every scene is tedious
- Keeping characters consistent across scenes is difficult
- Coordinating script, audio, and visuals takes too long

**Tech Savviness:** Intermediate

### Secondary Persona: Jordan - Documentary Creator

**Background:**
- Creates documentary-style content
- Longer-form content (15-30 minutes)
- Values accuracy and research

**Goals:**
- Fact-check content automatically
- Generate visuals for abstract concepts
- Maintain professional visual consistency

**Pain Points:**
- Manual research and fact-checking is slow
- Abstract topics are hard to visualize
- Maintaining visual coherence in long videos

---

## User Flows

### Flow 1: New Project Creation

```
Start → Enter Topic → Select Duration → Select Style
→ Generate Script → Review/Edit Script → Generate Audio
→ Review Audio → Continue to Storyboard
```

### Flow 2: Storyboard to Export

```
View Storyboard → Generate All Images → Review Images
→ Regenerate as needed → Generate All Videos
→ Review Videos → Regenerate as needed → Export All
```

### Flow 3: Scene Iteration

```
Select Scene → View in Inspector → Edit Prompt
→ Regenerate → Review → Accept or Iterate
```

### Flow 4: Script Edit with Cascade

```
Edit Sentence Text → System detects change
→ Mark affected assets stale → User triggers regeneration
→ Only affected audio/image/video regenerate
```

---

## Dependencies

### Internal Dependencies

| Dependency | Required For | Notes |
|------------|--------------|-------|
| Script segmentation | Image/video generation | Must complete before visuals |
| Audio generation | Video timing | Audio duration drives video length |
| Image generation | Video generation | Image-to-video workflow |
| Character library | Image generation | Reference images needed |

### External Dependencies

| Dependency | Component | Risk Level |
|------------|-----------|------------|
| Deepseek API | Script generation | Medium - only cloud dependency |
| ComfyUI | Image/video generation | Low - local, self-hosted |
| Chatterbox TTS | Voice generation | Low - local Docker |
| Inngest | Job queue | Low - local/self-hosted |

---

## Assumptions

1. User has a capable GPU (RTX 3080 or better) for local inference
2. User has sufficient disk space for generated assets (~10GB per 10-min video)
3. ComfyUI and required models are pre-installed
4. Chatterbox TTS Docker container is running
5. Deepseek API remains cost-effective for script generation
6. User is comfortable with a web-based UI

---

## Out of Scope

### MVP Exclusions

- Full video editor with timeline
- Music and SFX track layers
- Text overlay and graphics
- Final render export from within app
- Voice cloning
- Multiple voice support per project
- 9:16 vertical video support

### Future Phases

- Cloud-hosted deployment
- Premium video models (Kling, VEO)
- Credit-based rendering system
- Team collaboration features
- Project templates and presets library

---

## Open Questions

| # | Question | Impact | Decision Needed By |
|---|----------|--------|-------------------|
| 1 | Optimal sentence-to-visual duration ratio? | Video pacing | Sprint 1 |
| 2 | Handle scenes needing longer visual than narration? | UX design | Sprint 1 |
| 3 | Level of prompt visibility/editability needed? | UI complexity | Sprint 2 |
| 4 | Preview/draft quality mode for faster iteration? | Performance | Sprint 2 |
| 5 | Batch select and regenerate multiple scenes? | UX enhancement | Sprint 3 |
| 6 | Version history for generated assets? | Storage/complexity | Post-MVP |

---

## Approval & Sign-off

### Stakeholders

- **matte (Solo Developer/Owner)** - Primary decision maker

### Approval Status

- [x] Product Owner (matte)
- [x] Engineering Lead (matte)
- [ ] Design Lead (N/A - solo project)
- [ ] QA Lead (N/A - solo project)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-16 | matte | Initial BMAD PRD |

---

## Next Steps

### Phase 3: Architecture

Run `/architecture` to create system architecture based on these requirements.

The architecture will address:
- All functional requirements (FRs)
- All non-functional requirements (NFRs)
- Technical stack decisions
- Data models and APIs
- System components

### Phase 4: Sprint Planning

After architecture is complete, run `/sprint-planning` to:
- Break epics into detailed user stories
- Estimate story complexity
- Plan sprint iterations
- Begin implementation

---

**This document was created using BMAD Method v6 - Phase 2 (Planning)**

*To continue: Run `/workflow-status` to see your progress and next recommended workflow.*

---

## Appendix A: Requirements Traceability Matrix

| Epic ID | Epic Name | Functional Requirements | Story Count (Est.) |
|---------|-----------|-------------------------|-------------------|
| EPIC-01 | Script Management | FR-101 to FR-107 | 5-7 |
| EPIC-02 | Character System | FR-201 to FR-204 | 3-5 |
| EPIC-03 | Voice Generation | FR-301 to FR-305 | 4-6 |
| EPIC-04 | Image Generation | FR-401 to FR-409 | 6-8 |
| EPIC-05 | Video Generation | FR-501 to FR-508 | 6-8 |
| EPIC-06 | Storyboard UI | FR-601 to FR-607 | 5-7 |
| EPIC-07 | Export System | FR-701 to FR-706 | 4-5 |
| EPIC-08 | Cascading Regen | FR-801 to FR-805 | 4-5 |

**Total Estimated Stories:** 37-51

---

## Appendix B: Reference Documents

- **Original PRD:** `docs/PRD.md` - Contains detailed technical architecture, data models, API specs, UI wireframes
- **Product Brief:** `docs/product-brief-videogen-ai-studio-2026-01-16.md` - Business context and vision
