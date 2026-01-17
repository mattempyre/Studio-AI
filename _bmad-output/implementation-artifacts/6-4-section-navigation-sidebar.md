# Story 6.4: Section Navigation Sidebar

Status: ready-for-dev

## Story

As a **creator**,
I want **a sidebar showing all sections for quick navigation**,
so that **I can jump to specific parts of my video easily**.

## Acceptance Criteria

1. Sidebar displays all sections as a list
2. Each section shows: title, sentence count, completion status
3. Clicking section scrolls to that section in main view
4. Current section highlighted in sidebar
5. Sections can be collapsed/expanded
6. Progress indicator per section (% complete)
7. Sidebar can be toggled visible/hidden
8. Sticky positioning on scroll

## Tasks / Subtasks

- [ ] Task 1: Create SectionSidebar component (AC: 1, 7, 8)
  - [ ] 1.1: Create `components/Storyboard/SectionSidebar.tsx`
  - [ ] 1.2: Implement sticky positioning
  - [ ] 1.3: Add toggle visibility

- [ ] Task 2: Create SectionNavItem component (AC: 2, 3, 4, 6)
  - [ ] 2.1: Create `components/Storyboard/SectionNavItem.tsx`
  - [ ] 2.2: Display section info
  - [ ] 2.3: Handle click to scroll
  - [ ] 2.4: Show progress indicator

- [ ] Task 3: Implement scroll behavior (AC: 3, 4)
  - [ ] 3.1: Scroll to section on click
  - [ ] 3.2: Track current section on scroll
  - [ ] 3.3: Update sidebar highlight

- [ ] Task 4: Add section collapse (AC: 5)
  - [ ] 4.1: Collapsible section headers
  - [ ] 4.2: Persist collapse state

- [ ] Task 5: Write tests
  - [ ] 5.1: Unit tests for nav item rendering
  - [ ] 5.2: Scroll behavior tests
  - [ ] 5.3: Progress calculation tests

## Dev Notes

### Architecture Patterns
- Intersection Observer for current section tracking
- Smooth scroll to section
- Progress calculated from sentence completion status

### Source Tree Components

**New Files:**
- `components/Storyboard/SectionSidebar.tsx`
- `components/Storyboard/SectionNavItem.tsx`

**Modified Files:**
- `pages/Storyboard.tsx` - Add sidebar

### References
- [Source: docs/stories/STORY-026-section-navigation-sidebar.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-604]

## UX/UI Considerations

### User Flow & Mental Model
Think of this as the "chapter menu" in a book reader. Creators working on longer projects (documentaries, tutorials, multi-act stories) need to jump between major sections without endless scrolling. This sidebar is their table of contents — always visible, showing progress, enabling confident navigation.

### Visual Hierarchy & Token Usage

**Sidebar Container:**
- Width: `w-56` (224px) when expanded, `w-12` when collapsed (icon-only)
- Background: `bg-surface-1` with `border-r border-border-subtle`
- Position: `sticky top-0` for persistent visibility while main content scrolls

**Section Nav Item Design:**
```
┌──────────────────────────────┐
│ ▼ Introduction          12/12│  ← Current section (highlighted)
│   [████████████████] 100%    │  ← Progress bar
├──────────────────────────────┤
│ ▶ Act 1: The Problem    8/15 │  ← Collapsed section
│   [████████░░░░░░░░]  53%    │
├──────────────────────────────┤
│ ▶ Act 2: The Journey    0/22 │  ← Not started
│   [░░░░░░░░░░░░░░░░]   0%    │
└──────────────────────────────┘
```

**Token Application:**
- Current section: `bg-primary/10 border-l-2 border-primary`
- Default section: `bg-transparent hover:bg-surface-2`
- Section title: `text-text-primary text-sm font-medium`
- Sentence count: `text-text-muted text-[10px]`
- Progress bar track: `bg-surface-3 h-1 rounded-full`
- Progress bar fill: gradient based on completion
  - 0%: `bg-text-muted` (not started)
  - 1-99%: `bg-info` (in progress)
  - 100%: `bg-success` (complete)

**Collapse/Expand Chevron:**
- Rotates smoothly: `transform rotate-0 → rotate-90` with `duration-200`
- Color: `text-text-muted hover:text-text-primary`

### Interaction Patterns

1. **Click to Scroll:** Clicking a section smooth-scrolls main content to that section header
2. **Scroll Tracking:** As user scrolls main content, current section highlights automatically (Intersection Observer)
3. **Collapse Memory:** Expanded/collapsed state per section persists in localStorage
4. **Toggle Sidebar:** Button at bottom collapses entire sidebar to icons-only mode for more content space

### Scroll Synchronization Details
- Use Intersection Observer with `rootMargin: "-100px 0px -80%"` to trigger section highlight when ~20% visible
- Smooth scroll to section: `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- Account for sticky header offset (subtract header height from scroll position)

### Accessibility Considerations
- Sidebar has `role="navigation"` with `aria-label="Section navigation"`
- Each section item is a button with `aria-expanded` for collapse state
- Current section has `aria-current="true"`
- Progress values announced: `aria-label="Introduction section, 12 of 12 complete"`
- Keyboard navigation: Tab through items, Enter to scroll/toggle, Arrow keys for collapse

### Responsive Behavior
- **≥1024px:** Full sidebar visible
- **768-1023px:** Sidebar collapsed by default, hamburger toggle to expand
- **<768px:** Sidebar hidden, accessible via floating button (bottom-left), opens as drawer overlay

### Collapsed State Design
When sidebar is in icon-only mode:
- Show only section number or first letter: `[1] [2] [3]`
- Tooltip on hover shows full section name + progress
- Progress indicated by ring around the icon: `ring-2 ring-success` for complete

### Performance Considerations
- Debounce scroll handler (100ms) to prevent excessive Intersection Observer callbacks
- Cache section positions on mount, recalculate only on window resize
- Progress calculations memoized, only update when sentence status changes

### Empty State
- If no sections exist: "No sections yet" message with link to Script Editor

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
