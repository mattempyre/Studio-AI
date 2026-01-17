# STORY-023: Storyboard Table View

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
I want **a table view of all scenes**
So that **I can see the linear flow of my video and manage scenes efficiently**

---

## Description

### Background
The storyboard is where creators visualize their entire video. The table view provides a spreadsheet-like interface showing all scenes in order with key information at a glance. This is essential for navigating large projects and understanding the overall structure.

### Scope
**In scope:**
- Storyboard page with table layout
- Columns: #, Thumbnail, Narration, Section, Status
- Click row to select scene
- Section grouping headers
- Scroll navigation for long scripts
- Virtualized list for performance

**Out of scope:**
- Drag-and-drop reordering (in table view)
- Inline editing
- Multi-select
- Column customization

### User Flow
1. User navigates to Storyboard view
2. Table displays all scenes in order
3. Scenes grouped by section with headers
4. User can scroll through entire video
5. User clicks row to select scene
6. Selected scene opens in inspector panel
7. User can see generation status at a glance

---

## Acceptance Criteria

- [ ] Storyboard page accessible from main navigation
- [ ] Table displays all sentences from project
- [ ] Columns: Scene # | Thumbnail | Narration | Section | Status
- [ ] Thumbnail shows generated image or placeholder
- [ ] Narration shows sentence text (truncated if long)
- [ ] Section shows section title
- [ ] Status shows: Pending, Generating, Complete, Failed
- [ ] Section headers group sentences by section
- [ ] Click row to select (highlight row)
- [ ] Selected scene triggers inspector panel
- [ ] Virtualized rendering for 500+ rows
- [ ] Sticky header row during scroll
- [ ] Loading state while fetching data
- [ ] Empty state for no scenes

---

## Technical Notes

### Components
- **Page:** `src/components/Storyboard/Storyboard.tsx`
- **Table:** `src/components/Storyboard/StoryboardTable.tsx`
- **Row:** `src/components/Storyboard/SceneRow.tsx`
- **Header:** `src/components/Storyboard/SectionHeader.tsx`

### Data Fetching

```typescript
// useStoryboard.ts
function useStoryboard(projectId: string) {
  const [data, setData] = useState<StoryboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}`)
      .then(res => res.json())
      .then(project => {
        // Flatten sections/sentences for table
        const scenes = project.sections.flatMap((section, sIdx) =>
          section.sentences.map((sentence, sentIdx) => ({
            ...sentence,
            sectionTitle: section.title,
            sectionId: section.id,
            globalIndex: calculateGlobalIndex(project.sections, sIdx, sentIdx),
          }))
        );
        setData({ project, sections: project.sections, scenes });
        setIsLoading(false);
      });
  }, [projectId]);

  return { data, isLoading };
}
```

### Virtualized Table

Use `react-virtual` for efficient rendering:

```tsx
// StoryboardTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function StoryboardTable({ scenes, sections, selectedId, onSelect }: TableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Build rows with section headers
  const rows = useMemo(() => {
    const result: Array<{ type: 'header'; section: Section } | { type: 'scene'; scene: Scene }> = [];

    let currentSectionId = '';
    for (const scene of scenes) {
      if (scene.sectionId !== currentSectionId) {
        const section = sections.find(s => s.id === scene.sectionId);
        if (section) {
          result.push({ type: 'header', section });
        }
        currentSectionId = scene.sectionId;
      }
      result.push({ type: 'scene', scene });
    }

    return result;
  }, [scenes, sections]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'header' ? 48 : 72,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      {/* Sticky header */}
      <div className="sticky top-0 bg-white border-b z-10 flex">
        <div className="w-12 px-2 py-3 font-semibold">#</div>
        <div className="w-24 px-2 py-3 font-semibold">Thumb</div>
        <div className="flex-1 px-2 py-3 font-semibold">Narration</div>
        <div className="w-32 px-2 py-3 font-semibold">Section</div>
        <div className="w-24 px-2 py-3 font-semibold">Status</div>
      </div>

      {/* Virtual rows */}
      <div
        style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];

          if (row.type === 'header') {
            return (
              <SectionHeader
                key={`header-${row.section.id}`}
                section={row.section}
                style={{
                  position: 'absolute',
                  top: virtualRow.start,
                  height: virtualRow.size,
                }}
              />
            );
          }

          return (
            <SceneRow
              key={row.scene.id}
              scene={row.scene}
              isSelected={row.scene.id === selectedId}
              onSelect={() => onSelect(row.scene.id)}
              style={{
                position: 'absolute',
                top: virtualRow.start,
                height: virtualRow.size,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
```

### Scene Row

```tsx
// SceneRow.tsx
function SceneRow({ scene, isSelected, onSelect, style }: RowProps) {
  return (
    <div
      onClick={onSelect}
      style={style}
      className={`flex items-center border-b cursor-pointer hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50 border-blue-200' : ''
      }`}
    >
      {/* Scene number */}
      <div className="w-12 px-2 text-sm text-gray-500">
        {scene.globalIndex + 1}
      </div>

      {/* Thumbnail */}
      <div className="w-24 px-2">
        <img
          src={scene.imageFile || '/placeholder-scene.png'}
          alt=""
          className="w-16 h-9 object-cover rounded"
        />
      </div>

      {/* Narration */}
      <div className="flex-1 px-2">
        <p className="text-sm line-clamp-2">{scene.text}</p>
      </div>

      {/* Section */}
      <div className="w-32 px-2">
        <span className="text-xs text-gray-500">{scene.sectionTitle}</span>
      </div>

      {/* Status */}
      <div className="w-24 px-2">
        <StatusBadge status={getSceneStatus(scene)} />
      </div>
    </div>
  );
}

function getSceneStatus(scene: Scene): string {
  if (scene.status === 'generating') return 'generating';
  if (scene.status === 'failed') return 'failed';
  if (scene.audioFile && scene.imageFile && scene.videoFile) return 'complete';
  if (scene.audioFile || scene.imageFile) return 'partial';
  return 'pending';
}
```

### Status Badge

```tsx
// StatusBadge.tsx
const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-600',
  generating: 'bg-blue-100 text-blue-600',
  partial: 'bg-yellow-100 text-yellow-600',
  complete: 'bg-green-100 text-green-600',
  failed: 'bg-red-100 text-red-600',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}
```

### Section Header

```tsx
// SectionHeader.tsx
function SectionHeader({ section, style }: HeaderProps) {
  return (
    <div
      style={style}
      className="flex items-center bg-gray-100 border-b px-4 font-semibold text-sm"
    >
      <span className="flex-1">{section.title}</span>
      <span className="text-gray-500 text-xs">
        {section.sentences?.length || 0} scenes
      </span>
    </div>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-010: Script Editor Component (sentences exist)
- STORY-018: Image Generation Job (thumbnails)

**Blocked Stories:**
- STORY-024: Storyboard Grid View (alternative view)
- STORY-025: Scene Inspector Panel (detail view)
- STORY-026: Section Navigation Sidebar

**External Dependencies:**
- `@tanstack/react-virtual` for virtualization

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Row rendering
  - [ ] Section grouping
  - [ ] Status calculation
- [ ] Integration tests passing
  - [ ] Data loading
  - [ ] Selection state
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Performance tested with 500+ scenes
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with various project sizes

---

## Story Points Breakdown

- **Table structure & virtualization:** 2 points
- **Row components:** 1.5 points
- **Section grouping:** 1 point
- **Status logic:** 0.5 points
- **Total:** 5 points

**Rationale:** Virtualized table with section grouping requires careful implementation. Performance is critical for long videos.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
