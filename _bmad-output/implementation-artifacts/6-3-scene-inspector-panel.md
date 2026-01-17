# Story 6.3: Scene Inspector Panel

Status: ready-for-dev

## Story

As a **creator**,
I want **a detailed inspector panel for the selected scene**,
so that **I can view and edit all scene settings in one place**.

## Acceptance Criteria

1. Inspector panel appears on right side when scene selected
2. Panel shows large image preview
3. Panel shows video preview (if generated)
4. Tabs: IMAGE | VIDEO for switching views
5. Image tab shows: prompt editor, regenerate button, seed input
6. Video tab shows: camera controls, motion slider, regenerate button
7. Panel shows audio playback control
8. Panel shows sentence text (editable)
9. Panel shows generation status
10. Panel can be collapsed/expanded
11. Responsive: slide-over on mobile

## Tasks / Subtasks

- [ ] Task 1: Create SceneInspector component (AC: 1, 2, 3, 10)
  - [ ] 1.1: Create `components/Storyboard/SceneInspector.tsx`
  - [ ] 1.2: Add image preview with zoom
  - [ ] 1.3: Add video preview with playback
  - [ ] 1.4: Add collapse/expand toggle

- [ ] Task 2: Create InspectorTabs component (AC: 4, 5, 6)
  - [ ] 2.1: Create `components/Storyboard/InspectorTabs.tsx`
  - [ ] 2.2: Implement tab switching
  - [ ] 2.3: Add IMAGE tab content
  - [ ] 2.4: Add VIDEO tab content

- [ ] Task 3: Add audio playback (AC: 7)
  - [ ] 3.1: Create AudioPlayer component
  - [ ] 3.2: Add to inspector

- [ ] Task 4: Add sentence editing (AC: 8)
  - [ ] 4.1: Add inline sentence editor
  - [ ] 4.2: Auto-save on blur

- [ ] Task 5: Add status display (AC: 9)
  - [ ] 5.1: Show current generation status
  - [ ] 5.2: Show dirty flags

- [ ] Task 6: Make responsive (AC: 11)
  - [ ] 6.1: Slide-over behavior on mobile
  - [ ] 6.2: Full panel on desktop

- [ ] Task 7: Write tests
  - [ ] 7.1: Unit tests for tabs
  - [ ] 7.2: Unit tests for media preview
  - [ ] 7.3: Responsive behavior tests

## Dev Notes

### Architecture Patterns
- Controlled by selected scene state from parent
- Tab content lazy loaded
- Media previews with loading states

### Source Tree Components

**New Files:**
- `components/Storyboard/SceneInspector.tsx`
- `components/Storyboard/InspectorTabs.tsx`
- `components/Storyboard/AudioPlayer.tsx`

**Modified Files:**
- `pages/Storyboard.tsx` - Add inspector panel

### References
- [Source: docs/stories/STORY-025-scene-inspector-panel.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-603]

## UX/UI Considerations

### User Flow & Mental Model
This is the creator's "control room" for a single scene. Whether they've clicked a row in table view or a card in grid view, they arrive here expecting to see everything about this moment: the visual, the sound, the prompt, the controls. It's detailed work — tweaking, reviewing, regenerating.

### Visual Hierarchy & Token Usage

**Panel Container:**
- Width: `w-96` (384px) on desktop, full-width slide-over on mobile
- Background: `bg-surface-1` with `border-l border-border-color`
- Header: `bg-surface-2` sticky with panel controls

**Panel Layout Structure:**
```
┌────────────────────────────────────┐
│ [←] Scene #12 of 45    [⊟] [✕]    │  ← Header with nav + collapse
├────────────────────────────────────┤
│ ┌────────────────────────────────┐ │
│ │                                │ │
│ │        Media Preview           │ │  ← Large preview area
│ │         (expandable)           │ │
│ │                                │ │
│ └────────────────────────────────┘ │
│  [ IMAGE ]  [ VIDEO ]              │  ← Tab switcher
├────────────────────────────────────┤
│  Narration                         │
│  "The camera pans across the..."   │  ← Editable text
├────────────────────────────────────┤
│  🔊 ▶ ━━━━━━━━○━━━━ 0:04 / 0:08   │  ← Audio player
├────────────────────────────────────┤
│  [Tab-specific controls below]     │
│  IMAGE: prompt editor, seed,       │
│         regenerate button          │
│  VIDEO: camera, motion, regenerate │
├────────────────────────────────────┤
│  Status: ✓ Complete                │  ← Generation status
└────────────────────────────────────┘
```

**Token Application:**
- Panel header: `bg-surface-2 border-b border-border-subtle`
- Tab active: `bg-primary text-text-inverse`
- Tab inactive: `bg-surface-3 text-text-muted hover:bg-surface-4`
- Editable narration: `bg-surface-0 border-border-color focus:border-primary rounded-lg p-3`
- Audio player track: `bg-surface-3`, progress: `bg-primary`
- Regenerate button: `bg-primary hover:bg-primary-hover`

**Media Preview Area:**
- Aspect ratio: 16:9 maintained with `aspect-video`
- Background for loading: `bg-surface-3` with centered spinner
- Image zoom: Click to expand in lightbox modal
- Video: Native controls with custom styled play button overlay

### Tab-Specific Content

**IMAGE Tab:**
- Prompt textarea: `min-h-[100px]` with character count in `text-text-muted text-[10px]`
- Seed input: `w-24` numeric input with "Random" checkbox
- Regenerate button: Full width, `mt-4`

**VIDEO Tab:**
- Camera dropdown: `bg-surface-2 border-border-color`
- Motion slider: Custom range input with `accent-primary`
- Preview icons showing movement direction (animated on hover)

### Interaction Patterns

1. **Auto-save:** Narration and prompt changes debounce (500ms) then auto-save with subtle "Saved" indicator
2. **Dirty State Indication:** When content is modified but unsaved, show `text-warning` dot next to "Saved"
3. **Quick Navigation:** Arrow buttons `[←] [→]` in header move to prev/next scene
4. **Keyboard Shortcuts:**
   - `Cmd/Ctrl + S`: Force save
   - `Space`: Play/pause audio
   - `Escape`: Close panel (or deselect on mobile)

### Accessibility Considerations
- Panel is a landmark: `role="complementary"` with `aria-label="Scene inspector"`
- Tabs use `role="tablist"` with `role="tab"` and `aria-selected`
- Audio player has full keyboard support and `aria-label` on all controls
- Close button has `aria-label="Close inspector panel"`

### Responsive Behavior
- **≥1024px:** Fixed right panel, always visible when scene selected
- **768-1023px:** Slide-over panel from right, covers ~60% of viewport
- **<768px:** Full-screen modal with swipe-to-close gesture
- Collapse/expand toggle minimizes to just the header bar (saves space for main content)

### Loading & Empty States
- **Loading media:** Skeleton placeholder with pulse animation
- **No image yet:** Placeholder with "Generate Image" CTA
- **Failed generation:** Red tinted placeholder with error message and retry button

### Smooth Transitions
- Panel slide-in: `transform translate-x-full → translate-x-0` with `duration-300 ease-out`
- Tab content: `opacity-0 → opacity-100` fade with `duration-200`
- Media swap: Crossfade between image and video tabs

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
