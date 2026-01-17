# STORY-010: Script Editor Component

**Epic:** Script Management (EPIC-01)
**Priority:** Must Have
**Story Points:** 5
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator**
I want **to edit my script with section/sentence structure visible**
So that **I can refine the content before generating visuals**

---

## Description

### Background
After AI generates a script, creators need to review and refine it. The script editor displays the hierarchical structure (sections → sentences) and allows inline editing. Changes should mark affected sentences as "dirty" to trigger downstream regeneration.

### Scope
**In scope:**
- Script editor UI displaying sections and sentences
- Inline text editing for sentences
- Section title editing
- Add new sentences within sections
- Delete sentences
- Reorder sentences via drag-and-drop
- Auto-save changes to backend
- Dirty flag updates when text changes

**Out of scope:**
- Adding/removing sections (future enhancement)
- Merging/splitting sentences
- Rich text formatting (bold, italic, etc.)
- Version history/undo
- Collaborative editing

### User Flow
1. User navigates to project → Script Editor view
2. Sections displayed with collapsible headers
3. Sentences shown as editable text blocks
4. User clicks sentence to edit inline
5. User presses Enter or clicks away to save
6. Changed sentences marked as "dirty" (need regeneration)
7. User can drag sentences to reorder
8. User can delete sentences with confirmation
9. User can add new sentence after any existing sentence

---

## Acceptance Criteria

- [ ] Script editor component loads project with sections/sentences
- [ ] Each section has collapsible header showing title
- [ ] Section titles are editable inline (click to edit)
- [ ] Each sentence displays text in editable field
- [ ] Clicking sentence enters edit mode with focus
- [ ] Pressing Enter saves sentence and exits edit mode
- [ ] Pressing Escape cancels edit and reverts changes
- [ ] Changed sentences show "dirty" indicator (yellow dot)
- [ ] Dirty flags set: `isAudioDirty`, `isImageDirty`, `isVideoDirty`
- [ ] "Add sentence" button appears between sentences
- [ ] New sentences inserted at correct order position
- [ ] Delete button on each sentence with confirmation dialog
- [ ] Deleting reorders remaining sentences automatically
- [ ] Drag handle on each sentence for reordering
- [ ] Dropping sentence updates order for all affected sentences
- [ ] Auto-save with debounce (500ms after typing stops)
- [ ] Loading state while fetching project data
- [ ] Error state if save fails with retry option

---

## Technical Notes

### Components
- **Main:** `src/components/ScriptEditor/ScriptEditor.tsx`
- **Section:** `src/components/ScriptEditor/SectionBlock.tsx`
- **Sentence:** `src/components/ScriptEditor/SentenceRow.tsx`
- **Hook:** `src/hooks/useScriptEditor.ts`

### Component Structure

```tsx
// ScriptEditor.tsx
function ScriptEditor({ projectId }: { projectId: string }) {
  const { project, sections, updateSentence, addSentence, deleteSentence, reorderSentences } = useScriptEditor(projectId);

  if (!project) return <LoadingSpinner />;

  return (
    <div className="script-editor">
      <header>
        <h1>{project.name}</h1>
        <span className="duration">{calculateDuration(sections)} min</span>
      </header>

      {sections.map((section) => (
        <SectionBlock
          key={section.id}
          section={section}
          onUpdateSentence={updateSentence}
          onAddSentence={addSentence}
          onDeleteSentence={deleteSentence}
          onReorderSentences={reorderSentences}
        />
      ))}
    </div>
  );
}
```

### State Management Hook

```typescript
// useScriptEditor.ts
function useScriptEditor(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // Fetch project with sections/sentences
  useEffect(() => {
    fetchProject(projectId).then(data => {
      setProject(data);
      setSections(data.sections);
    });
  }, [projectId]);

  // Update sentence with debounced save
  const updateSentence = useMemo(() =>
    debounce(async (sentenceId: string, text: string) => {
      setSavingIds(prev => new Set(prev).add(sentenceId));

      await fetch(`/api/v1/sentences/${sentenceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          text,
          isAudioDirty: true,
          isImageDirty: true,
          isVideoDirty: true,
        }),
      });

      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(sentenceId);
        return next;
      });
    }, 500),
  []);

  return { project, sections, updateSentence, addSentence, deleteSentence, reorderSentences };
}
```

### Drag and Drop

Use `@dnd-kit/core` for drag-and-drop:

```tsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';

function SentenceRow({ sentence, onUpdate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sentence.id });

  return (
    <div ref={setNodeRef} style={{ transform, transition }} {...attributes}>
      <div className="drag-handle" {...listeners}>⋮⋮</div>
      <EditableText value={sentence.text} onSave={(text) => onUpdate(sentence.id, text)} />
      <button onClick={() => onDelete(sentence.id)}>Delete</button>
    </div>
  );
}
```

### API Calls

```typescript
// Update sentence
PUT /api/v1/sentences/:id
{
  "text": "Updated sentence text.",
  "isAudioDirty": true,
  "isImageDirty": true,
  "isVideoDirty": true
}

// Add sentence
POST /api/v1/sections/:sectionId/sentences
{
  "text": "New sentence text.",
  "afterSentenceId": "sent_xyz" // Insert position
}

// Delete sentence
DELETE /api/v1/sentences/:id

// Reorder sentences
PUT /api/v1/sections/:sectionId/reorder
{
  "sentenceIds": ["sent_1", "sent_3", "sent_2"]
}

// Update section title
PUT /api/v1/sections/:id
{
  "title": "Updated Section Title"
}
```

### Dirty State Visualization

```tsx
function SentenceRow({ sentence }) {
  const isDirty = sentence.isAudioDirty || sentence.isImageDirty || sentence.isVideoDirty;

  return (
    <div className={`sentence-row ${isDirty ? 'dirty' : ''}`}>
      {isDirty && <span className="dirty-indicator" title="Needs regeneration">●</span>}
      {/* ... */}
    </div>
  );
}
```

### Keyboard Shortcuts
- `Enter`: Save and move to next sentence
- `Escape`: Cancel edit
- `Tab`: Move to next sentence
- `Shift+Tab`: Move to previous sentence
- `Ctrl+S`: Force save all

### Security Considerations
- Sanitize text input before display (XSS prevention)
- Validate sentence order values on backend
- Prevent negative order values

---

## Dependencies

**Prerequisite Stories:**
- STORY-008: Project CRUD API (project data retrieval)
- STORY-009: AI Script Generation (creates initial script)

**Blocked Stories:**
- STORY-015: Voice Selection UI (displayed in script editor)
- STORY-016: Bulk Audio Generation (triggered from script editor)

**External Dependencies:**
- `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop
- Tailwind CSS for styling

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Sentence text editing
  - [ ] Dirty flag updates
  - [ ] Add sentence positioning
  - [ ] Delete sentence reordering
  - [ ] Drag and drop reordering
- [ ] Integration tests passing
  - [ ] Full edit flow with API
  - [ ] Optimistic updates
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Component usage examples
  - [ ] Keyboard shortcuts documented
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of all interactions

---

## Story Points Breakdown

- **Basic editing & display:** 2 points
- **Drag and drop reordering:** 1.5 points
- **Add/delete sentences:** 1 point
- **Auto-save & dirty flags:** 0.5 points
- **Total:** 5 points

**Rationale:** Interactive UI component with multiple features. Drag-and-drop adds complexity. State management for optimistic updates requires careful implementation.

---

## Additional Notes

The script editor is a critical UX component. Consider:
- Word count per sentence
- Duration estimate per sentence
- Undo/redo stack
- Keyboard-only navigation for accessibility
- Mobile-friendly editing mode

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
