# Story 9.3: Project Dashboard

Status: ready-for-dev

## Story

As a **creator**,
I want **a dashboard showing all my projects**,
so that **I can manage and navigate between projects easily**.

## Acceptance Criteria

1. Dashboard lists all projects
2. Each project shows: name, status, thumbnail, date
3. Projects sortable by date, name, status
4. Search/filter projects
5. Create new project button
6. Delete project with confirmation
7. Project card shows completion percentage
8. Quick actions: open, delete, duplicate

## Tasks / Subtasks

- [ ] Task 1: Create ProjectDashboard page (AC: 1)
  - [ ] 1.1: Create `pages/Dashboard.tsx`
  - [ ] 1.2: Fetch projects from API
  - [ ] 1.3: Implement loading state

- [ ] Task 2: Create ProjectCard component (AC: 2, 7)
  - [ ] 2.1: Create `components/Dashboard/ProjectCard.tsx`
  - [ ] 2.2: Show project thumbnail
  - [ ] 2.3: Show completion progress

- [ ] Task 3: Add sorting and filtering (AC: 3, 4)
  - [ ] 3.1: Add sort dropdown
  - [ ] 3.2: Add search input
  - [ ] 3.3: Implement client-side filtering

- [ ] Task 4: Add CRUD actions (AC: 5, 6, 8)
  - [ ] 4.1: Create project button
  - [ ] 4.2: Delete with confirmation dialog
  - [ ] 4.3: Duplicate project (copy)

- [ ] Task 5: Add routing
  - [ ] 5.1: Make dashboard the home page
  - [ ] 5.2: Navigate to project on click

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for card rendering
  - [ ] 6.2: Unit tests for sorting/filtering
  - [ ] 6.3: Integration tests for CRUD

## Dev Notes

### Project Status
- `draft` - Script not generated
- `generating` - Generation in progress
- `ready` - All assets complete

### Source Tree Components

**New Files:**
- `pages/Dashboard.tsx`
- `components/Dashboard/ProjectCard.tsx`
- `components/Dashboard/ProjectGrid.tsx`

**Modified Files:**
- `App.tsx` - Add dashboard route
- `src/backend/api/projects.ts` - Add duplicate endpoint

### References
- [Source: docs/stories/STORY-036-project-dashboard.md]
- [Source: types.ts] - Project type definition

## UX/UI Considerations

### User Flow & Mental Model
This is the creator's "home base" — the first thing they see when opening the app. Like walking into a studio and seeing all your projects laid out on a table. Quick scanning, easy grabbing, confident organization. For creators with 20+ projects, finding the right one should feel instant.

### Visual Hierarchy & Token Usage

**Dashboard Layout:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  My Projects                           [Sort ▼]  [🔍 Search...]  [+ New] │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│  │ Thumbnail  │  │ Thumbnail  │  │ Thumbnail  │  │    + New   │       │
│  │            │  │            │  │            │  │   Project  │       │
│  │ ██████ 85% │  │ ██░░░░ 20% │  │ [Ready]    │  │            │       │
│  ├────────────┤  ├────────────┤  ├────────────┤  │            │       │
│  │ Tutorial V1 │  │ Brand Intro │  │ Demo Reel  │  │            │       │
│  │ 3 days ago  │  │ Yesterday   │  │ Last week  │  └────────────┘       │
│  │ ⋮ More     │  │ ⋮ More     │  │ ⋮ More     │                       │
│  └────────────┘  └────────────┘  └────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**Token Application:**

**Page Header:**
- Title: `text-text-primary text-2xl font-semibold`
- Sort dropdown: `bg-surface-2 border-border-color rounded-lg`
- Search input: `bg-surface-1 border-border-color focus:border-primary rounded-lg`
- "+ New" button: `bg-primary hover:bg-primary-hover text-text-inverse`

**Project Card:**
- Card background: `bg-surface-2 hover:bg-surface-3 rounded-xl border-border-subtle hover:border-border-color transition-all`
- Thumbnail area: `aspect-video bg-surface-3 rounded-t-xl overflow-hidden`
- Placeholder (no thumbnail): Gradient from `surface-3` to `surface-4` with project icon
- Progress bar: `h-1 rounded-full` at bottom of thumbnail area
  - Track: `bg-surface-0/50`
  - Fill: `bg-primary` (generating) or `bg-success` (complete)
- Status badge (if complete): `absolute top-2 right-2 bg-success text-text-inverse text-[10px] px-2 py-0.5 rounded-full`
- Project name: `text-text-primary font-medium truncate`
- Date: `text-text-muted text-sm`
- More menu (⋮): `text-text-muted hover:text-text-primary` appears on hover

**New Project Card:**
- Dashed border: `border-2 border-dashed border-border-color hover:border-primary`
- Plus icon: `text-text-muted group-hover:text-primary text-4xl`
- Text: `text-text-muted group-hover:text-text-secondary`

### Project Status Visual Encoding

| Status | Visual Treatment |
|--------|-----------------|
| `draft` | No badge, muted thumbnail overlay |
| `generating` | Animated progress bar, subtle pulse on card |
| `ready` | `bg-success` badge "Ready", full-color thumbnail |

### Interaction Patterns

1. **Click to Open:** Single click opens project in Script Editor (default entry point)
2. **More Menu Actions:**
   - Open → Navigate to project
   - Duplicate → Creates copy with "(Copy)" suffix
   - Delete → Shows confirmation modal
3. **Search:** Filters as you type with debounce (200ms); highlights matching text
4. **Sort Options:** Recent (default), Alphabetical, Status, Progress %
5. **Empty Search:** "No projects match '{query}'" with "Clear search" button

### Card Hover States
- Background shifts to `surface-3`
- Border becomes visible `border-color`
- More menu (⋮) fades in
- Subtle scale: `scale-[1.02]` for tactile feel

### Confirmation Modal (Delete)
```
┌────────────────────────────────────────┐
│  Delete "Brand Intro"?                 │
│                                        │
│  This will permanently remove the      │
│  project and all generated assets.     │
│                                        │
│            [Cancel]  [Delete]          │
└────────────────────────────────────────┘
```
- Modal backdrop: `bg-surface-0/80 backdrop-blur-sm`
- Modal: `bg-surface-2 border-border-color rounded-xl p-6`
- Delete button: `bg-error hover:bg-error/80`

### Accessibility Considerations
- Cards are keyboard navigable with `tabindex="0"`
- Enter opens project, Space opens more menu
- More menu items navigable with arrow keys
- Search has `role="searchbox"` with live region announcing result count
- Delete confirmation focuses cancel button by default (safer)

### Responsive Behavior
| Viewport | Columns | Card Width |
|----------|---------|------------|
| ≥1280px | 4 | ~300px |
| 1024-1279px | 3 | ~320px |
| 768-1023px | 2 | ~340px |
| <768px | 1 | 100% |

### Loading & Empty States
- **Loading:** Skeleton cards (4-6) with pulsing placeholders
- **No projects:** Large illustration + "Create your first project" CTA
- **All filtered out:** "No projects match your search" with clear button

### Performance Considerations
- Thumbnail images lazy load with blur placeholder
- Virtualize grid if >50 projects
- Debounce search input (200ms)
- Sort is client-side for <100 projects, server-side beyond

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
