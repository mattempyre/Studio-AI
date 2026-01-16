# Product Brief: VideoGen AI Studio

**Date:** 2026-01-16
**Author:** matte
**Version:** 1.0
**Project Type:** web-app
**Project Level:** 3 (Complex)

---

## Executive Summary

Studio AI is an end-to-end AI video creation platform that transforms written scripts into fully produced videos with generated imagery, animations, and voiceover. The platform addresses the core pain point of content creators: the tedious, manual process of converting scripts into visual content by eliminating repetitive prompt engineering and asset management.

Unlike existing tools that require users to manually craft prompts for each visual element, Studio AI uses the script as a single source of truth, automatically generating appropriate prompts for images and videos while maintaining consistency across the entire production.

---

## Problem Statement

### The Problem

Creating AI-generated video content today requires content creators to:

1. Manually break down their scripts into individual scenes
2. Write separate prompts for image generation
3. Iterate on those images
4. Write additional prompts for video generation from those images
5. Synchronize everything with audio

This process is time-consuming, error-prone, and creates significant friction in the creative workflow.

Current tools like Runway, Pika, and Synthesia require extensive copy-pasting of prompts and manual coordination between script, visuals, and audio. There is no unified workflow that treats the script as the authoritative source and automatically cascades changes through the production pipeline.

### Why Now?

- AI image and video generation models have reached sufficient quality for content production
- Local inference is now viable with consumer GPUs, reducing dependency on expensive cloud APIs
- Content creators are increasingly adopting AI tools but struggling with fragmented workflows
- The gap between AI capability and usable tooling creates an opportunity

### Impact if Unsolved

Content creators will continue spending excessive time on manual prompt engineering and asset coordination, limiting their output capacity and creative focus. The friction will slow AI adoption in video production workflows.

---

## Target Audience

### Primary Users

YouTube content creators who need to produce video content regularly and want to leverage AI to accelerate their workflow.

**Includes:**
- Educational content creators and explainer video producers
- Documentary-style content creators
- Commentary and essay video creators
- Small production teams without dedicated video editors

### Secondary Users

- Indie game developers needing promotional content
- Small businesses creating marketing videos
- Hobbyist creators exploring AI-assisted production

### User Needs

1. **Speed** - Reduce time from script to exportable video assets by 80%+
2. **Consistency** - Maintain character and style coherence across scenes
3. **Control** - Ability to iterate on specific scenes without re-rendering everything
4. **Integration** - Export workflow compatible with existing NLE tools (DaVinci Resolve, etc.)

---

## Solution Overview

### Proposed Solution

Studio AI provides an integrated workflow where users input their script (or have AI generate it), and the system automatically:

- Segments it into scenes at the sentence level
- Generates appropriate image prompts
- Creates images with character consistency
- Converts images to video clips
- Generates synchronized voiceover
- Packages everything for export or editing

When any part of the script changes, only the affected downstream assets are regenerated, maintaining efficiency while ensuring consistency.

### Key Features

- Script generation with AI (Deepseek) and manual editing
- Auto-segmentation of scripts into sections/sentences
- Search grounding for fact-checking
- Voice generation via Chatterbox TTS
- Image generation via ComfyUI (Flux 2, Z Image Turbo, Qwen)
- Video generation via ComfyUI (WAN 2.2, LTX-2)
- Character library with reference images
- Storyboard view (table and grid)
- Cascading regeneration system
- Sequential export with NLE-compatible naming
- 16:9 aspect ratio support
- Support for up to 20 minutes combined video

### Value Proposition

| Feature | Studio AI | Competitors |
|---------|-----------|-------------|
| Script as source of truth | Automatic prompt generation | Manual prompts per asset |
| Cascading regeneration | Only affected assets regenerate | Full re-render required |
| Character consistency | Reference images + LoRAs | Limited or manual |
| Integrated workflow | Script to Audio to Image to Video | Separate tools |
| Local processing | Full GPU utilization | Cloud-dependent |

---

## Business Objectives

### Goals

- Build a functional MVP for personal use by end of January 2026
- Validate the script-to-video workflow for YouTube content creation
- Achieve 5x speed improvement over manual AI video production workflow
- Establish foundation for potential future commercial offering

### Success Metrics

- Time from script to exportable assets reduced by **80%** compared to manual workflow
- Support for videos up to **20 minutes** in combined length
- Successful local deployment with parallel GPU processing
- Seamless export workflow compatible with DaVinci Resolve and similar NLEs

### Business Value

- Immediate personal productivity gain for YouTube content creation
- Potential for future commercialization (cloud-hosted version, credit-based system)
- Portfolio/showcase project demonstrating AI integration capabilities

---

## Scope

### In Scope

**MVP (Must Have):**
- Script generation with AI (Deepseek) and manual editing
- Auto-segmentation of scripts into sections/sentences
- Search grounding for fact-checking
- Voice generation via Chatterbox TTS
- Image generation via ComfyUI (Flux 2, Z Image Turbo, Qwen)
- Video generation via ComfyUI (WAN 2.2, LTX-2)
- Character library with reference images
- Storyboard view (table and grid)
- Cascading regeneration system
- Sequential export with NLE-compatible naming
- 16:9 aspect ratio support
- Support for up to 20 minutes combined video

### Out of Scope

**Post-MVP:**
- Full video editor with timeline
- Music and SFX track layers
- Text overlay and graphics
- Final render export from within app
- Voice cloning
- Multiple voice support
- 9:16 vertical video support

### Future Considerations

**Commercial Version:**
- Cloud-hosted deployment
- Premium video models (Kling, VEO)
- Credit-based rendering system
- Team collaboration features
- Project templates and presets library

---

## Key Stakeholders

- **matte (Solo Developer/Owner)** - High influence. Primary developer, user, and decision-maker. Building for personal use with potential future commercialization.

---

## Constraints and Assumptions

### Constraints

- **Local-first processing** - Minimize ongoing cloud/API costs by running inference locally
- **GPU hardware availability** - Dependent on local GPU capability for ComfyUI workloads
- **Solo developer bandwidth** - Limited development time and resources
- **API costs** - Deepseek API for script generation is the primary ongoing cost

### Assumptions

- User (developer) has capable local GPU for ComfyUI processing
- ComfyUI and local models remain viable alternatives to cloud APIs
- Deepseek API costs are acceptable for script generation
- Local TTS (Chatterbox) provides sufficient voice quality
- Current image/video models can achieve acceptable quality for YouTube content

---

## Success Criteria

- Produce YouTube content 5x faster than current manual workflow
- Time from script to exportable assets reduced by 80%
- Support videos up to 20 minutes in combined length
- Seamless export workflow compatible with DaVinci Resolve
- MVP is usable for personal YouTube content production

---

## Timeline and Milestones

### Target Launch

MVP: January 2026 (current month)

### Key Milestones

1. Core script editor and segmentation working
2. Image generation pipeline integrated
3. Video generation pipeline integrated
4. Voice generation and synchronization complete
5. Export workflow functional
6. Full MVP usable for personal content creation

---

## Risks and Mitigation

- **Risk:** Model Quality - Generated images/videos may not meet quality bar for YouTube content
  - **Likelihood:** Medium
  - **Mitigation:** Support multiple models (Flux 2, WAN 2.2, LTX-2), allow easy regeneration, iterative prompt refinement, manual prompt override capability

- **Risk:** Character Consistency - Difficulty maintaining visual consistency across scenes
  - **Likelihood:** High
  - **Mitigation:** Reference images + LoRAs for style, character library system, consistent prompt structure, scene-level style locking

---

## Open Questions

1. What is the optimal sentence-to-visual duration ratio for engaging content?
2. How should the system handle scenes that naturally require longer visual duration than the narration?
3. What level of prompt visibility/editability do users actually need?
4. Should there be a preview/draft quality mode for faster iteration before final render?

---

## Technical Overview

| Component | Technology |
|-----------|------------|
| Script Generation | Deepseek API |
| Text-to-Speech | Chatterbox TTS (local Docker) |
| Image Generation | ComfyUI (Flux 2, Z Image Turbo, Qwen) |
| Video Generation | ComfyUI (WAN 2.2, LTX-2) |
| Job Queue | Inngest |
| Character Consistency | Reference images + LoRAs for style |

---

## Next Steps

1. Create Product Requirements Document (PRD) - `/prd`
2. Create System Architecture - `/architecture`
3. Begin sprint planning - `/sprint-planning`

---

**This document was created using BMAD Method v6 - Phase 1 (Analysis)**

*To continue: Run `/workflow-status` to see your progress and next recommended workflow.*
