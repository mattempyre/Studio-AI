# Story 9.4: Global Project Dropdown

Status: ready-for-dev

## Story

As a **creator**,
I want **a global project selector in the navigation**,
so that **I can quickly switch between projects without going to the dashboard**.

## Acceptance Criteria

1. Project dropdown in main navigation/sidebar
2. Shows current project name
3. Lists all projects in dropdown
4. Clicking project switches context
5. "New Project" option in dropdown
6. Shows project status indicator
7. Recent projects shown first
8. Search within dropdown for many projects

## Tasks / Subtasks

- [ ] Task 1: Create ProjectDropdown component (AC: 1, 2, 3)
  - [ ] 1.1: Create `components/Navigation/ProjectDropdown.tsx`
  - [ ] 1.2: Show current project name
  - [ ] 1.3: Fetch and list all projects

- [ ] Task 2: Implement project switching (AC: 4)
  - [ ] 2.1: Handle click to switch
  - [ ] 2.2: Update URL/route
  - [ ] 2.3: Load new project data

- [ ] Task 3: Add new project option (AC: 5)
  - [ ] 3.1: Add "New Project" item
  - [ ] 3.2: Navigate to create flow

- [ ] Task 4: Add status indicators (AC: 6)
  - [ ] 4.1: Show status icon per project
  - [ ] 4.2: Color coding for status

- [ ] Task 5: Add sorting and search (AC: 7, 8)
  - [ ] 5.1: Sort by recent first
  - [ ] 5.2: Add search input in dropdown

- [ ] Task 6: Integrate into layout
  - [ ] 6.1: Add to Sidebar component
  - [ ] 6.2: Connect to global state

- [ ] Task 7: Write tests
  - [ ] 7.1: Unit tests for dropdown
  - [ ] 7.2: Unit tests for project switching

## Dev Notes

### Architecture Patterns
- Global state for current project
- URL-based project context
- Dropdown fetches projects on open

### Source Tree Components

**New Files:**
- `components/Navigation/ProjectDropdown.tsx`

**Modified Files:**
- `components/Sidebar.tsx` or `components/Navigation.tsx` - Add dropdown
- `App.tsx` - Global project context

### References
- [Source: docs/stories/STORY-037-global-project-dropdown.md]
- [Source: context/AppContext.tsx] - App context

## UX/UI Considerations

### User Flow & Mental Model
Imagine Elena working on 5 client projects in one day. She needs to hop between them constantly — finishing audio on one, checking exports on another. The global dropdown is her "quick switch" — like browser tabs but for projects. It should feel as fast and reliable as Cmd+Tab between apps.

### Visual Hierarchy & Token Usage

**Dropdown Trigger (Collapsed State):**
```
┌─────────────────────────────────────┐
│ 📁 Brand Video 2024  ▼  ●          │  ← Current project + status dot
└─────────────────────────────────────┘
```

- Container: `bg-surface-2 hover:bg-surface-3 border-border-color rounded-lg px-3 py-2 cursor-pointer`
- Project icon: `text-text-muted`
- Project name: `text-text-primary font-medium truncate max-w-[180px]`
- Chevron: `text-text-muted ml-2`
- Status dot: Small circle indicating project status
  - `bg-warning` = generating
  - `bg-success` = ready
  - `bg-text-muted` = draft

**Dropdown Menu (Expanded):**
```
┌─────────────────────────────────────────┐
│ 🔍 Search projects...                   │
├─────────────────────────────────────────┤
│ RECENT                                  │
│ ┌─────────────────────────────────────┐ │
│ │ ● Brand Video 2024       (current) │ │ ← Selected
│ │ ○ Tutorial Series                  │ │
│ │ ● Product Demo            Ready    │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ + New Project                           │
│ 📊 All Projects                         │
└─────────────────────────────────────────┘
```

**Token Application:**

**Dropdown Container:**
- Background: `bg-surface-2 border-border-color rounded-xl shadow-lg`
- Width: `w-72` (288px) — wide enough for long names
- Max height: `max-h-80` with `overflow-y-auto`

**Search Input:**
- Style: `bg-surface-1 border-border-subtle rounded-lg px-3 py-2 text-sm`
- Placeholder: `text-text-muted`
- Icon: `text-text-muted` magnifying glass

**Section Label:**
- Style: `text-text-muted text-[10px] font-bold uppercase tracking-wider px-3 pt-3 pb-1`

**Project Item:**
- Default: `px-3 py-2 hover:bg-surface-3 cursor-pointer flex items-center gap-3`
- Selected/Current: `bg-primary/10 border-l-2 border-primary`
- Status indicator: Same dot colors as trigger
- Project name: `text-text-primary flex-1 truncate`
- Status label (e.g., "Ready"): `text-text-muted text-[10px]`
- "(current)" badge: `text-primary text-[10px] font-medium`

**Action Items:**
- "+ New Project": `text-primary font-medium hover:bg-primary/10`
- "All Projects": `text-text-secondary hover:bg-surface-3` with icon

### Interaction Patterns

1. **Open Dropdown:** Click trigger or press `Ctrl/Cmd + K` (global shortcut)
2. **Search:** Instant filtering as you type; if no match, show "No projects found"
3. **Keyboard Navigation:**
   - Arrow up/down: Move highlight
   - Enter: Select highlighted project
   - Escape: Close dropdown
   - Type: Auto-focus search
4. **Project Switch:** On selection, close dropdown, update URL, load project data
5. **New Project:** Opens create modal or navigates to create page
6. **All Projects:** Navigates to full dashboard

### Recent Projects Logic
- Show last 5 accessed projects (sorted by `lastAccessedAt` timestamp)
- Update timestamp whenever project is opened
- If user has <5 projects, show all under "RECENT"
- If user has 0 projects, hide recent section, show only "+ New Project"

### Click-Outside Behavior
- Clicking outside dropdown closes it
- Clicking trigger while open also closes it (toggle behavior)

### Transition & Animation
- Dropdown appears with `opacity-0 → opacity-100` and `scale-95 → scale-100`
- Duration: `150ms` ease-out
- Stagger project items if using motion library (optional)

### Accessibility Considerations
- Dropdown trigger has `aria-haspopup="listbox"` and `aria-expanded`
- Project list uses `role="listbox"` with `role="option"` items
- Selected option has `aria-selected="true"`
- Search input has `aria-label="Search projects"`
- Global shortcut announced: "Press Cmd K to switch projects"

### Responsive Behavior
- **Desktop (≥768px):** Dropdown in sidebar/header, full functionality
- **Mobile (<768px):** Dropdown opens as bottom sheet instead of popover
  - Slide up from bottom
  - Drag handle at top for swipe-to-close
  - Full width minus padding

### Loading States
- While fetching projects: Show skeleton items (3 placeholder rows)
- On error: "Couldn't load projects" with retry button

### Edge Cases
- **Long project names:** Truncate with ellipsis at ~25 characters
- **Many projects (>20):** Show "View all X projects" link to dashboard
- **Active generation:** Pulsing status dot to indicate ongoing work

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
