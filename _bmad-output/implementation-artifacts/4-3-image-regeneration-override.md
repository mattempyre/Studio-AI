# Story 4.3: Image Regeneration & Override

Status: ready-for-dev

## Story

As a **creator**,
I want **to edit image prompts and regenerate individual images**,
so that **I have creative control over specific visuals**.

## Acceptance Criteria

1. Image prompt editable in scene inspector panel
2. Prompt changes auto-save with debounce
3. Editing prompt sets `isImageDirty: true` and `isVideoDirty: true`
4. "Regenerate Image" button visible in inspector
5. Button disabled during active generation
6. Click triggers `image/generate` event for single sentence
7. Progress indicator shows during generation
8. Generated image replaces existing image
9. Image preview updates immediately after completion
10. Seed input field (optional, random if empty)
11. "Regenerate with new seed" quick action
12. Error state shows retry option
13. Old image file deleted after successful replacement

## Tasks / Subtasks

- [ ] Task 1: Create ImagePromptEditor component (AC: 1, 2)
  - [ ] 1.1: Create `components/Storyboard/ImagePromptEditor.tsx`
  - [ ] 1.2: Implement debounced auto-save (500ms)
  - [ ] 1.3: Show character/word count

- [ ] Task 2: Create regenerate API endpoint (AC: 6, 13)
  - [ ] 2.1: Add `POST /api/v1/sentences/:id/regenerate-image`
  - [ ] 2.2: Delete old image file
  - [ ] 2.3: Queue image/generate event

- [ ] Task 3: Update sentence API for dirty flags (AC: 3)
  - [ ] 3.1: Modify PUT /api/v1/sentences/:id
  - [ ] 3.2: Set isImageDirty and isVideoDirty on prompt change

- [ ] Task 4: Add to SceneInspector (AC: 4, 5, 7, 8, 9)
  - [ ] 4.1: Integrate ImagePromptEditor
  - [ ] 4.2: Add regenerate button with loading state
  - [ ] 4.3: Listen for WebSocket completion events
  - [ ] 4.4: Update image preview on completion

- [ ] Task 5: Add seed control (AC: 10, 11)
  - [ ] 5.1: Create SeedInput component
  - [ ] 5.2: Pass seed to regenerate endpoint

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for prompt editor debounce
  - [ ] 6.2: Unit tests for dirty flag cascade
  - [ ] 6.3: Integration tests for regeneration flow

## Dev Notes

### Architecture Patterns
- Debounced auto-save prevents excessive API calls
- Dirty flags cascade: image change → video also dirty
- WebSocket events drive UI updates

### Source Tree Components

**New Files:**
- `components/Storyboard/ImagePromptEditor.tsx`
- `components/Storyboard/SeedInput.tsx`

**Modified Files:**
- `src/backend/api/sentences.ts` - Add regenerate endpoint
- `components/Storyboard/SceneInspector.tsx` - Add prompt editor

### References
- [Source: docs/stories/STORY-019-image-regeneration-override.md]
- [Source: src/backend/api/sentences.ts] - Existing sentences API

## UX/UI Considerations

### User Flow & Mental Model
This is the creator's fine-tuning moment. The AI generated an image, but it's *almost* right. Maybe the lighting is off, or there's an extra character. The prompt editor is their paintbrush — they tweak the words, hit regenerate, and see the result. Fast iteration, creative control, no fear of losing what they had.

### Visual Hierarchy & Token Usage

**Image Prompt Editor Layout:**
```
┌──────────────────────────────────────────────────────────┐
│ Image Prompt                                    145/500  │  ← Label + char count
│ ┌──────────────────────────────────────────────────────┐ │
│ │ A wide establishing shot of a futuristic city       │ │
│ │ at sunset, neon lights reflecting on wet streets,   │ │
│ │ cyberpunk aesthetic, volumetric lighting            │ │
│ │                                                     │ │
│ └──────────────────────────────────────────────────────┘ │
│ ✓ Saved                                                 │  ← Auto-save indicator
├──────────────────────────────────────────────────────────┤
│ Seed: [1234567890    ] [🎲]  □ Lock seed               │  ← Seed controls
├──────────────────────────────────────────────────────────┤
│           [Regenerate Image]  [🎲 New Seed]            │  ← Action buttons
└──────────────────────────────────────────────────────────┘
```

**Token Application:**

**Prompt Textarea:**
- Container: `bg-surface-0 border-border-color rounded-lg p-3`
- Focus state: `border-primary ring-1 ring-primary/20`
- Text: `text-text-primary text-sm font-sans leading-relaxed`
- Placeholder: `text-text-muted`
- Character count: `text-text-muted text-[10px]` — turns `text-warning` at 450+, `text-error` at 500

**Save Indicator:**
- "Saved": `text-success text-[10px]` with checkmark
- "Saving...": `text-text-muted text-[10px]` with spinner
- "Unsaved changes": `text-warning text-[10px]` with dot

**Seed Input:**
- Input: `bg-surface-1 border-border-color rounded-md w-32 font-mono text-sm`
- Random button (🎲): `bg-surface-2 hover:bg-surface-3 p-2 rounded-md`
- Lock checkbox: `accent-primary` with label `text-text-secondary text-sm`

**Action Buttons:**
- "Regenerate Image": `bg-primary hover:bg-primary-hover text-text-inverse font-medium px-4 py-2 rounded-lg`
- "New Seed" (secondary): `bg-surface-2 hover:bg-surface-3 text-text-primary border-border-color px-3 py-2 rounded-lg`
- Disabled state: `bg-primary-muted cursor-not-allowed opacity-60`

### Generation Progress State

When regeneration is in progress:
```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │              [Spinner]                              │ │
│ │           Generating... 45%                         │ │
│ │     ████████████████░░░░░░░░░░░░░░░░               │ │
│ │                                                     │ │
│ └──────────────────────────────────────────────────────┘ │
│            [Cancel Generation]                          │
└──────────────────────────────────────────────────────────┘
```

- Progress overlay: `bg-surface-0/80 backdrop-blur-sm absolute inset-0`
- Spinner: `text-primary animate-spin`
- Progress bar: `bg-primary h-2 rounded-full` on `bg-surface-3` track
- Cancel button: `text-text-muted hover:text-error`

### Error State

```
┌──────────────────────────────────────────────────────────┐
│ ⚠️ Generation failed                                     │
│ "GPU timeout — please try again"                        │
│                                                         │
│             [Retry]  [Use Previous Image]              │
└──────────────────────────────────────────────────────────┘
```

- Error container: `bg-error/5 border-error/30 rounded-lg p-4`
- Error icon: `text-error`
- Error message: `text-text-secondary text-sm`
- Retry button: `bg-error hover:bg-error/80`
- "Use Previous" (if available): `bg-surface-2 hover:bg-surface-3`

### Interaction Patterns

1. **Debounced Auto-Save:** 500ms after typing stops, save prompt silently
2. **Dirty State Cascade:**
   - Prompt changes → `isImageDirty = true`
   - Image dirty → `isVideoDirty = true` (cascade)
   - Show warning badges on IMAGE and VIDEO tabs
3. **Seed Behavior:**
   - Empty seed = random on each generation
   - Locked seed = same seed persists across regenerations
   - "New Seed" button generates random seed and starts regeneration
4. **Image Transition:** When new image arrives, crossfade from old to new (300ms)

### Visual Diff Comparison (Nice-to-Have)

**Side-by-Side Toggle:**
```
┌────────────────────┬────────────────────┐
│     Before         │      After         │
│   (old image)      │   (new image)      │
│                    │                    │
│      [Revert]      │     [Accept]       │
└────────────────────┴────────────────────┘
```

- Allow user to compare before committing to new image
- "Revert" restores previous image
- "Accept" confirms replacement (optional — auto-accept is also valid)

### Accessibility Considerations
- Textarea has `aria-describedby` pointing to character count
- Auto-save status announced via `aria-live="polite"` region
- Progress bar has `role="progressbar"` with proper ARIA attributes
- Seed input has `aria-label="Image generation seed"`

### Responsive Behavior
- **Desktop:** Full layout as shown
- **Mobile:** Seed controls collapse to icon-only buttons with tooltips
- Prompt textarea uses `min-h-[80px]` and expands with content

### Keyboard Shortcuts
- `Ctrl/Cmd + Enter`: Regenerate with current seed
- `Ctrl/Cmd + Shift + Enter`: Regenerate with new random seed
- `Escape`: Cancel active generation (if in progress)

### Edge Cases
- **Very long prompts:** Soft limit at 500 chars, hard limit at 1000 with warning
- **Empty prompt:** Disable regenerate button, show hint "Enter a prompt to generate"
- **Concurrent generations:** Only one active per scene; show "Already generating" if clicked again
- **Image history (future):** Consider storing last 3 seeds for easy rollback

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
