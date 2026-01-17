# STORY-022: Video Regeneration & Override

**Epic:** Video Generation (EPIC-05)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 4

---

## User Story

As a **creator**
I want **to edit video prompts and regenerate individual videos**
So that **I can fine-tune motion and visual style for specific scenes**

---

## Description

### Background
Video generation parameters (prompt, movement, strength) can be adjusted after initial generation. Creators need to regenerate individual videos when adjusting settings without regenerating all videos. This enables iterative refinement of motion effects.

### Scope
**In scope:**
- Edit videoPrompt field in scene inspector
- "Regenerate Video" button for single sentence
- Regeneration replaces old video
- Progress indicator during regeneration
- Uses current camera movement and strength settings

**Out of scope:**
- Batch video regeneration
- Video preview before confirming
- Multiple video variants
- Undo/revert functionality

### User Flow
1. User opens scene in storyboard inspector
2. User navigates to VIDEO tab
3. User sees video preview and settings
4. User edits video prompt or adjusts movement
5. User clicks "Regenerate Video"
6. Progress shows during generation
7. New video replaces old video
8. User can iterate until satisfied

---

## Acceptance Criteria

- [ ] Video prompt editable in scene inspector
- [ ] Prompt changes auto-save with debounce
- [ ] Editing prompt sets `isVideoDirty: true`
- [ ] "Regenerate Video" button in VIDEO tab
- [ ] Button requires source image to exist
- [ ] Button disabled during active generation
- [ ] Click triggers `video/generate` event for single sentence
- [ ] Current camera movement and strength used
- [ ] Progress indicator during generation
- [ ] New video replaces existing video
- [ ] Video preview updates after completion
- [ ] Old video file deleted after replacement
- [ ] Error state shows retry option

---

## Technical Notes

### Components
- **UI:** `src/components/Storyboard/VideoPromptEditor.tsx`
- **API:** `src/backend/api/sentences.ts`

### API Endpoint

```
POST /api/v1/sentences/:id/regenerate-video

Request:
{} // Uses current sentence settings

Response (202):
{
  "jobId": "job_xyz",
  "message": "Video regeneration started"
}
```

### Video Prompt Editor

```tsx
// VideoPromptEditor.tsx
function VideoPromptEditor({ prompt, onChange, disabled }: EditorProps) {
  const [value, setValue] = useState(prompt);
  const debouncedSave = useMemo(() => debounce(onChange, 500), [onChange]);

  useEffect(() => setValue(prompt), [prompt]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    debouncedSave(newValue);
  };

  return (
    <div className="video-prompt-editor">
      <label className="block text-sm font-medium mb-1">Video Prompt</label>
      <p className="text-xs text-gray-500 mb-2">
        Describe motion, action, or atmosphere (optional)
      </p>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        rows={3}
        className="w-full border rounded p-2 text-sm"
        placeholder="E.g., 'Slow pan revealing the landscape, golden hour lighting'"
      />
    </div>
  );
}
```

### Backend: Regenerate Video Endpoint

```typescript
// POST /api/v1/sentences/:id/regenerate-video
router.post('/:id/regenerate-video', async (req, res) => {
  const { id } = req.params;

  const sentence = await getSentenceWithSection(id);
  if (!sentence) return res.status(404).json({ error: 'Sentence not found' });

  if (!sentence.imageFile) {
    return res.status(400).json({ error: 'No source image - generate image first' });
  }

  const projectId = sentence.section.projectId;

  // Delete old video if exists
  if (sentence.videoFile) {
    await rm(sentence.videoFile, { force: true });
  }

  // Queue regeneration with current settings
  const event = await inngest.send({
    name: 'video/generate',
    data: {
      projectId,
      sentenceId: id,
      imageFile: sentence.imageFile,
      videoPrompt: sentence.videoPrompt,
      cameraMovement: sentence.cameraMovement,
      motionStrength: sentence.motionStrength,
      targetDuration: sentence.audioDuration,
    },
  });

  const job = await jobService.createJob({
    projectId,
    sentenceId: id,
    jobType: 'video',
    inngestRunId: event.ids[0],
  });

  res.status(202).json({
    jobId: job.id,
    message: 'Video regeneration started',
  });
});
```

### Video Tab with Regeneration

```tsx
// VideoTab.tsx
function VideoTab({ sentence, onUpdate, projectId }: VideoTabProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { lastEvent } = useWebSocket(projectId);

  useEffect(() => {
    if (lastEvent?.type === 'job_complete' &&
        lastEvent.jobType === 'video' &&
        lastEvent.sentenceId === sentence.id) {
      setIsRegenerating(false);
      onUpdate();
    }
  }, [lastEvent]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await fetch(`/api/v1/sentences/${sentence.id}/regenerate-video`, {
      method: 'POST',
    });
  };

  return (
    <div className="space-y-4">
      {/* Video Preview */}
      <div className="relative">
        {sentence.videoFile ? (
          <video
            src={sentence.videoFile}
            controls
            className={`w-full rounded ${isRegenerating ? 'opacity-50' : ''}`}
          />
        ) : (
          <div className="bg-gray-200 h-40 flex items-center justify-center rounded">
            {sentence.imageFile ? 'Ready to generate video' : 'Generate image first'}
          </div>
        )}
        {isRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Spinner className="w-8 h-8 mx-auto" />
              <p className="text-sm mt-2">Generating video...</p>
            </div>
          </div>
        )}
      </div>

      {/* Camera Controls */}
      <CameraMovementSelector
        value={sentence.cameraMovement}
        onChange={(cameraMovement) => onUpdate({ cameraMovement, isVideoDirty: true })}
        disabled={isRegenerating}
      />

      <MotionStrengthSlider
        value={sentence.motionStrength}
        onChange={(motionStrength) => onUpdate({ motionStrength, isVideoDirty: true })}
        disabled={isRegenerating}
      />

      {/* Video Prompt */}
      <VideoPromptEditor
        prompt={sentence.videoPrompt || ''}
        onChange={(videoPrompt) => onUpdate({ videoPrompt, isVideoDirty: true })}
        disabled={isRegenerating}
      />

      {/* Regenerate Button */}
      <button
        onClick={handleRegenerate}
        disabled={isRegenerating || !sentence.imageFile}
        className="btn-primary w-full disabled:opacity-50"
      >
        {isRegenerating ? 'Generating...' : sentence.videoFile ? 'Regenerate Video' : 'Generate Video'}
      </button>

      {/* Dirty indicator */}
      {sentence.isVideoDirty && sentence.videoFile && (
        <p className="text-yellow-600 text-sm">
          Settings changed. Regenerate to update video.
        </p>
      )}

      {/* Requirements message */}
      {!sentence.imageFile && (
        <p className="text-gray-500 text-sm text-center">
          Generate an image first before creating video
        </p>
      )}
    </div>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-020: Video Generation Job
- STORY-021: Camera Movement Controls
- STORY-025: Scene Inspector Panel

**Blocked Stories:**
- STORY-033: Prompt Edit Regeneration (similar pattern)

**External Dependencies:**
- ComfyUI running

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Prompt update API
  - [ ] Regeneration trigger
  - [ ] State management
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of regeneration

---

## Story Points Breakdown

- **Video prompt editor:** 0.5 points
- **Regenerate API endpoint:** 1 point
- **UI state management:** 1 point
- **Integration & testing:** 0.5 points
- **Total:** 3 points

**Rationale:** Mirrors image regeneration pattern (STORY-019) but for video. Leverages existing video generation infrastructure.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
