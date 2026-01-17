# STORY-037: Global Project Dropdown in Sidebar

**Epic:** Polish & Usability (EPIC-09)
**Priority:** Should Have
**Story Points:** 5
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **a project dropdown always visible in the sidebar**
So that **I can quickly switch between projects from any page without losing context**

---

## Description

### Background

Currently, the project selector only appears in the top header bar when users are on project-specific pages (Script & Audio, Storyboard, Video Editor). This creates several UX issues:

1. **Inconsistent visibility** - Project context disappears when on Dashboard or Characters pages
2. **Breaks industry patterns** - Tools like Figma, Notion, Slack, and Linear place workspace/project switchers at the top of the sidebar
3. **Cognitive disconnect** - Users must look in different places (header vs. sidebar) to understand their navigation context
4. **No clear scope boundary** - Global navigation (Dashboard, Characters) and project-specific navigation (Script, Storyboard, Video) are not visually separated

Moving the project dropdown to the sidebar, positioned between global and project-specific navigation, follows established UX patterns and provides consistent project context throughout the application.

### Scope

**In scope:**
- Move project dropdown from header to sidebar
- Position between global nav (Dashboard, Characters) and project nav (Script, Storyboard, Video)
- Show project selector on ALL pages (not just project pages)
- Inline project rename on hover
- "Create New Project" option in dropdown
- Visual separation of global vs. project navigation
- Disabled state for project nav when no project selected
- Responsive behavior for collapsed sidebar

**Out of scope:**
- Project search in dropdown (consider for >10 projects later)
- Project thumbnails in dropdown
- Recent projects section
- Keyboard navigation for dropdown (future accessibility enhancement)
- Drag-and-drop project reordering

### User Flow

**Flow 1: Switch Projects from Dashboard**
1. User is on Dashboard page
2. User sees project dropdown in sidebar with current selection or "Select a project..."
3. User clicks dropdown
4. User selects a different project
5. System navigates to that project's Script & Audio page
6. Project-specific nav items become enabled

**Flow 2: Switch Projects from Project Page**
1. User is on Script & Audio page for "Project A"
2. User clicks project dropdown in sidebar
3. User selects "Project B"
4. System navigates to "Project B" Script & Audio page
5. User continues working on new project

**Flow 3: Create Project from Dropdown**
1. User clicks project dropdown
2. User clicks "+ Create New Project" at bottom of dropdown
3. System creates new "Untitled Project"
4. System navigates to new project's Script & Audio page
5. Dropdown shows new project as selected

**Flow 4: Rename Project Inline**
1. User hovers over project dropdown
2. Edit (pencil) icon appears
3. User clicks edit icon
4. Dropdown text becomes editable input
5. User types new name
6. User presses Enter or clicks away
7. Project name is saved

---

## Acceptance Criteria

### Core Functionality
- [ ] Project dropdown appears in sidebar between Dashboard/Characters and Script/Storyboard/Video nav items
- [ ] Project dropdown is visible on ALL pages (Dashboard, Characters, Script, Storyboard, Video)
- [ ] Dropdown shows currently selected project name (truncated if >20 chars with ellipsis)
- [ ] Dropdown shows "Select a project..." when no project is selected
- [ ] Clicking dropdown opens list of all projects sorted by `updatedAt` descending
- [ ] Selecting a project navigates to `/project/{id}/script`
- [ ] "+ Create New Project" option appears at bottom of dropdown list
- [ ] Clicking "+ Create New Project" creates project and navigates to script page

### Visual Design
- [ ] Clear visual separator (border or spacing) between global nav and project selector
- [ ] Clear visual separator between project selector and project-specific nav
- [ ] "PROJECT" label appears above dropdown (uppercase, small text, muted color)
- [ ] Chevron-down icon indicates dropdown can be expanded
- [ ] Currently selected project in dropdown list has checkmark indicator
- [ ] Project-specific nav items (Script, Storyboard, Video) are visually dimmed when no project selected
- [ ] Dimmed nav items show tooltip "Select a project first" on hover

### Inline Rename
- [ ] Edit (pencil) icon appears on hover next to project name
- [ ] Clicking edit icon converts dropdown display to text input
- [ ] Input is pre-filled with current project name and auto-focused
- [ ] Pressing Enter saves the new name
- [ ] Pressing Escape cancels editing and reverts to original name
- [ ] Clicking outside the input saves the new name
- [ ] Empty name is not allowed (reverts to original)

### Responsive Behavior
- [ ] On collapsed sidebar (mobile/small screens), project dropdown shows as icon only
- [ ] Collapsed state shows folder icon with indicator dot if project is selected
- [ ] Tapping collapsed dropdown opens full project list

### State Management
- [ ] Selected project persists across page navigations
- [ ] Selected project persists on browser refresh (via URL)
- [ ] Changing project clears any unsaved state warning (if applicable)

---

## Technical Notes

### Components to Modify

**Primary:**
- `components/Layout.tsx` - Main layout component containing sidebar

**New Components:**
- `components/Sidebar/ProjectDropdown.tsx` - New project dropdown component

### Current Implementation (to be removed from header)

Lines 264-317 in [Layout.tsx](../../components/Layout.tsx) contain the current header-based project dropdown:
```tsx
{isInCreationFlow ? (
    /* Project Context & Rename */
    <div className="hidden md:flex flex-col justify-center border-l border-white/10 pl-6 h-8">
        <label className="text-[9px] text-text-muted font-bold uppercase tracking-wider leading-none mb-1">Active Project</label>
        <div className="flex items-center gap-2 group/edit">
            {/* ... dropdown select ... */}
        </div>
    </div>
) : (
    /* Dashboard Search */
    ...
)}
```

This should be moved to the sidebar.

### Proposed Sidebar Structure

```tsx
// Inside Layout.tsx sidebar <nav>
<nav className="flex flex-col gap-2 flex-grow">
  {/* Global Navigation */}
  <Link to="/" ...>Dashboard</Link>
  <Link to="/characters" ...>Characters</Link>

  {/* Project Scope Separator */}
  <div className="my-4 pt-4 border-t border-white/10">
    <label className="text-[9px] text-text-muted font-bold uppercase tracking-wider px-4 mb-2 block">
      Project
    </label>
    <ProjectDropdown
      projects={projects}
      activeProjectId={activeProjectId}
      onSelectProject={handleSelectProject}
      onCreateProject={onCreateProject}
      onUpdateProject={onUpdateProject}
    />
  </div>

  {/* Project-Specific Navigation */}
  {[
    { id: 'script', icon: Icons.Type, label: 'Script & Audio', path: 'script' },
    { id: 'storyboard', icon: Icons.Grid, label: 'Storyboard', path: 'storyboard' },
    { id: 'video', icon: Icons.Film, label: 'Video Editor', path: 'video' },
  ].map((item) => {
    const canNavigate = !!activeProjectId;
    // ... render nav items with disabled state when !canNavigate
  })}
</nav>
```

### ProjectDropdown Component

```tsx
// components/Sidebar/ProjectDropdown.tsx
interface ProjectDropdownProps {
  projects: LayoutProject[];
  activeProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  onCreateProject: () => Promise<string>;
  onUpdateProject: (id: string, updates: { name: string }) => void;
}

const ProjectDropdown: React.FC<ProjectDropdownProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (isEditing) saveEdit();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing]);

  // ... render dropdown
};
```

### Props Flow

```
App.tsx
  └── Layout (projects, activeProjectId, onSelectProject, onCreateProject, onUpdateProject)
        └── ProjectDropdown (same props)
```

The existing `Layout.tsx` already receives these props, so no changes needed to the data flow.

### CSS Classes (Tailwind)

```css
/* Dropdown trigger */
.project-dropdown-trigger {
  @apply flex items-center justify-between w-full px-4 py-2 mx-2
         bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer
         transition-all text-sm text-white;
}

/* Dropdown menu */
.project-dropdown-menu {
  @apply absolute left-2 right-2 mt-1 bg-background-dark border
         border-white/10 rounded-lg shadow-lg z-50 max-h-64
         overflow-y-auto;
}

/* Menu item */
.project-dropdown-item {
  @apply flex items-center gap-2 px-4 py-2 text-sm text-white/80
         hover:bg-white/5 cursor-pointer transition-colors;
}

/* Create new option */
.project-dropdown-create {
  @apply flex items-center gap-2 px-4 py-2 text-sm text-primary
         font-bold border-t border-white/10 hover:bg-primary/10
         cursor-pointer transition-colors;
}
```

### Accessibility

```tsx
// Dropdown trigger
<button
  aria-label="Select active project"
  aria-haspopup="listbox"
  aria-expanded={isOpen}
  aria-controls="project-dropdown-menu"
  onClick={() => setIsOpen(!isOpen)}
>
  {/* ... */}
</button>

// Dropdown menu
<ul
  id="project-dropdown-menu"
  role="listbox"
  aria-label="Available projects"
>
  {projects.map(project => (
    <li
      role="option"
      aria-selected={project.id === activeProjectId}
      onClick={() => handleSelect(project.id)}
    >
      {/* ... */}
    </li>
  ))}
</ul>

// Edit input
<input
  aria-label="Project name"
  value={editName}
  onChange={(e) => setEditName(e.target.value)}
  onKeyDown={handleKeyDown}
/>
```

### Edge Cases

1. **Very long project name** - Truncate with ellipsis at 20 chars, full name in tooltip
2. **Many projects (>10)** - Scrollable dropdown with max-height
3. **No projects exist** - Show "Create your first project" prompt
4. **Project deleted while viewing** - Redirect to dashboard
5. **Concurrent edits** - Last write wins (simple approach for MVP)

---

## Dependencies

**Prerequisite Stories:**
- STORY-008: Project CRUD API (provides project data and update endpoint) ✓ Completed

**Blocked Stories:**
- None (this is a UI enhancement)

**Related Stories:**
- STORY-036: Project Dashboard (shows project list, similar data)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] ProjectDropdown renders with projects
  - [ ] ProjectDropdown shows "Select a project..." when none selected
  - [ ] Clicking project navigates correctly
  - [ ] Create new project option works
  - [ ] Inline rename saves correctly
  - [ ] Escape key cancels edit
- [ ] Integration tests passing
  - [ ] End-to-end project switching flow
  - [ ] Dropdown state persists across pages
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Responsive design tested (desktop, tablet, mobile)
- [ ] Acceptance criteria validated (all checked)
- [ ] Manual testing completed
  - [ ] Test on Dashboard page
  - [ ] Test on Characters page
  - [ ] Test on Script page
  - [ ] Test project switching
  - [ ] Test project creation from dropdown
  - [ ] Test inline rename
- [ ] Merged to main branch

---

## Story Points Breakdown

- **ProjectDropdown component:** 2 points
- **Layout.tsx refactoring:** 1.5 points
- **Inline rename functionality:** 1 point
- **Styling and responsive:** 0.5 points
- **Total:** 5 points

**Rationale:** Moderate complexity due to extracting existing functionality into a new component, adding inline edit capability, and ensuring consistent behavior across all pages. The core dropdown logic already exists in the header, so this is primarily a refactoring and enhancement task.

---

## Wireframes

### Desktop (Expanded Sidebar)

```
┌─────────────────────────────┐
│ [🎬] Studio AI              │
│      CREATOR PRO            │
├─────────────────────────────┤
│ 📊 Dashboard                │
│ 👤 Characters               │
├─────────────────────────────┤
│                             │
│ PROJECT                     │
│ ┌─────────────────────────┐ │
│ │ My Coffee Documentary ▼ │ │
│ │                    [✏️] │ │
│ └─────────────────────────┘ │
│                             │
│ 📝 Script & Audio  ●        │
│ 🖼️ Storyboard               │
│ 🎥 Video Editor             │
├─────────────────────────────┤
│ Credits [████░░] 120m       │
│ 🚪 Sign Out                 │
└─────────────────────────────┘
```

### Dropdown Open

```
│ PROJECT                     │
│ ┌─────────────────────────┐ │
│ │ My Coffee Documentary ▲ │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ✓ My Coffee Doc...      │ │
│ │   History of Rome       │ │
│ │   Product Launch        │ │
│ │   Tutorial Series       │ │
│ ├─────────────────────────┤ │
│ │ + Create New Project    │ │
│ └─────────────────────────┘ │
```

### No Project Selected

```
│ PROJECT                     │
│ ┌─────────────────────────┐ │
│ │ Select a project...   ▼ │ │
│ └─────────────────────────┘ │
│                             │
│ 📝 Script & Audio     (dim) │
│ 🖼️ Storyboard         (dim) │
│ 🎥 Video Editor       (dim) │
```

---

## Additional Notes

### Future Enhancements

1. **Project Search** - Add search input in dropdown when user has >10 projects
2. **Keyboard Navigation** - Arrow keys to navigate, Enter to select, Escape to close
3. **Project Thumbnails** - Show first generated image as thumbnail in dropdown
4. **Project Favorites** - Pin frequently used projects to top
5. **Recent Projects Section** - Show last 3 accessed projects at top

### Design System Alignment

This component should follow the existing design patterns in the codebase:
- Colors: Use `bg-white/5`, `text-text-muted`, `text-primary` for consistency
- Transitions: Use `transition-all` with `duration-300`
- Border radius: Use `rounded-lg` or `rounded-xl`
- Icons: Use existing Icons from `components/Icons.tsx`

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master (Claude)

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
