# Story 5.2: Camera Movement Controls

Status: ready-for-dev

## Story

As a **creator**,
I want **to select camera movements and motion intensity for each scene**,
so that **I can control the visual dynamics of my video**.

## Acceptance Criteria

1. Camera movement dropdown in scene inspector (static, pan_left, pan_right, zoom_in, zoom_out, orbit, truck)
2. Motion strength slider (0.0-1.0)
3. Visual preview/icon showing movement direction
4. Changes auto-save to sentence record
5. Changing camera or motion sets `isVideoDirty: true`
6. Default camera movement is "static"
7. Default motion strength is 0.5
8. Bulk apply option for entire section
9. Movement presets for common combinations

## Tasks / Subtasks

- [ ] Task 1: Create CameraMovementSelector component (AC: 1, 3)
  - [ ] 1.1: Create `components/Storyboard/CameraMovementSelector.tsx`
  - [ ] 1.2: Add dropdown with movement options
  - [ ] 1.3: Add directional icons for each movement

- [ ] Task 2: Create MotionStrengthSlider component (AC: 2)
  - [ ] 2.1: Create `components/Storyboard/MotionStrengthSlider.tsx`
  - [ ] 2.2: Implement slider with 0.0-1.0 range
  - [ ] 2.3: Show numeric value label

- [ ] Task 3: Update sentence API (AC: 4, 5, 6, 7)
  - [ ] 3.1: Add cameraMovement and motionStrength to PUT endpoint
  - [ ] 3.2: Set isVideoDirty on change
  - [ ] 3.3: Set defaults for new sentences

- [ ] Task 4: Add bulk apply (AC: 8)
  - [ ] 4.1: Add "Apply to Section" button
  - [ ] 4.2: Create batch update endpoint
  - [ ] 4.3: Update all sentences in section

- [ ] Task 5: Integrate into SceneInspector (AC: 1, 2)
  - [ ] 5.1: Add CameraMovementSelector
  - [ ] 5.2: Add MotionStrengthSlider
  - [ ] 5.3: Wire to sentence update

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for components
  - [ ] 6.2: Unit tests for dirty flag logic

## Dev Notes

### Camera Movement Options
- `static` - No movement
- `pan_left` - Camera moves left
- `pan_right` - Camera moves right
- `zoom_in` - Camera zooms in
- `zoom_out` - Camera zooms out
- `orbit` - Camera orbits around subject
- `truck` - Camera moves parallel to subject

### Source Tree Components

**New Files:**
- `components/Storyboard/CameraMovementSelector.tsx`
- `components/Storyboard/MotionStrengthSlider.tsx`

**Modified Files:**
- `src/backend/api/sentences.ts` - Add camera/motion fields
- `components/Storyboard/SceneInspector.tsx` - Add controls

### References
- [Source: docs/stories/STORY-021-camera-movement-controls.md]
- [Source: src/backend/db/schema.ts] - cameraMovement and motionStrength fields

## UX/UI Considerations

### User Flow & Mental Model
Think of these controls like a film director's shot list. The creator isn't just picking technical settings — they're crafting emotion. A slow zoom-in creates intimacy; a fast pan left implies urgency. The UI should feel creative, not like configuring database fields.

### Visual Hierarchy & Token Usage

**Camera Movement Selector:**
```
┌─────────────────────────────────────────────────┐
│ Camera Movement                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │  ← → Pan Left                          ▼   │ │  ← Dropdown with icon preview
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐       │  ← Quick-select icons
│ │   ●   │ │  ←    │ │   →   │ │  ⊕    │       │
│ │Static │ │ Pan L │ │ Pan R │ │ Zoom+ │       │
│ └───────┘ └───────┘ └───────┘ └───────┘       │
│ ┌───────┐ ┌───────┐ ┌───────┐                 │
│ │  ⊖    │ │  ↻    │ │  ↔    │                 │
│ │ Zoom- │ │ Orbit │ │ Truck │                 │
│ └───────┘ └───────┘ └───────┘                 │
└─────────────────────────────────────────────────┘
```

**Token Application:**

**Dropdown:**
- Container: `bg-surface-2 border-border-color rounded-lg`
- Selected state: `bg-primary/10 border-primary`
- Dropdown items: `hover:bg-surface-3 px-3 py-2`
- Movement icon: `text-primary mr-2`
- Label: `text-text-primary`

**Quick-Select Icon Grid (Alternative/Optional):**
- Icon button: `bg-surface-2 hover:bg-surface-3 border-border-subtle rounded-lg p-2 w-14 h-14`
- Selected: `bg-primary/10 border-primary ring-2 ring-primary`
- Icon: `text-text-primary text-lg`
- Label: `text-text-muted text-[10px] mt-1`

**Movement Icons (Custom or Lucide):**
| Movement | Icon Representation | Animation on Hover |
|----------|-------------------|-------------------|
| Static | Solid dot ● | None |
| Pan Left | Left arrow ← | Slide left |
| Pan Right | Right arrow → | Slide right |
| Zoom In | Plus in circle ⊕ | Scale up |
| Zoom Out | Minus in circle ⊖ | Scale down |
| Orbit | Circular arrow ↻ | Rotate |
| Truck | Left-right arrow ↔ | Horizontal slide |

### Motion Strength Slider

```
┌─────────────────────────────────────────────────┐
│ Motion Intensity                        0.65   │  ← Label + current value
│ ○━━━━━━━━━━━━━━━━●━━━━━━━━━━○                   │  ← Slider with labeled endpoints
│ Subtle                            Dramatic     │
└─────────────────────────────────────────────────┘
```

**Token Application:**
- Track: `bg-surface-3 h-2 rounded-full`
- Fill (left of thumb): `bg-primary`
- Thumb: `bg-primary w-4 h-4 rounded-full shadow-md border-2 border-surface-0`
- Labels: `text-text-muted text-[10px]`
- Current value: `text-text-primary font-mono text-sm`

**Slider Behavior:**
- Step: 0.05 (or continuous with display rounding)
- Shows numeric value updating in real-time as thumb moves
- Optional: Snap to 0.25, 0.5, 0.75 with slight haptic indication

### Presets Section

```
┌─────────────────────────────────────────────────┐
│ Quick Presets                    [Apply to All]│
│ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ Cinematic│ │ Dynamic  │ │ Subtle   │        │
│ │ Zoom 0.6 │ │ Pan 0.8  │ │ Static   │        │
│ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────┘
```

**Preset Chips:**
- Style: `bg-surface-2 hover:bg-surface-3 border-border-subtle rounded-lg px-3 py-2`
- Selected: `bg-primary/10 border-primary`
- Preset name: `text-text-primary text-sm font-medium`
- Preset values: `text-text-muted text-[10px]`

**Presets Definitions:**
- **Cinematic:** Zoom In, 0.6 intensity
- **Dynamic:** Pan Left/Right (alternating), 0.8 intensity
- **Subtle:** Static or gentle zoom, 0.3 intensity
- **Documentary:** Slow zoom out, 0.4 intensity
- **Action:** Fast pan, 0.9 intensity

### Bulk Apply Modal

```
┌────────────────────────────────────────────────┐
│ Apply to Section                               │
│                                                │
│ Apply "Zoom In @ 0.6" to all 15 scenes        │
│ in "Act 1: Introduction"?                      │
│                                                │
│ ⚠️ This will mark all videos as dirty.         │
│                                                │
│              [Cancel]  [Apply to 15 Scenes]   │
└────────────────────────────────────────────────┘
```

### Interaction Patterns

1. **Instant Preview:** When hovering over movement icons, show subtle animation indicating the motion direction
2. **Auto-Save:** Changes save after 300ms debounce; show subtle "Saved" indicator
3. **Dirty Indicator:** When camera/motion changes, show yellow dot next to VIDEO tab indicating regeneration needed
4. **Keyboard Support:** Arrow keys navigate movement options, Enter selects

### Accessibility Considerations
- Dropdown uses `role="listbox"` with `role="option"` items
- Slider has `role="slider"` with proper `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Motion labels are descriptive for screen readers: "Pan left camera movement"
- Icon buttons have `aria-label` descriptions

### Responsive Behavior
- **Desktop:** Side-by-side dropdown and slider
- **Tablet:** Stacked layout
- **Mobile:** Full-width controls, touch-friendly slider with larger hit area (48px thumb)

### Visual Feedback for Dirty State
- When camera/motion changes:
  - Show `text-warning` dot on VIDEO tab
  - Toast: "Video will regenerate with new camera settings"
  - If video already exists, show "Re-generate Video" button glowing

### Edge Cases
- **Bulk apply to mixed states:** Warn that existing custom settings will be overwritten
- **Motion strength 0:** Effectively makes any movement "static" — consider disabling movement dropdown or showing hint

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
