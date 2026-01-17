# STORY-013: Project Cast Management

**Epic:** Character System (EPIC-02)
**Priority:** Must Have
**Story Points:** 2
**Status:** Ready for Development
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator**
I want **to add characters to my project cast**
So that **they are included in generated visuals consistently**

---

## Description

### Background
Projects need a "cast" of characters that appear in the video. When generating images, character descriptions and reference images from the cast are injected into prompts to maintain visual consistency. The cast is a subset of the character library specific to each project.

### Scope
**In scope:**
- Add character from library to project cast
- Remove character from project cast
- Display cast in project settings panel
- Pass cast to image generation prompts

**Out of scope:**
- Character roles (narrator, protagonist, etc.)
- Per-scene character assignment
- Character appearance scheduling

### User Flow
1. User opens project settings or cast panel
2. User sees current cast members (empty if new project)
3. User clicks "Add Character"
4. Character picker shows library characters not in cast
5. User selects character(s) to add
6. Characters added to project cast
7. User can click "×" on character to remove from cast
8. When images generate, cast characters are included in prompts

---

## Acceptance Criteria

- [ ] `POST /api/v1/projects/:id/cast` adds character to project
- [ ] Request body: `{ "characterId": "char_xyz" }`
- [ ] Returns 400 if character already in cast
- [ ] Returns 404 if character or project doesn't exist
- [ ] `DELETE /api/v1/projects/:id/cast/:characterId` removes from cast
- [ ] `GET /api/v1/projects/:id` includes cast array with character details
- [ ] Cast displayed in project settings panel
- [ ] "Add Character" button opens character picker modal
- [ ] Picker shows only characters NOT already in cast
- [ ] Picker allows selecting multiple characters at once
- [ ] Cast members show thumbnail, name, remove button
- [ ] Removing from cast shows confirmation (simple yes/no)
- [ ] Empty cast shows "No characters in cast" message
- [ ] Cast data passed to image generation context

---

## Technical Notes

### Components
- **API:** `src/backend/api/projects.ts` (add cast endpoints)
- **UI:** `src/components/ProjectSettings/CastPanel.tsx`
- **Picker:** `src/components/ProjectSettings/CharacterPicker.tsx`

### API Specifications

#### Add to Cast
```
POST /api/v1/projects/:projectId/cast
Content-Type: application/json

Request:
{
  "characterId": "char_abc123"
}

Response (201):
{
  "message": "Character added to cast",
  "cast": [
    {
      "id": "char_abc123",
      "name": "Dr. Sarah Chen",
      "description": "...",
      "referenceImages": [...]
    }
  ]
}

Errors:
- 400: Character already in cast
- 404: Character or project not found
```

#### Add Multiple to Cast
```
POST /api/v1/projects/:projectId/cast/batch
Content-Type: application/json

Request:
{
  "characterIds": ["char_abc123", "char_def456"]
}

Response (201):
{
  "message": "2 characters added to cast",
  "added": ["char_abc123", "char_def456"],
  "skipped": []  // Already in cast
}
```

#### Remove from Cast
```
DELETE /api/v1/projects/:projectId/cast/:characterId

Response (204): No content
```

#### Get Project (includes cast)
```
GET /api/v1/projects/:id

Response (200):
{
  "id": "proj_xyz",
  "name": "My Video",
  ...
  "cast": [
    {
      "id": "char_abc123",
      "name": "Dr. Sarah Chen",
      "description": "A distinguished scientist...",
      "referenceImages": ["/api/v1/characters/char_abc123/images/0"]
    }
  ]
}
```

### Database Operations

```typescript
// Add to cast
await db.insert(projectCast).values({
  projectId,
  characterId,
});

// Remove from cast
await db.delete(projectCast).where(
  and(
    eq(projectCast.projectId, projectId),
    eq(projectCast.characterId, characterId)
  )
);

// Get project with cast
const project = await db.query.projects.findFirst({
  where: eq(projects.id, projectId),
  with: {
    cast: {
      with: {
        character: true,  // Join to get character details
      },
    },
    sections: {
      with: {
        sentences: true,
      },
    },
  },
});

// Transform cast for response
const castWithDetails = project.cast.map(pc => pc.character);
```

### Cast Panel Component

```tsx
// CastPanel.tsx
function CastPanel({ projectId, cast, onUpdate }: CastPanelProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const handleAdd = async (characterIds: string[]) => {
    await fetch(`/api/v1/projects/${projectId}/cast/batch`, {
      method: 'POST',
      body: JSON.stringify({ characterIds }),
    });
    onUpdate();
    setShowPicker(false);
  };

  const handleRemove = async (characterId: string) => {
    await fetch(`/api/v1/projects/${projectId}/cast/${characterId}`, {
      method: 'DELETE',
    });
    onUpdate();
    setRemoving(null);
  };

  return (
    <div className="cast-panel">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Cast</h3>
        <button onClick={() => setShowPicker(true)} className="btn-sm">
          + Add Character
        </button>
      </div>

      {cast.length === 0 ? (
        <p className="text-gray-500 text-sm">No characters in cast</p>
      ) : (
        <div className="space-y-2">
          {cast.map((character) => (
            <div key={character.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
              <img
                src={character.referenceImages[0] || '/placeholder-avatar.png'}
                className="w-10 h-10 rounded-full object-cover"
              />
              <span className="flex-1 truncate">{character.name}</span>
              <button
                onClick={() => setRemoving(character.id)}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showPicker && (
        <CharacterPicker
          excludeIds={cast.map(c => c.id)}
          onSelect={handleAdd}
          onClose={() => setShowPicker(false)}
        />
      )}

      {removing && (
        <ConfirmDialog
          message={`Remove ${cast.find(c => c.id === removing)?.name} from cast?`}
          onConfirm={() => handleRemove(removing)}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
```

### Character Picker

```tsx
// CharacterPicker.tsx
function CharacterPicker({ excludeIds, onSelect, onClose }: CharacterPickerProps) {
  const { characters } = useCharacters();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const available = characters.filter(c => !excludeIds.includes(c.id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="font-bold mb-4">Add Characters to Cast</h3>

        {available.length === 0 ? (
          <p className="text-gray-500">All characters are already in the cast</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {available.map((character) => (
              <div
                key={character.id}
                onClick={() => toggleSelect(character.id)}
                className={`p-2 border rounded cursor-pointer ${
                  selected.has(character.id) ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <img
                  src={character.referenceImages[0] || '/placeholder-avatar.png'}
                  className="w-full h-16 object-cover rounded mb-1"
                />
                <span className="text-sm truncate">{character.name}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button
            onClick={() => onSelect(Array.from(selected))}
            disabled={selected.size === 0}
            className="btn-primary disabled:opacity-50"
          >
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Image Generation Integration

When generating images, build prompt with cast:

```typescript
function buildImagePrompt(sentence: Sentence, cast: Character[]): string {
  const basePrompt = sentence.imagePrompt;

  if (cast.length === 0) return basePrompt;

  const characterDescriptions = cast
    .map(c => `${c.name}: ${c.description}`)
    .join('\n');

  return `${basePrompt}\n\nCharacters in scene:\n${characterDescriptions}`;
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-011: Character Library CRUD (characters must exist)
- STORY-008: Project CRUD API (project must exist)

**Blocked Stories:**
- STORY-017: Image Prompt Generation (uses cast for character context)
- STORY-018: Image Generation Job (includes character references)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Add to cast
  - [ ] Remove from cast
  - [ ] Duplicate prevention
  - [ ] Get project with cast
- [ ] Integration tests passing
  - [ ] Full add/remove flow
  - [ ] Batch add
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] API endpoint documentation
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of UI flows

---

## Story Points Breakdown

- **API endpoints:** 1 point
- **Cast panel UI:** 0.5 points
- **Character picker modal:** 0.5 points
- **Total:** 2 points

**Rationale:** Simple many-to-many relationship management. UI components are straightforward modals.

---

## Additional Notes

Future enhancements:
- Character roles (narrator, protagonist, etc.)
- Per-scene character assignment
- Character appearance frequency settings
- Character costume/outfit variations

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
