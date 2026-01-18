# STORY-038: Style Builder UI

## Overview

Build a Style Builder UI with a **two-tier system**:
1. **Models** - Base generation engines with their own ComfyUI workflow files (z-image-turbo, flux-2-klein, etc.)
2. **Styles** - Modifications applied to models:
   - **Prompt styles**: Just add prompt prefix to base model (cinematic, cyberpunk, etc.)
   - **LoRA styles**: Load a specific LoRA file (ms-paint-style)

### User Flow
1. User selects a **Model** (determines which workflow JSON runs)
2. User selects a **Style** (determines prompt prefix OR LoRA to apply)
3. Some styles may only work with specific models (compatibility)

## Current Architecture

### Existing System
- `src/backend/config/visualStyles.ts` - Mixed styles and models in one flat object
- Only `z-image-turbo` and `ms-paint-style` have actual `workflowPath`
- Other styles are prompt-based (cinematic, cyberpunk) intended for z-image-turbo

### What Needs to Change
Split into two concepts:
- **Generation Models** (with workflow JSON files)
- **Visual Styles** (prompt prefixes or LoRA configs that apply to models)

## Database Schema

### Models Table
```typescript
export const generationModels = sqliteTable('generation_models', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),              // Display name: "Z-Image Turbo"
  description: text('description'),           // "Fast 4-step turbo model"
  workflowFile: text('workflow_file'),        // Path to workflow JSON
  workflowType: text('workflow_type').notNull().default('text-to-image'),
  defaultSteps: integer('default_steps').default(4),
  defaultCfg: real('default_cfg').default(1.0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

### Styles Table
```typescript
export const visualStyles = sqliteTable('visual_styles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),              // Display name: "Cinematic"
  description: text('description'),
  styleType: text('style_type').notNull(),   // 'prompt' | 'lora'
  promptPrefix: text('prompt_prefix'),        // For prompt-based styles
  loraFile: text('lora_file'),               // For LoRA-based styles (path or name)
  loraStrength: real('lora_strength').default(1.0),
  compatibleModels: text('compatible_models', { mode: 'json' }).$type<string[]>(), // Model IDs this works with
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
```

## API Endpoints

### Models API (`src/backend/api/models.ts`)
```
GET    /api/v1/models              # List all active models
POST   /api/v1/models              # Create new model
GET    /api/v1/models/:id          # Get model details
PUT    /api/v1/models/:id          # Update model
DELETE /api/v1/models/:id          # Delete model
POST   /api/v1/models/:id/workflow # Upload workflow JSON
POST   /api/v1/models/:id/test     # Test with sample prompt
```

### Styles API (`src/backend/api/styles.ts`)
```
GET    /api/v1/styles              # List all active styles
GET    /api/v1/styles?model=:id    # List styles compatible with model
POST   /api/v1/styles              # Create new style
GET    /api/v1/styles/:id          # Get style details
PUT    /api/v1/styles/:id          # Update style
DELETE /api/v1/styles/:id          # Delete style
```

## Frontend Components

### Style Builder Page (`src/components/StyleBuilder/`)
```
StyleBuilder/
  StyleBuilder.tsx         # Main page with tabs: Models | Styles
  ModelGallery.tsx         # Grid of model cards
  ModelCard.tsx            # Model card with workflow upload
  ModelForm.tsx            # Create/edit model form
  StyleGallery.tsx         # Grid of style cards
  StyleCard.tsx            # Style card (prompt or LoRA)
  StyleForm.tsx            # Create/edit style form
  WorkflowUploader.tsx     # JSON file upload
  TestPanel.tsx            # Test generation preview
  index.ts
```

### UI Mockup - Models Tab
```
+-----------------------------------------------------+
| Style Builder                                        |
+--------------+--------------------------------------+
| [Models] [Styles]                    [+ Add Model]  |
+--------------+--------------------------------------+
| +-------------+  +-------------+  +-------------+  |
| | Z-Image     |  | Flux 2      |  | + Add New   |  |
| | Turbo       |  | Klein       |  |   Model     |  |
| | ----------- |  | ----------- |  |             |  |
| | 4 steps     |  | 8 steps     |  |             |  |
| | cfg: 1.0    |  | cfg: 3.5    |  |             |  |
| | [Edit][Test]|  | [Edit][Test]|  |             |  |
| +-------------+  +-------------+  +-------------+  |
+-----------------------------------------------------+
```

### UI Mockup - Styles Tab
```
+-----------------------------------------------------+
| Style Builder                                        |
+--------------+--------------------------------------+
| [Models] [Styles]                    [+ Add Style]  |
+--------------+--------------------------------------+
| Filter: [All Models v]                              |
| +-------------+  +-------------+  +-------------+  |
| | Cinematic   |  | Cyberpunk   |  | MS Paint    |  |
| | [PROMPT]    |  | [PROMPT]    |  | [LORA]      |  |
| | ----------- |  | ----------- |  | ----------- |  |
| | Dramatic    |  | Neon-lit    |  | Retro       |  |
| | lighting... |  | futuristic..|  | aesthetic.. |  |
| | [Edit]      |  | [Edit]      |  | [Edit]      |  |
| +-------------+  +-------------+  +-------------+  |
+-----------------------------------------------------+
```

### UI Mockup - Model Form
```
+-----------------------------------------------------+
| Add New Model                              [X]      |
+-----------------------------------------------------+
| Name: [Z-Image Turbo                           ]    |
|                                                     |
| Description:                                        |
| [Fast 4-step turbo model for quick generation  ]    |
|                                                     |
| Workflow Type: (*) Text-to-Image  ( ) Image-to-Image|
|                                                     |
| Default Steps: [4   ]  Default CFG: [1.0  ]         |
|                                                     |
| Workflow JSON:                                      |
| +-----------------------------------------------+   |
| |  [file] text-to-image-z_image_turbo.json      |   |
| |      or drag & drop JSON file here            |   |
| +-----------------------------------------------+   |
|                                                     |
|                           [Cancel]  [Save Model]    |
+-----------------------------------------------------+
```

### UI Mockup - Style Form
```
+-----------------------------------------------------+
| Add New Style                              [X]      |
+-----------------------------------------------------+
| Name: [Cinematic                               ]    |
|                                                     |
| Style Type: (*) Prompt Prefix  ( ) LoRA             |
|                                                     |
| --- Prompt Style Options ---                        |
| Prompt Prefix:                                      |
| [Cinematic photograph, dramatic lighting,      ]    |
| [shallow depth of field, 8k resolution...      ]    |
|                                                     |
| --- LoRA Style Options --- (hidden if prompt)       |
| LoRA File: [ms_paint_style.safetensors        ]     |
| LoRA Strength: [1.0  ]                              |
|                                                     |
| Compatible Models:                                  |
| [x] Z-Image Turbo                                   |
| [x] Flux 2 Klein                                    |
| [ ] Other future models...                          |
|                                                     |
|                           [Cancel]  [Save Style]    |
+-----------------------------------------------------+
```

## Data Migration

### Seed Initial Data
On first run, populate tables with existing config:

**Models to seed:**
1. `z-image-turbo` - workflowPath: `workflows/image/text-to-image-image_z_image_turbo.json`

**Styles to seed (prompt-based):**
1. `cinematic` - promptPrefix from current config
2. `cyberpunk` - promptPrefix from current config
3. `documentary` - promptPrefix from current config
4. `corporate` - promptPrefix from current config
5. `watercolor` - promptPrefix from current config
6. `financial-explainer` - promptPrefix from current config (image-to-image)
7. `cartoon-explainer` - promptPrefix from current config (image-to-image)
8. `minimalist-sketch` - promptPrefix from current config (image-to-image)
9. `anime` - promptPrefix from current config (image-to-image)

**Styles to seed (LoRA-based):**
1. `ms-paint-style` - loraFile from workflow, works with z-image-turbo

## Integration with Generation

Update `generateImage.ts` to use the new system:

```typescript
// 1. Get model config from DB
const model = await getModelById(modelId);

// 2. Get style config from DB
const style = await getStyleById(styleId);

// 3. Load workflow from model's workflowFile
const workflow = await loadWorkflow(model.workflowFile);

// 4. Apply style modifications
if (style.styleType === 'prompt') {
  // Prepend style's promptPrefix to user prompt
  finalPrompt = `${style.promptPrefix} ${userPrompt}`;
} else if (style.styleType === 'lora') {
  // Inject LoRA loader node into workflow
  injectLoraNode(workflow, style.loraFile, style.loraStrength);
}

// 5. Execute workflow
const result = await comfyui.execute(workflow, { prompt: finalPrompt, ... });
```

## Files to Create
1. `src/backend/api/models.ts` - Models API
2. `src/backend/api/styles.ts` - Styles API
3. `src/hooks/useModels.ts` - Models hook
4. `src/hooks/useStyles.ts` - Styles hook
5. `src/components/StyleBuilder/StyleBuilder.tsx`
6. `src/components/StyleBuilder/ModelGallery.tsx`
7. `src/components/StyleBuilder/ModelCard.tsx`
8. `src/components/StyleBuilder/ModelForm.tsx`
9. `src/components/StyleBuilder/StyleGallery.tsx`
10. `src/components/StyleBuilder/StyleCard.tsx`
11. `src/components/StyleBuilder/StyleForm.tsx`
12. `src/components/StyleBuilder/WorkflowUploader.tsx`
13. `src/components/StyleBuilder/index.ts`

## Files to Modify
1. `src/backend/db/schema.ts` - Add tables
2. `src/backend/api/index.ts` - Register routers
3. `src/backend/server.ts` - Mount routers
4. `src/backend/inngest/functions/generateImage.ts` - Use new model/style system
5. `src/App.tsx` or `src/routes.tsx` - Add route
6. `src/components/Sidebar/Sidebar.tsx` - Add navigation
7. Project settings components - Replace single "Visual Style" dropdown with two dropdowns:
   - **Model dropdown** - Select generation model (z-image-turbo, flux, etc.)
   - **Style dropdown** - Select visual style, filtered by compatible models

## Acceptance Criteria
- [x] Models can be created with uploaded ComfyUI workflow JSON files
- [x] Styles can be created as either prompt-based or LoRA-based
- [x] Styles have model compatibility settings
- [x] Project settings show two dropdowns: Model and Style
- [x] Style dropdown filters based on selected model
- [x] Generation uses the selected model's workflow with style modifications
- [x] Existing styles are seeded to database on first run

## Verification Plan
1. `npm run db:init` - Create new tables ✅
2. `npm run dev:all` - Start servers ✅
3. Navigate to Style Builder ✅
4. Verify seeded models and styles appear ✅
5. Create new model with uploaded workflow JSON ✅
6. Create new prompt-based style ✅
7. Create new LoRA-based style ✅
8. Test generation with model + style combination ✅
9. Edit and delete custom entries ✅

## Status: COMPLETE

### Additional Features Implemented
- **Video model support** - Extended Style Builder with Image Models / Video Models sub-tabs
- **WAN 2.2 14B I2V** video model seeded with workflow
- **Video-specific settings** - defaultFrames and defaultFps fields for video models
- **Category filtering** - API supports `?category=image|video` query parameter
- **ScriptEditorV2 Integration** - PromptsPanel now shows two dropdowns (Model + Style) instead of single Visual Style dropdown
  - Model dropdown shows only image models (video generation happens on storyboard)
  - Style dropdown filters based on selected model's compatibility
  - Project stores `modelId` and `styleId` in database
  - Legacy `visualStyle` field maintained for backward compatibility
