# STORY-019: Image Regeneration & Override

**Epic:** Image Generation (EPIC-04)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 3

---

## User Story

As a **creator**
I want **to edit image prompts and regenerate individual images**
So that **I have creative control over specific visuals**

---

## Description

### Background
Auto-generated images won't always match the creator's vision. The ability to manually adjust image prompts and regenerate specific images (without regenerating the entire project) is essential for creative control. This also enables iterating on problematic images until they're satisfactory.

### Scope
**In scope:**
- Edit imagePrompt field in scene inspector
- "Regenerate Image" button for single sentence
- Regeneration replaces old image
- Progress indicator during regeneration
- Seed control for variation
- Visual diff (show old vs new - optional)

**Out of scope:**
- Batch regeneration of selected images
- Image editing/inpainting
- Multiple image variants per sentence
- Undo/revert to previous image

### User Flow
1. User opens scene in storyboard inspector
2. User sees current image and prompt
3. User edits image prompt text
4. Changes auto-save (marks dirty)
5. User clicks "Regenerate Image"
6. Progress indicator shows during generation
7. New image replaces old image
8. User can repeat until satisfied
9. Optionally: change seed for different variation

---

## Acceptance Criteria

- [ ] Image prompt editable in scene inspector panel
- [ ] Prompt changes auto-save with debounce
- [ ] Editing prompt sets `isImageDirty: true` and `isVideoDirty: true`
- [ ] "Regenerate Image" button visible in inspector
- [ ] Button disabled during active generation
- [ ] Click triggers `image/generate` event for single sentence
- [ ] Progress indicator shows during generation
- [ ] Generated image replaces existing image
- [ ] Image preview updates immediately after completion
- [ ] Seed input field (optional, random if empty)
- [ ] "Regenerate with new seed" quick action
- [ ] Error state shows retry option
- [ ] Old image file deleted after successful replacement

---

## Technical Notes

### Components
- **UI:** `src/components/Storyboard/SceneInspector.tsx`
- **UI:** `src/components/Storyboard/ImagePromptEditor.tsx`
- **API:** `src/backend/api/sentences.ts`

### API Endpoints

#### Update Sentence (Prompt Edit)
```
PUT /api/v1/sentences/:id
Content-Type: application/json

Request:
{
  "imagePrompt": "A wide shot of a coffee plantation...",
  "isImageDirty": true,
  "isVideoDirty": true
}

Response (200):
{
  "id": "sent_001",
  "imagePrompt": "A wide shot of a coffee plantation...",
  "isImageDirty": true,
  "isVideoDirty": true,
  ...
}
```

#### Regenerate Image
```
POST /api/v1/sentences/:id/regenerate-image
Content-Type: application/json

Request:
{
  "seed": 12345  // Optional, random if not provided
}

Response (202):
{
  "jobId": "job_xyz",
  "message": "Image regeneration started"
}
```

### Scene Inspector Component

```tsx
// SceneInspector.tsx
function SceneInspector({ sentence, onUpdate }: SceneInspectorProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { lastEvent } = useWebSocket(sentence.projectId);

  // Handle completion
  useEffect(() => {
    if (lastEvent?.type === 'job_complete' &&
        lastEvent.jobType === 'image' &&
        lastEvent.sentenceId === sentence.id) {
      setIsRegenerating(false);
      onUpdate(); // Refresh sentence data
    }
  }, [lastEvent]);

  const handleRegenerate = async (newSeed?: number) => {
    setIsRegenerating(true);
    await fetch(`/api/v1/sentences/${sentence.id}/regenerate-image`, {
      method: 'POST',
      body: JSON.stringify({ seed: newSeed }),
    });
  };

  return (
    <div className="scene-inspector p-4">
      <div className="tabs">
        <Tab label="IMAGE" active />
        <Tab label="VIDEO" />
      </div>

      {/* Image Preview */}
      <div className="image-preview mb-4">
        {sentence.imageFile ? (
          <img
            src={sentence.imageFile}
            alt="Scene"
            className={`w-full rounded ${isRegenerating ? 'opacity-50' : ''}`}
          />
        ) : (
          <div className="bg-gray-200 h-40 flex items-center justify-center rounded">
            No image generated
          </div>
        )}
        {isRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Prompt Editor */}
      <ImagePromptEditor
        prompt={sentence.imagePrompt || ''}
        onChange={(prompt) => onUpdate({ imagePrompt: prompt, isImageDirty: true, isVideoDirty: true })}
        disabled={isRegenerating}
      />

      {/* Regenerate Controls */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => handleRegenerate()}
          disabled={isRegenerating || !sentence.imagePrompt}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {isRegenerating ? 'Generating...' : 'Regenerate Image'}
        </button>
        <SeedInput
          onSubmit={(seed) => handleRegenerate(seed)}
          disabled={isRegenerating}
        />
      </div>

      {/* Dirty indicator */}
      {sentence.isImageDirty && sentence.imageFile && (
        <p className="text-yellow-600 text-sm mt-2">
          Prompt changed. Regenerate to update image.
        </p>
      )}
    </div>
  );
}
```

### Image Prompt Editor

```tsx
// ImagePromptEditor.tsx
function ImagePromptEditor({ prompt, onChange, disabled }: ImagePromptEditorProps) {
  const [value, setValue] = useState(prompt);
  const debouncedSave = useMemo(
    () => debounce(onChange, 500),
    [onChange]
  );

  useEffect(() => {
    setValue(prompt);
  }, [prompt]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    debouncedSave(newValue);
  };

  return (
    <div className="image-prompt-editor">
      <label className="block text-sm font-medium mb-1">Image Prompt</label>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        rows={5}
        className="w-full border rounded p-2 text-sm disabled:bg-gray-100"
        placeholder="Describe the visual scene..."
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>{value.length} characters</span>
        <span>50-150 words recommended</span>
      </div>
    </div>
  );
}
```

### Seed Input Component

```tsx
// SeedInput.tsx
function SeedInput({ onSubmit, disabled }: SeedInputProps) {
  const [showInput, setShowInput] = useState(false);
  const [seed, setSeed] = useState('');

  const handleSubmit = () => {
    const seedNum = seed ? parseInt(seed) : undefined;
    onSubmit(seedNum);
    setShowInput(false);
    setSeed('');
  };

  if (!showInput) {
    return (
      <button
        onClick={() => setShowInput(true)}
        disabled={disabled}
        className="btn-secondary"
        title="Regenerate with specific seed"
      >
        <DiceIcon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex gap-1">
      <input
        type="number"
        value={seed}
        onChange={(e) => setSeed(e.target.value)}
        placeholder="Seed"
        className="w-24 border rounded px-2 text-sm"
      />
      <button onClick={handleSubmit} className="btn-primary text-sm">
        Go
      </button>
      <button onClick={() => setShowInput(false)} className="text-gray-500">
        ×
      </button>
    </div>
  );
}
```

### Backend: Regenerate Endpoint

```typescript
// POST /api/v1/sentences/:id/regenerate-image
router.post('/:id/regenerate-image', async (req, res) => {
  const { id } = req.params;
  const { seed } = req.body;

  const sentence = await getSentenceWithSection(id);
  if (!sentence) return res.status(404).json({ error: 'Sentence not found' });

  if (!sentence.imagePrompt) {
    return res.status(400).json({ error: 'No image prompt to generate from' });
  }

  // Get project for character refs and style
  const project = await getProjectWithCast(sentence.section.projectId);

  // Delete old image if exists
  if (sentence.imageFile) {
    await rm(sentence.imageFile, { force: true });
  }

  // Queue regeneration
  const event = await inngest.send({
    name: 'image/generate',
    data: {
      projectId: project.id,
      sentenceId: id,
      imagePrompt: sentence.imagePrompt,
      characterRefs: project.cast.flatMap(c => c.referenceImages),
      styleLora: project.cast[0]?.styleLora,
      seed: seed || undefined,
    },
  });

  // Create job record
  const job = await jobService.createJob({
    projectId: project.id,
    sentenceId: id,
    jobType: 'image',
    inngestRunId: event.ids[0],
  });

  res.status(202).json({
    jobId: job.id,
    message: 'Image regeneration started',
  });
});
```

### Cascading Dirty Flags

When image prompt changes, video must also be regenerated:

```typescript
// Update sentence with dirty cascade
await db.update(sentences)
  .set({
    imagePrompt: newPrompt,
    isImageDirty: true,
    isVideoDirty: true,  // Video depends on image
    updatedAt: new Date(),
  })
  .where(eq(sentences.id, sentenceId));
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-018: Image Generation Job (generation logic)
- STORY-023: Storyboard Table View (displays scenes)
- STORY-025: Scene Inspector Panel (edit context)

**Blocked Stories:**
- STORY-033: Prompt Edit Regeneration (uses same pattern)

**External Dependencies:**
- ComfyUI running

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Prompt update API
  - [ ] Dirty flag cascade
  - [ ] Seed handling
- [ ] Integration tests passing
  - [ ] Edit and regenerate flow
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of regeneration

---

## Story Points Breakdown

- **Scene inspector UI:** 1.5 points
- **Prompt editor with auto-save:** 0.5 points
- **Regenerate API endpoint:** 0.5 points
- **Seed control UI:** 0.5 points
- **Total:** 3 points

**Rationale:** UI-focused story leveraging existing image generation infrastructure. Main complexity is state management for in-progress regeneration.

---

## Additional Notes

UX improvements to consider:
- Show before/after comparison
- Thumbnail history of previous generations
- Favorite/lock good generations
- Prompt suggestions/improvements

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
