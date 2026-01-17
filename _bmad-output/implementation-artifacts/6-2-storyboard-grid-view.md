# Story 6.2: Storyboard Grid View

Status: ready-for-dev

## Story

As a **creator**,
I want **to see all scenes in a card-based grid layout**,
so that **I can visually compare scenes side by side**.

## Acceptance Criteria

1. Grid view displays sentences as cards
2. Cards show: image thumbnail, narration, camera movement, style indicator
3. Cards are clickable to select scene
4. Selected card highlighted visually
5. Grid is responsive (2-4 columns based on width)
6. Cards show generation status overlay
7. Drag-and-drop reordering (optional/future)
8. Toggle between table and grid views

## Tasks / Subtasks

- [ ] Task 1: Create StoryboardGrid component (AC: 1, 5)
  - [ ] 1.1: Create `components/Storyboard/StoryboardGrid.tsx`
  - [ ] 1.2: Implement responsive grid layout
  - [ ] 1.3: Calculate columns based on container width

- [ ] Task 2: Create SceneCard component (AC: 2, 3, 4, 6)
  - [ ] 2.1: Create `components/Storyboard/SceneCard.tsx`
  - [ ] 2.2: Add image thumbnail
  - [ ] 2.3: Add narration text (truncated)
  - [ ] 2.4: Add camera movement icon
  - [ ] 2.5: Add status overlay

- [ ] Task 3: Add view toggle (AC: 8)
  - [ ] 3.1: Create ViewToggle component
  - [ ] 3.2: Add to Storyboard page
  - [ ] 3.3: Persist view preference

- [ ] Task 4: Write tests
  - [ ] 4.1: Unit tests for grid layout
  - [ ] 4.2: Unit tests for card rendering
  - [ ] 4.3: Responsive breakpoint tests

## Dev Notes

### Architecture Patterns
- CSS Grid for responsive layout
- Cards share selection state with table view
- Thumbnails lazy loaded for performance

### Source Tree Components

**New Files:**
- `components/Storyboard/StoryboardGrid.tsx`
- `components/Storyboard/SceneCard.tsx`
- `components/Storyboard/ViewToggle.tsx`

**Modified Files:**
- `pages/Storyboard.tsx` - Add grid view option

### References
- [Source: docs/stories/STORY-024-storyboard-grid-view.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-602]

## UX/UI Considerations

### User Flow & Mental Model
Meet Sofia, an animator checking visual consistency across her 60-scene short film. She wants to see images side-by-side, spot color grading issues, and ensure her visual narrative flows. Grid view is her "mood board mode" — visual-first, pattern recognition, creative review.

### Visual Hierarchy & Token Usage

**Grid Container:**
- Background: `bg-surface-0` for maximum contrast with cards
- Gap: `gap-4` (16px) between cards
- Padding: `p-4` container padding

**SceneCard Design:**
```
┌─────────────────────────────┐
│ ┌─────────────────────────┐ │
│ │                         │ │  ← Image area (16:9)
│ │      Thumbnail          │ │
│ │                         │ │
│ │  [Status Badge]         │ │  ← Top-right overlay
│ └─────────────────────────┘ │
│ "Narration text preview..." │  ← 2 lines max, truncated
│ 🎥 Pan Left  │  ●●○ Motion  │  ← Camera + motion indicator
└─────────────────────────────┘
```

**Card Tokens:**
- Card background: `bg-surface-2` with `border-border-subtle`
- Selected card: `ring-2 ring-primary ring-offset-2 ring-offset-surface-0`
- Hover state: `border-border-color` with subtle `shadow-md`
- Narration text: `text-text-secondary text-sm` with `line-clamp-2`
- Camera movement icon: `text-text-muted` with label in `text-[10px]`

**Status Badge Overlay:**
- Position: `absolute top-2 right-2`
- Style: `backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-medium`
- Colors match table view status tokens

**Motion Strength Indicator:**
- 3 dots showing intensity: `●●○` = 0.66 strength
- Filled dots: `text-primary`, empty: `text-text-muted`

### Interaction Patterns

1. **Selection:** Single click selects card; selected state persists across view toggle
2. **Quick Preview:** Hover for 500ms shows larger tooltip preview (optional enhancement)
3. **Context Menu:** Right-click opens menu: "Regenerate Image", "Edit Prompt", "Copy Prompt"
4. **View Toggle Animation:** Cards fade/scale in when switching from table view (staggered 50ms per card)

### Responsive Column Layout
| Viewport | Columns | Card Min-Width |
|----------|---------|----------------|
| ≥1280px | 4 | 280px |
| 1024-1279px | 3 | 280px |
| 768-1023px | 2 | 300px |
| <768px | 1 | 100% |

Use CSS Grid with `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`

### Accessibility Considerations
- Cards are keyboard navigable with arrow keys (grid navigation pattern)
- Each card has `role="gridcell"` within a `role="grid"` container
- Selected card has `aria-selected="true"`
- Image has descriptive `alt` text
- Status badge includes `sr-only` text for screen readers

### View Toggle Component
- Two-button segmented control: Table icon | Grid icon
- Active state: `bg-primary text-text-inverse`
- Inactive state: `bg-surface-3 text-text-muted`
- Persist preference in localStorage under `storyboard_view_preference`

### Empty & Loading States
- **Loading:** Skeleton cards with pulsing image placeholder and text lines
- **No images generated:** Show card with `bg-surface-3` placeholder and "Generate Image" button

### Performance Considerations
- Virtualize grid for >100 cards (react-virtuoso or similar)
- Use `loading="lazy"` on images
- Generate low-res placeholders for immediate display, swap to full-res on load

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
