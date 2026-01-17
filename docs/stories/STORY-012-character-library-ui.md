# STORY-012: Character Library UI

**Epic:** Character System (EPIC-02)
**Priority:** Must Have
**Story Points:** 3
**Status:** Completed
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator**
I want **a character library panel**
So that **I can browse and manage my characters visually**

---

## Description

### Background
The character library needs a user-friendly interface for creating, viewing, editing, and deleting characters. The UI should display characters in a visual grid with thumbnails, and provide modals for detailed character management.

### Scope
**In scope:**
- Character library panel component (slide-out or dedicated page)
- Grid view with character thumbnails (first reference image)
- Create character modal with form
- Edit character modal with existing data
- Image upload with drag-and-drop
- Delete character with confirmation
- Empty state for new users

**Out of scope:**
- Character search/filter
- Character sorting options
- Batch operations
- Character import/export

### User Flow
1. User clicks "Characters" in navigation
2. Character library panel opens
3. User sees grid of existing characters
4. User clicks "+" to create new character
5. Modal opens with name, description, image upload
6. User fills form and uploads reference images
7. User clicks "Save" to create character
8. Character appears in grid
9. User can click character card to edit
10. User can click delete icon with confirmation

---

## Acceptance Criteria

- [ ] Character library accessible from main navigation
- [ ] Grid displays all characters with thumbnails
- [ ] Characters without images show placeholder avatar
- [ ] Card shows: thumbnail, name, description preview
- [ ] "Create Character" button opens create modal
- [ ] Create modal has: name input, description textarea, image dropzone
- [ ] Image dropzone accepts drag-and-drop or click-to-browse
- [ ] Multiple images can be uploaded (up to 5)
- [ ] Image preview shown after upload with remove option
- [ ] Validation: name required, images max 5MB each
- [ ] Click character card opens edit modal with existing data
- [ ] Edit modal shows current images with option to delete each
- [ ] Delete button on card shows confirmation dialog
- [ ] Confirmation dialog requires typing character name
- [ ] Empty state shows "No characters yet" with create prompt
- [ ] Loading state while fetching characters
- [ ] Error state with retry option on API failure
- [ ] Toast notification on successful create/edit/delete

---

## Technical Notes

### Components
- **Panel:** `src/components/CharacterLibrary/CharacterLibrary.tsx`
- **Grid:** `src/components/CharacterLibrary/CharacterGrid.tsx`
- **Card:** `src/components/CharacterLibrary/CharacterCard.tsx`
- **Modal:** `src/components/CharacterLibrary/CharacterModal.tsx`
- **Upload:** `src/components/CharacterLibrary/ImageUploader.tsx`

### Component Structure

```tsx
// CharacterLibrary.tsx
function CharacterLibrary() {
  const { characters, isLoading, error, refetch } = useCharacters();
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  if (isLoading) return <LoadingGrid />;
  if (error) return <ErrorState onRetry={refetch} />;
  if (characters.length === 0) return <EmptyState onCreate={() => setIsCreating(true)} />;

  return (
    <div className="character-library">
      <header className="flex justify-between items-center p-4">
        <h2 className="text-xl font-bold">Characters</h2>
        <button onClick={() => setIsCreating(true)} className="btn-primary">
          + New Character
        </button>
      </header>

      <CharacterGrid characters={characters} onSelect={setEditingCharacter} />

      {isCreating && (
        <CharacterModal
          onClose={() => setIsCreating(false)}
          onSave={() => { refetch(); setIsCreating(false); }}
        />
      )}

      {editingCharacter && (
        <CharacterModal
          character={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onSave={() => { refetch(); setEditingCharacter(null); }}
          onDelete={() => { refetch(); setEditingCharacter(null); }}
        />
      )}
    </div>
  );
}
```

### Character Card

```tsx
// CharacterCard.tsx
function CharacterCard({ character, onSelect }: CharacterCardProps) {
  const thumbnail = character.referenceImages[0] || '/placeholder-avatar.png';

  return (
    <div
      onClick={() => onSelect(character)}
      className="character-card bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition"
    >
      <img
        src={thumbnail}
        alt={character.name}
        className="w-full h-32 object-cover rounded mb-3"
      />
      <h3 className="font-semibold truncate">{character.name}</h3>
      {character.description && (
        <p className="text-sm text-gray-500 line-clamp-2">{character.description}</p>
      )}
      {character.styleLora && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-2 inline-block">
          LoRA: {character.styleLora}
        </span>
      )}
    </div>
  );
}
```

### Image Uploader with Drag-and-Drop

```tsx
// ImageUploader.tsx
function ImageUploader({ images, onUpload, onRemove, maxImages = 5 }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    const available = maxImages - images.length;
    files.slice(0, available).forEach(file => onUpload(file));
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {images.map((img, index) => (
          <div key={index} className="relative">
            <img src={img} className="w-full h-20 object-cover rounded" />
            <button
              onClick={() => onRemove(index)}
              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {images.length < maxImages && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
            ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => Array.from(e.target.files || []).forEach(onUpload)}
          />
          <p>Drop images here or click to browse</p>
          <p className="text-sm text-gray-500">{images.length} of {maxImages} images</p>
        </div>
      )}
    </div>
  );
}
```

### Delete Confirmation Dialog

```tsx
// DeleteConfirmation.tsx
function DeleteConfirmation({ characterName, onConfirm, onCancel }: Props) {
  const [input, setInput] = useState('');
  const canDelete = input === characterName;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 max-w-md">
        <h3 className="text-lg font-bold text-red-600">Delete Character?</h3>
        <p className="my-4">
          This will permanently delete "{characterName}" and all reference images.
        </p>
        <p className="text-sm mb-2">Type the character name to confirm:</p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full border rounded px-3 py-2 mb-4"
          placeholder={characterName}
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!canDelete}
            className="btn-danger disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

### State Management Hook

```typescript
// useCharacters.ts
function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCharacters = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/characters');
      const data = await response.json();
      setCharacters(data.characters);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCharacters(); }, []);

  return { characters, isLoading, error, refetch: fetchCharacters };
}
```

### Accessibility
- Keyboard navigation for grid
- Focus management in modals
- Screen reader labels for images
- Escape key closes modals

---

## Dependencies

**Prerequisite Stories:**
- STORY-011: Character Library CRUD (API endpoints)

**Blocked Stories:**
- STORY-013: Project Cast Management (uses character selection)

**External Dependencies:**
- None (uses native HTML drag-and-drop)

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Grid rendering with characters
  - [ ] Empty state display
  - [ ] Modal open/close
  - [ ] Image upload validation
  - [ ] Delete confirmation logic
- [ ] Integration tests passing
  - [ ] Create character flow
  - [ ] Edit character flow
  - [ ] Delete with confirmation
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Component usage examples
- [ ] Accessibility audit passed
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of all interactions

---

## Story Points Breakdown

- **Grid and card components:** 1 point
- **Create/edit modal with form:** 1 point
- **Image upload with drag-and-drop:** 0.5 points
- **Delete confirmation:** 0.5 points
- **Total:** 3 points

**Rationale:** UI component work with standard React patterns. Drag-and-drop is well-supported by browsers natively.

---

## Additional Notes

Design considerations:
- Consider dark mode support
- Responsive grid for mobile
- Skeleton loading states for perceived performance
- Optimistic updates for better UX

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
