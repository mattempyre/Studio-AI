# STORY-036: Project Dashboard

**Epic:** Polish & Usability (EPIC-09)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **a dashboard showing all my projects**
So that **I can manage and access my video projects easily**

---

## Description

### Background
Creators will work on multiple video projects over time. The project dashboard serves as the home page, showing all projects with their status, allowing creation of new projects, and providing quick access to recent work. This is the entry point to the application.

### Scope
**In scope:**
- Project list/grid view
- Project cards with thumbnails and status
- Create new project button
- Search/filter projects
- Sort by date, name, status
- Delete project (with confirmation)
- Duplicate project option
- Quick access to recent projects

**Out of scope:**
- Project folders/organization
- Project sharing/collaboration
- Project templates
- Bulk operations
- Project archiving

### User Flow
1. User opens application
2. Dashboard shows all projects
3. User can search or filter by status
4. User clicks project to open it
5. User can create new project
6. User can delete unwanted projects
7. User can duplicate a project as starting point

---

## Acceptance Criteria

- [ ] Dashboard is the landing page after login
- [ ] Projects displayed in card grid layout
- [ ] Each card shows: thumbnail, name, status, last modified
- [ ] "New Project" button prominently displayed
- [ ] Search bar filters projects by name
- [ ] Sort options: newest, oldest, alphabetical
- [ ] Click card opens project
- [ ] Delete button with confirmation dialog
- [ ] Duplicate creates copy with "(Copy)" suffix
- [ ] Empty state for no projects
- [ ] Loading skeleton during fetch
- [ ] Responsive layout for different screen sizes

---

## Technical Notes

### Components
- **Page:** `src/pages/Dashboard.tsx`
- **Card:** `src/components/Dashboard/ProjectCard.tsx`
- **Grid:** `src/components/Dashboard/ProjectGrid.tsx`
- **Dialog:** `src/components/Dashboard/NewProjectDialog.tsx`
- **Hook:** `src/hooks/useProjects.ts`

### Dashboard Page

```tsx
// Dashboard.tsx
function Dashboard() {
  const { projects, isLoading, createProject, deleteProject, duplicateProject } = useProjects();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [showNewDialog, setShowNewDialog] = useState(false);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.topic?.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [projects, search, sortBy]);

  return (
    <div className="dashboard min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Projects</h1>
          <button
            onClick={() => setShowNewDialog(true)}
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="w-5 h-5" />
            New Project
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Alphabetical</option>
          </select>

          {/* Stats */}
          <span className="text-sm text-gray-500">
            {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <main className="px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <ProjectGridSkeleton />
          ) : filteredProjects.length === 0 ? (
            <EmptyState
              hasSearch={!!search}
              onCreateNew={() => setShowNewDialog(true)}
            />
          ) : (
            <ProjectGrid
              projects={filteredProjects}
              onDelete={deleteProject}
              onDuplicate={duplicateProject}
            />
          )}
        </div>
      </main>

      {/* New Project Dialog */}
      {showNewDialog && (
        <NewProjectDialog
          onClose={() => setShowNewDialog(false)}
          onCreate={createProject}
        />
      )}
    </div>
  );
}
```

### Project Card Component

```tsx
// ProjectCard.tsx
interface ProjectCardProps {
  project: Project;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function ProjectCard({ project, onDelete, onDuplicate }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();

  // Calculate completion status
  const status = useMemo(() => {
    const { sections } = project;
    if (!sections || sections.length === 0) return 'draft';

    const sentences = sections.flatMap(s => s.sentences || []);
    if (sentences.length === 0) return 'draft';

    const allComplete = sentences.every(s =>
      s.audioFile && s.imageFile && s.videoFile &&
      !s.isAudioDirty && !s.isImageDirty && !s.isVideoDirty
    );

    if (allComplete) return 'complete';
    return 'in_progress';
  }, [project]);

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    complete: 'bg-green-100 text-green-700',
  };

  const statusLabels = {
    draft: 'Draft',
    in_progress: 'In Progress',
    complete: 'Complete',
  };

  return (
    <div className="project-card bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div
        className="aspect-video bg-gray-200 rounded-t-lg overflow-hidden cursor-pointer"
        onClick={() => navigate(`/project/${project.id}`)}
      >
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <VideoIcon className="w-12 h-12" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold truncate cursor-pointer hover:text-blue-600"
              onClick={() => navigate(`/project/${project.id}`)}
            >
              {project.name}
            </h3>
            {project.topic && (
              <p className="text-sm text-gray-500 truncate">{project.topic}</p>
            )}
          </div>

          {/* Menu button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <DotsVerticalIcon className="w-5 h-5 text-gray-400" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white border rounded-lg shadow-lg z-10">
                <button
                  onClick={() => { onDuplicate(project.id); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  Duplicate
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <span className={`text-xs px-2 py-1 rounded ${statusColors[status]}`}>
            {statusLabels[status]}
          </span>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(project.updatedAt)}
          </span>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete Project?"
          message={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
          confirmText="Delete"
          confirmVariant="danger"
          onConfirm={() => { onDelete(project.id); setShowDeleteConfirm(false); }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
```

### Projects Hook

```typescript
// useProjects.ts
interface UseProjectsReturn {
  projects: Project[];
  isLoading: boolean;
  error: Error | null;
  createProject: (data: CreateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<Project>;
  refetch: () => void;
}

function useProjects(): UseProjectsReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/v1/projects');
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const createProject = async (input: CreateProjectInput): Promise<Project> => {
    const response = await fetch('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const newProject = await response.json();
    setProjects(prev => [newProject, ...prev]);
    return newProject;
  };

  const deleteProject = async (id: string): Promise<void> => {
    await fetch(`/api/v1/projects/${id}`, { method: 'DELETE' });
    setProjects(prev => prev.filter(p => p.id !== id));
    toast.success('Project deleted');
  };

  const duplicateProject = async (id: string): Promise<Project> => {
    const response = await fetch(`/api/v1/projects/${id}/duplicate`, {
      method: 'POST',
    });

    const duplicated = await response.json();
    setProjects(prev => [duplicated, ...prev]);
    toast.success('Project duplicated');
    return duplicated;
  };

  return {
    projects,
    isLoading,
    error,
    createProject,
    deleteProject,
    duplicateProject,
    refetch: fetchProjects,
  };
}
```

### New Project Dialog

```tsx
// NewProjectDialog.tsx
interface NewProjectDialogProps {
  onClose: () => void;
  onCreate: (data: CreateProjectInput) => Promise<Project>;
}

function NewProjectDialog({ onClose, onCreate }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsCreating(true);
    try {
      const project = await onCreate({
        name: name.trim(),
        topic: topic.trim() || undefined,
      });
      onClose();
      navigate(`/project/${project.id}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold mb-4">Create New Project</h2>

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Video"
              className="w-full px-3 py-2 border rounded-lg"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Topic (optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What's this video about?"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Empty State

```tsx
// EmptyState.tsx
function EmptyState({ hasSearch, onCreateNew }: { hasSearch: boolean; onCreateNew: () => void }) {
  if (hasSearch) {
    return (
      <div className="text-center py-12">
        <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-700">No projects found</h3>
        <p className="text-gray-500 mt-1">Try a different search term</p>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <VideoIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-700">No projects yet</h3>
      <p className="text-gray-500 mt-1">Create your first AI-generated video</p>
      <button
        onClick={onCreateNew}
        className="mt-4 btn-primary"
      >
        Create Project
      </button>
    </div>
  );
}
```

### Backend: Duplicate Endpoint

```typescript
// POST /api/v1/projects/:id/duplicate
router.post('/:id/duplicate', async (req, res) => {
  const { id } = req.params;

  const original = await getProjectWithAllData(id);
  if (!original) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Create duplicate with new IDs
  const duplicatedProject = await db.transaction(async (tx) => {
    // Create new project
    const newProject = await tx.insert(projects).values({
      id: generateId('proj'),
      name: `${original.name} (Copy)`,
      topic: original.topic,
      visualStyle: original.visualStyle,
      voiceId: original.voiceId,
      targetDuration: original.targetDuration,
    }).returning().get();

    // Duplicate sections
    for (const section of original.sections) {
      const newSection = await tx.insert(sections).values({
        id: generateId('sec'),
        projectId: newProject.id,
        title: section.title,
        order: section.order,
      }).returning().get();

      // Duplicate sentences (without generated assets)
      for (const sentence of section.sentences) {
        await tx.insert(sentences).values({
          id: generateId('sent'),
          sectionId: newSection.id,
          order: sentence.order,
          text: sentence.text,
          imagePrompt: sentence.imagePrompt,
          videoPrompt: sentence.videoPrompt,
          cameraMovement: sentence.cameraMovement,
          motionStrength: sentence.motionStrength,
          // Note: audioFile, imageFile, videoFile are NOT copied
          // User will need to regenerate assets
        });
      }
    }

    // Duplicate cast assignments
    for (const cast of original.cast || []) {
      await tx.insert(projectCast).values({
        projectId: newProject.id,
        characterId: cast.characterId,
      });
    }

    return newProject;
  });

  res.status(201).json(duplicatedProject);
});
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-008: Project CRUD API (backend endpoints)

**Blocked Stories:**
- None (this is the entry point to the application)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Project filtering
  - [ ] Sort logic
  - [ ] Create/delete/duplicate
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Responsive design tested
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of all CRUD operations

---

## Story Points Breakdown

- **Dashboard page layout:** 1 point
- **Project card component:** 0.5 points
- **Search/filter/sort:** 0.5 points
- **CRUD operations (create/delete/duplicate):** 1 point
- **Total:** 3 points

**Rationale:** Standard dashboard with CRUD operations. Project duplication adds slight complexity for deep copying.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
