# Studio AI - Product Brief

**AI-Powered Video Creation Platform**  
Version 1.0 MVP | January 2026

---

## Executive Summary

Studio AI is an end-to-end AI video creation platform that transforms written scripts into fully produced videos with generated imagery, animations, and voiceover. The platform addresses the core pain point of content creators: the tedious, manual process of converting scripts into visual content by eliminating repetitive prompt engineering and asset management.

Unlike existing tools that require users to manually craft prompts for each visual element, Studio AI uses the script as a single source of truth, automatically generating appropriate prompts for images and videos while maintaining consistency across the entire production.

---

## Problem Statement

Creating AI-generated video content today requires content creators to:

1. Manually break down their scripts into individual scenes
2. Write separate prompts for image generation
3. Iterate on those images
4. Write additional prompts for video generation from those images
5. Synchronize everything with audio

This process is time-consuming, error-prone, and creates significant friction in the creative workflow.

Current tools like Runway, Pika, and Synthesia require extensive copy-pasting of prompts and manual coordination between script, visuals, and audio. There is no unified workflow that treats the script as the authoritative source and automatically cascades changes through the production pipeline.

---

## Solution

Studio AI provides an integrated workflow where users input their script (or have AI generate it), and the system automatically:

- Segments it into scenes at the sentence level
- Generates appropriate image prompts
- Creates images with character consistency
- Converts images to video clips
- Generates synchronized voiceover
- Packages everything for export or editing

When any part of the script changes, only the affected downstream assets are regenerated, maintaining efficiency while ensuring consistency.

---

## Target Users

**Primary:** YouTube content creators who need to produce video content regularly and want to leverage AI to accelerate their workflow.

**Includes:**
- Educational content creators and explainer video producers
- Documentary-style content creators
- Commentary and essay video creators
- Small production teams without dedicated video editors

---

## Success Metrics

- Time from script to exportable assets reduced by **80%** compared to manual workflow
- Support for videos up to **20 minutes** in combined length
- Successful local deployment with parallel GPU processing
- Seamless export workflow compatible with DaVinci Resolve and similar NLEs

---

## Key Differentiators

| Feature | Studio AI | Competitors |
|---------|-----------|-------------|
| Script as source of truth | ✅ Automatic prompt generation | ❌ Manual prompts per asset |
| Cascading regeneration | ✅ Only affected assets regenerate | ❌ Full re-render required |
| Character consistency | ✅ Reference images + LoRAs | ⚠️ Limited or manual |
| Integrated workflow | ✅ Script → Audio → Image → Video | ❌ Separate tools |
| Local processing | ✅ Full GPU utilization | ⚠️ Cloud-dependent |

---

## MVP Scope

### Must Have
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

### Post-MVP
- Full video editor with timeline
- Music and SFX track layers
- Text overlay and graphics
- Final render export from within app
- Voice cloning
- Multiple voice support
- 9:16 vertical video support

### Future (Commercial Version)
- Cloud-hosted deployment
- Premium video models (Kling, VEO)
- Credit-based rendering system
- Team collaboration features
- Project templates and presets library

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

## Open Questions

1. What is the optimal sentence-to-visual duration ratio for engaging content?
2. How should the system handle scenes that naturally require longer visual duration than the narration?
3. What level of prompt visibility/editability do users actually need?
4. Should there be a preview/draft quality mode for faster iteration before final render?
