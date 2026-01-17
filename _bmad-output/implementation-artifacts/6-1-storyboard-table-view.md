# Story 6.1: Storyboard Table View

Status: ready-for-dev

## Story

As a **creator**,
I want **to see all scenes in a linear table format**,
so that **I can review the entire video sequence at a glance**.

## Acceptance Criteria

1. Table view displays all sentences as rows
2. Columns: thumbnail, narration text, section, status
3. Thumbnail shows generated image (or placeholder)
4. Status icons: pending, generating, complete, failed
5. Rows are clickable to select scene
6. Selected scene opens in inspector panel
7. Rows grouped by section with section headers
8. Keyboard navigation (up/down arrows)
9. Sortable by column (optional)
10. Responsive layout for different screen sizes

## Tasks / Subtasks

- [ ] Task 1: Create StoryboardTable component (AC: 1, 2)
  - [ ] 1.1: Create `components/Storyboard/StoryboardTable.tsx`
  - [ ] 1.2: Define column structure
  - [ ] 1.3: Implement table header

- [ ] Task 2: Create StoryboardRow component (AC: 3, 4, 5, 6)
  - [ ] 2.1: Create `components/Storyboard/StoryboardRow.tsx`
  - [ ] 2.2: Add thumbnail with lazy loading
  - [ ] 2.3: Add status icons
  - [ ] 2.4: Handle click to select

- [ ] Task 3: Add section grouping (AC: 7)
  - [ ] 3.1: Create SectionHeader component
  - [ ] 3.2: Group rows by section
  - [ ] 3.3: Collapsible sections (optional)

- [ ] Task 4: Add keyboard navigation (AC: 8)
  - [ ] 4.1: Implement up/down arrow handlers
  - [ ] 4.2: Focus management

- [ ] Task 5: Create Storyboard page layout (AC: 10)
  - [ ] 5.1: Create `pages/Storyboard.tsx`
  - [ ] 5.2: Add table/grid view toggle
  - [ ] 5.3: Add inspector panel slot

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for table rendering
  - [ ] 6.2: Unit tests for row selection
  - [ ] 6.3: Keyboard navigation tests

## Dev Notes

### Architecture Patterns
- Virtualized list for performance with many rows
- Lazy loading thumbnails for efficiency
- Grouped by section for organization

### Source Tree Components

**New Files:**
- `components/Storyboard/StoryboardTable.tsx`
- `components/Storyboard/StoryboardRow.tsx`
- `components/Storyboard/SectionHeader.tsx`
- `pages/Storyboard.tsx`

**Modified Files:**
- `App.tsx` - Add Storyboard route

### References
- [Source: docs/stories/STORY-023-storyboard-table-view.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-601]

## UX/UI Considerations

### User Flow & Mental Model
Imagine Kai reviewing a 120-sentence documentary. He needs to scan the entire narrative structure, spot missing images, and jump to problematic scenes. The table view is his "spreadsheet mode" — dense information, scannable at a glance, efficient for editing workflows.

### Visual Hierarchy & Token Usage

**Table Structure:**
- Table container: `bg-surface-1` with `border-border-subtle`
- Table header row: `bg-surface-2` with `text-text-muted` uppercase labels, `text-[10px]` font
- Row zebra striping: alternate between `bg-surface-1` and `bg-surface-0` for visual rhythm
- Selected row: `bg-primary/10` with `border-l-2 border-primary` left accent
- Hover state: `bg-surface-2` transition

**Column Design:**
| Column | Width | Content | Alignment |
|--------|-------|---------|-----------|
| Thumbnail | 80px fixed | 16:9 aspect, lazy loaded | Center |
| Narration | Flex (fill) | Truncated with ellipsis | Left |
| Section | 120px | Section title chip | Left |
| Status | 80px | Icon + label | Center |

**Status Indicators:**
- Pending: `bg-warning/20 text-warning` with clock icon
- Generating: `bg-info/20 text-info` with animated spinner
- Complete: `bg-success/20 text-success` with checkmark
- Failed: `bg-error/20 text-error` with X icon

**Section Headers:**
- Full-width row with `bg-surface-3` background
- Section title in `text-primary` with `text-sm font-semibold`
- Collapse chevron: `text-text-muted` rotating 90° when expanded
- Sentence count badge: `bg-surface-4 text-text-secondary text-[10px]`

### Interaction Patterns

1. **Row Selection:** Single click selects and opens inspector panel; no double-click needed
2. **Keyboard Navigation:**
   - ↑/↓: Move selection between rows
   - Enter: Open selected scene in inspector
   - Escape: Deselect current row
   - Home/End: Jump to first/last row
3. **Section Collapse:** Click section header to collapse/expand; collapsed state persists in localStorage
4. **Scroll Sync:** When inspector updates a scene, table auto-scrolls to keep it visible

### Accessibility Considerations
- Table uses semantic `<table>` with proper `<thead>`, `<tbody>`, `<th scope="col">`
- Rows have `tabindex="0"` for keyboard focus
- Selected row has `aria-selected="true"`
- Section headers use `role="rowgroup"` with `aria-expanded`
- Thumbnail images have `alt` text: "Scene thumbnail for: {narration preview}"

### Responsive Behavior
- **≥1024px:** Full table with all columns
- **768-1023px:** Hide Section column, show section in tooltip on hover
- **<768px:** Switch to a stacked card layout (one row = one card) instead of table

### Performance Considerations
- Use virtualized list (react-window or similar) for >50 rows
- Thumbnails lazy load with intersection observer
- Only render expanded sections' rows

### Empty & Loading States
- **Loading:** Skeleton rows with `bg-surface-2 animate-pulse` (show 5 skeleton rows)
- **Empty project:** Centered message: "No scenes yet. Generate a script to get started." with action link to Script Editor

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
