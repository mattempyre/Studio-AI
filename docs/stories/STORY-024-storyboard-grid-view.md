# STORY-024: Storyboard Grid View

**Epic:** Storyboard UI (EPIC-06)
**Priority:** Must Have
**Story Points:** 5
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 3

---

## User Story

As a **creator**
I want **a grid view of all scenes**
So that **I can see the visual overview of my entire video at once**

---

## Description

### Background
While the table view shows detailed information, the grid view provides a visual overview - like a traditional storyboard. Creators can quickly scan all visuals, identify problem areas, and understand the visual flow of their video.

### Scope
**In scope:**
- Toggle between table and grid views
- Grid shows: image thumbnail, narration excerpt, camera tag
- Cards grouped by section
- Click card to select scene
- Visual status indicators
- Responsive grid layout

**Out of scope:**
- Drag-and-drop reordering
- Card resize options
- Zoom/scale controls
- Print layout

### User Flow
1. User is in storyboard (table view)
2. User clicks grid icon to switch views
3. Grid displays visual cards for all scenes
4. Scenes grouped by section with headers
5. User can scroll through grid
6. User clicks card to select scene
7. User can toggle back to table view

---

## Acceptance Criteria

- [ ] View toggle button (table/grid icons) in storyboard header
- [ ] Grid displays all scenes as visual cards
- [ ] Card shows: image thumbnail (large), narration excerpt, camera movement icon
- [ ] Cards grouped by section with section title headers
- [ ] Click card to select (visual highlight)
- [ ] Selected card triggers inspector panel
- [ ] Responsive grid: 4 columns on desktop, 2-3 on tablet, 1-2 on mobile
- [ ] Status indicators on cards (generating spinner, complete check, error icon)
- [ ] Cards without images show placeholder
- [ ] Virtualized rendering for performance
- [ ] View preference persists in session

---

## Technical Notes

### Components
- **Toggle:** `src/components/Storyboard/ViewToggle.tsx`
- **Grid:** `src/components/Storyboard/StoryboardGrid.tsx`
- **Card:** `src/components/Storyboard/SceneCard.tsx`

### View Toggle

```tsx
// ViewToggle.tsx
type ViewMode = 'table' | 'grid';

function ViewToggle({ mode, onChange }: ToggleProps) {
  return (
    <div className="flex border rounded overflow-hidden">
      <button
        onClick={() => onChange('table')}
        className={`px-3 py-1 ${mode === 'table' ? 'bg-blue-500 text-white' : 'bg-white'}`}
      >
        <TableIcon className="w-4 h-4" />
      </button>
      <button
        onClick={() => onChange('grid')}
        className={`px-3 py-1 ${mode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white'}`}
      >
        <GridIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
```

### Storyboard Grid

```tsx
// StoryboardGrid.tsx
function StoryboardGrid({ scenes, sections, selectedId, onSelect }: GridProps) {
  // Group scenes by section
  const groupedScenes = useMemo(() => {
    const groups: Map<string, { section: Section; scenes: Scene[] }> = new Map();

    for (const scene of scenes) {
      if (!groups.has(scene.sectionId)) {
        const section = sections.find(s => s.id === scene.sectionId)!;
        groups.set(scene.sectionId, { section, scenes: [] });
      }
      groups.get(scene.sectionId)!.scenes.push(scene);
    }

    return Array.from(groups.values());
  }, [scenes, sections]);

  return (
    <div className="storyboard-grid p-4 overflow-auto">
      {groupedScenes.map(({ section, scenes }) => (
        <div key={section.id} className="mb-8">
          {/* Section Header */}
          <h3 className="text-lg font-semibold mb-4 pb-2 border-b">
            {section.title}
            <span className="text-sm font-normal text-gray-500 ml-2">
              {scenes.length} scenes
            </span>
          </h3>

          {/* Scene Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {scenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                isSelected={scene.id === selectedId}
                onSelect={() => onSelect(scene.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Scene Card

```tsx
// SceneCard.tsx
function SceneCard({ scene, isSelected, onSelect }: CardProps) {
  const status = getSceneStatus(scene);
  const movement = CAMERA_MOVEMENTS.find(m => m.id === scene.cameraMovement);

  return (
    <div
      onClick={onSelect}
      className={`scene-card rounded-lg overflow-hidden border-2 cursor-pointer transition-all
        ${isSelected ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200 hover:border-blue-300'}
      `}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-100">
        {scene.imageFile ? (
          <img
            src={scene.imageFile}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ImageIcon className="w-8 h-8" />
          </div>
        )}

        {/* Status overlay */}
        {status === 'generating' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Spinner className="w-6 h-6 text-white" />
          </div>
        )}

        {/* Camera movement badge */}
        {movement && movement.id !== 'static' && (
          <div className="absolute top-1 right-1 bg-black/60 text-white px-1.5 py-0.5 rounded text-xs">
            {movement.icon}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute bottom-1 left-1">
          <StatusDot status={status} />
        </div>

        {/* Scene number */}
        <div className="absolute top-1 left-1 bg-black/60 text-white px-1.5 py-0.5 rounded text-xs">
          #{scene.globalIndex + 1}
        </div>
      </div>

      {/* Narration excerpt */}
      <div className="p-2">
        <p className="text-xs text-gray-600 line-clamp-2">
          {scene.text}
        </p>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors = {
    pending: 'bg-gray-400',
    generating: 'bg-blue-500',
    partial: 'bg-yellow-500',
    complete: 'bg-green-500',
    failed: 'bg-red-500',
  };

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />
  );
}
```

### Storyboard Page with View Toggle

```tsx
// Storyboard.tsx
function Storyboard({ projectId }: StoryboardProps) {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading } = useStoryboard(projectId);

  if (isLoading) return <LoadingState />;
  if (!data) return <ErrorState />;

  return (
    <div className="storyboard h-full flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-4 border-b">
        <h1 className="text-xl font-bold">Storyboard</h1>
        <div className="flex items-center gap-4">
          <ViewToggle mode={viewMode} onChange={setViewMode} />
          <button className="btn-primary">Generate All</button>
        </div>
      </header>

      {/* Main content with inspector */}
      <div className="flex-1 flex overflow-hidden">
        {/* Scene list (table or grid) */}
        <div className="flex-1 overflow-auto">
          {viewMode === 'table' ? (
            <StoryboardTable
              scenes={data.scenes}
              sections={data.sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : (
            <StoryboardGrid
              scenes={data.scenes}
              sections={data.sections}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* Inspector panel */}
        {selectedId && (
          <SceneInspector
            sentence={data.scenes.find(s => s.id === selectedId)!}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
```

### Responsive Grid Classes

```css
/* Tailwind responsive grid */
.grid-cols-2     /* 2 columns - mobile */
.md:grid-cols-3  /* 3 columns - tablet */
.lg:grid-cols-4  /* 4 columns - laptop */
.xl:grid-cols-5  /* 5 columns - desktop */
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-023: Storyboard Table View (shared infrastructure)

**Blocked Stories:**
- None (parallel with table view)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Card rendering
  - [ ] Section grouping
  - [ ] View toggle state
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Responsive design tested on multiple screen sizes
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of grid interactions

---

## Story Points Breakdown

- **Grid layout:** 2 points
- **Scene cards:** 1.5 points
- **View toggle integration:** 1 point
- **Responsive design:** 0.5 points
- **Total:** 5 points

**Rationale:** Visual card component requires attention to detail. Responsive grid and section grouping add complexity.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
