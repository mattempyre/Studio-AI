# ComfyUI Workflows

This directory contains ComfyUI workflow JSON files for image and video generation.

## Directory Structure

```
workflows/
├── image/           # Image generation workflows
│   └── flux-2.json  # Flux 2 text-to-image workflow
├── video/           # Video generation workflows
│   └── wan-2.2.json # WAN 2.2 image-to-video workflow
├── config.ts        # Workflow configuration and paths
└── README.md        # This file
```

## Adding New Workflows

### 1. Export from ComfyUI

1. Design your workflow in ComfyUI
2. Use "Save (API format)" to export the workflow JSON
3. Place the file in the appropriate directory (`image/` or `video/`)

### 2. Update Configuration

Add the new workflow to `config.ts`:

```typescript
export const workflows = {
  image: {
    'flux-2': path.join(__dirname, 'image', 'flux-2.json'),
    'my-new-model': path.join(__dirname, 'image', 'my-new-model.json'), // Add here
  },
  // ...
};
```

### 3. Node Naming Conventions

For automatic parameter injection, use these naming conventions in your workflow nodes:

**Text Prompt Nodes (CLIPTextEncode):**
- Title containing "positive" or "prompt" → receives the positive prompt
- Title containing "negative" → receives the negative prompt

**Dimension Nodes (EmptyLatentImage):**
- Will receive width and height parameters

**Sampler Nodes (KSampler, KSamplerAdvanced):**
- Will receive seed, steps, and cfg parameters

**Image Input Nodes (LoadImage):**
- For video workflows, receives the source image filename

## Workflow Requirements

### Image Workflows

Required nodes:
- `CLIPTextEncode` with title containing "positive" or "prompt"
- `EmptyLatentImage` for dimensions
- `KSampler` or `KSamplerAdvanced` for generation
- `SaveImage` for output

### Video Workflows

Required nodes:
- `LoadImage` for input image
- `CLIPTextEncode` with title containing "positive" or "prompt"
- Video output node (e.g., `VHS_VideoCombine`)

## Default Parameters

| Parameter | Image Default | Video Default |
|-----------|--------------|---------------|
| Width | 1920 | 1920 |
| Height | 1080 | 1080 |
| Steps | 20 | 20 |
| CFG | 7 | 2.5 |
| FPS | N/A | 24 |
| Frames | N/A | 25 |
