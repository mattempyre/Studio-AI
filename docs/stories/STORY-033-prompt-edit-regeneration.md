# STORY-033: Prompt Edit Regeneration

**Epic:** Cascading Updates (EPIC-08)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **images/videos to regenerate when I edit prompts**
So that **visuals match my creative direction**

---

## Description

### Background
When a creator refines an image or video prompt, the existing generated asset no longer matches the new description. Similar to audio regeneration, the system should detect prompt changes and facilitate regeneration. This ensures visual consistency with the creator's vision.

### Scope
**In scope:**
- Detect image prompt changes → mark image dirty
- Detect video prompt changes → mark video dirty
- UI to regenerate individual images/videos
- Queue regeneration jobs
- Handle cascading (image change → video dirty)
- Batch regeneration of dirty visuals

**Out of scope:**
- Auto-regeneration without user consent
- A/B comparison of old vs new
- Partial regeneration based on diff

### User Flow
1. User edits image or video prompt in scene inspector
2. System marks appropriate assets as dirty
3. Dirty indicator appears on scene
4. User can regenerate immediately or continue editing
5. Job is queued for regeneration
6. New asset replaces old when complete
7. If image changed, video also marked dirty

---

## Acceptance Criteria

- [ ] Image prompt edit marks `isImageDirty = true`, `isVideoDirty = true`
- [ ] Video prompt edit marks `isVideoDirty = true`
- [ ] Camera movement change marks `isVideoDirty = true`
- [ ] Motion strength change marks `isVideoDirty = true`
- [ ] UI shows dirty indicators on scene cards
- [ ] "Regenerate Image" button on dirty image scenes
- [ ] "Regenerate Video" button on dirty video scenes
- [ ] Image regeneration cascades to video dirty
- [ ] Jobs queued with correct parameters
- [ ] Progress shown during regeneration
- [ ] Old files cleaned up after replacement
- [ ] "Regenerate All Dirty Images/Videos" option

---

## Technical Notes

### Components
- **UI:** `src/components/Storyboard/SceneCard.tsx` (modify)
- **UI:** `src/components/Storyboard/DirtyVisualIndicator.tsx`
- **Hook:** `src/hooks/useVisualRegeneration.ts`
- **Backend:** Uses existing image/video generation jobs

### Dirty Visual Indicator

```tsx
// DirtyVisualIndicator.tsx
interface DirtyVisualIndicatorProps {
  sentence: Sentence;
  onRegenerateImage?: () => void;
  onRegenerateVideo?: () => void;
  isRegenerating: { image: boolean; video: boolean };
}

function DirtyVisualIndicator({
  sentence,
  onRegenerateImage,
  onRegenerateVideo,
  isRegenerating,
}: DirtyVisualIndicatorProps) {
  const hasDirtyImage = sentence.isImageDirty && sentence.imageFile;
  const hasDirtyVideo = sentence.isVideoDirty && sentence.videoFile;

  if (!hasDirtyImage && !hasDirtyVideo) return null;

  return (
    <div className="dirty-indicator absolute top-2 right-2 flex flex-col gap-1">
      {hasDirtyImage && (
        <button
          onClick={onRegenerateImage}
          disabled={isRegenerating.image}
          className="flex items-center gap-1 px-2 py-1 bg-yellow-100 hover:bg-yellow-200
                     rounded text-xs text-yellow-800 shadow"
          title="Image prompt has changed"
        >
          {isRegenerating.image ? (
            <Spinner className="w-3 h-3" />
          ) : (
            <RefreshIcon className="w-3 h-3" />
          )}
          Image
        </button>
      )}
      {hasDirtyVideo && (
        <button
          onClick={onRegenerateVideo}
          disabled={isRegenerating.video}
          className="flex items-center gap-1 px-2 py-1 bg-orange-100 hover:bg-orange-200
                     rounded text-xs text-orange-800 shadow"
          title="Video settings have changed"
        >
          {isRegenerating.video ? (
            <Spinner className="w-3 h-3" />
          ) : (
            <RefreshIcon className="w-3 h-3" />
          )}
          Video
        </button>
      )}
    </div>
  );
}
```

### Visual Regeneration Hook

```typescript
// useVisualRegeneration.ts
interface UseVisualRegenerationOptions {
  projectId: string;
}

function useVisualRegeneration({ projectId }: UseVisualRegenerationOptions) {
  const [regeneratingImages, setRegeneratingImages] = useState<Set<string>>(new Set());
  const [regeneratingVideos, setRegeneratingVideos] = useState<Set<string>>(new Set());
  const { lastEvent } = useWebSocket(projectId);

  // Track completions
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'job_complete') {
      if (lastEvent.jobType === 'image') {
        setRegeneratingImages(prev => {
          const next = new Set(prev);
          next.delete(lastEvent.sentenceId);
          return next;
        });
      }
      if (lastEvent.jobType === 'video') {
        setRegeneratingVideos(prev => {
          const next = new Set(prev);
          next.delete(lastEvent.sentenceId);
          return next;
        });
      }
    }

    if (lastEvent.type === 'job_failed') {
      if (lastEvent.jobType === 'image') {
        setRegeneratingImages(prev => {
          const next = new Set(prev);
          next.delete(lastEvent.sentenceId);
          return next;
        });
        toast.error(`Image regeneration failed: ${lastEvent.error}`);
      }
      if (lastEvent.jobType === 'video') {
        setRegeneratingVideos(prev => {
          const next = new Set(prev);
          next.delete(lastEvent.sentenceId);
          return next;
        });
        toast.error(`Video regeneration failed: ${lastEvent.error}`);
      }
    }
  }, [lastEvent]);

  const regenerateImage = async (sentence: Sentence) => {
    setRegeneratingImages(prev => new Set(prev).add(sentence.id));

    try {
      await fetch('/api/v1/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sentenceId: sentence.id,
          imagePrompt: sentence.imagePrompt,
        }),
      });
    } catch (error) {
      setRegeneratingImages(prev => {
        const next = new Set(prev);
        next.delete(sentence.id);
        return next;
      });
      throw error;
    }
  };

  const regenerateVideo = async (sentence: Sentence) => {
    if (!sentence.imageFile) {
      toast.error('Cannot generate video without an image');
      return;
    }

    setRegeneratingVideos(prev => new Set(prev).add(sentence.id));

    try {
      await fetch('/api/v1/videos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sentenceId: sentence.id,
          imageFile: sentence.imageFile,
          videoPrompt: sentence.videoPrompt,
          cameraMovement: sentence.cameraMovement,
          motionStrength: sentence.motionStrength,
          duration: sentence.audioDuration,
        }),
      });
    } catch (error) {
      setRegeneratingVideos(prev => {
        const next = new Set(prev);
        next.delete(sentence.id);
        return next;
      });
      throw error;
    }
  };

  const regenerateAllDirtyImages = async (sentences: Sentence[]) => {
    const dirty = sentences.filter(s => s.isImageDirty && s.imagePrompt);
    for (const sentence of dirty) {
      await regenerateImage(sentence);
    }
    toast.info(`Queued ${dirty.length} image regenerations`);
  };

  const regenerateAllDirtyVideos = async (sentences: Sentence[]) => {
    const dirty = sentences.filter(s => s.isVideoDirty && s.imageFile);
    for (const sentence of dirty) {
      await regenerateVideo(sentence);
    }
    toast.info(`Queued ${dirty.length} video regenerations`);
  };

  return {
    regenerateImage,
    regenerateVideo,
    regenerateAllDirtyImages,
    regenerateAllDirtyVideos,
    isRegeneratingImage: (id: string) => regeneratingImages.has(id),
    isRegeneratingVideo: (id: string) => regeneratingVideos.has(id),
    regeneratingImageCount: regeneratingImages.size,
    regeneratingVideoCount: regeneratingVideos.size,
  };
}
```

### Scene Inspector Integration

```tsx
// SceneInspector.tsx - prompt editing section
function PromptEditor({ sentence, projectId, onUpdate }: PromptEditorProps) {
  const [imagePrompt, setImagePrompt] = useState(sentence.imagePrompt || '');
  const [videoPrompt, setVideoPrompt] = useState(sentence.videoPrompt || '');
  const { regenerateImage, regenerateVideo, isRegeneratingImage, isRegeneratingVideo } =
    useVisualRegeneration({ projectId });

  const handleImagePromptSave = async () => {
    if (imagePrompt !== sentence.imagePrompt) {
      await onUpdate({ imagePrompt });
      // Backend marks image and video dirty via dependency service
    }
  };

  const handleVideoPromptSave = async () => {
    if (videoPrompt !== sentence.videoPrompt) {
      await onUpdate({ videoPrompt });
      // Backend marks video dirty
    }
  };

  return (
    <div className="space-y-4">
      {/* Image Prompt */}
      <div>
        <label className="block text-sm font-medium mb-1">Image Prompt</label>
        <textarea
          value={imagePrompt}
          onChange={(e) => setImagePrompt(e.target.value)}
          onBlur={handleImagePromptSave}
          className="w-full p-2 border rounded"
          rows={3}
        />
        {sentence.isImageDirty && (
          <button
            onClick={() => regenerateImage(sentence)}
            disabled={isRegeneratingImage(sentence.id)}
            className="mt-2 btn-secondary text-sm"
          >
            {isRegeneratingImage(sentence.id) ? 'Regenerating...' : 'Regenerate Image'}
          </button>
        )}
      </div>

      {/* Video Prompt */}
      <div>
        <label className="block text-sm font-medium mb-1">Video Prompt</label>
        <textarea
          value={videoPrompt}
          onChange={(e) => setVideoPrompt(e.target.value)}
          onBlur={handleVideoPromptSave}
          className="w-full p-2 border rounded"
          rows={2}
        />
        {sentence.isVideoDirty && sentence.imageFile && (
          <button
            onClick={() => regenerateVideo(sentence)}
            disabled={isRegeneratingVideo(sentence.id)}
            className="mt-2 btn-secondary text-sm"
          >
            {isRegeneratingVideo(sentence.id) ? 'Regenerating...' : 'Regenerate Video'}
          </button>
        )}
      </div>
    </div>
  );
}
```

### Camera Settings Dirty Tracking

```tsx
// CameraMovementControls.tsx
function CameraMovementControls({ sentence, projectId, onUpdate }: ControlsProps) {
  const handleCameraChange = async (movement: CameraMovement) => {
    if (movement !== sentence.cameraMovement) {
      await onUpdate({ cameraMovement: movement });
      // Backend marks video dirty
    }
  };

  const handleStrengthChange = async (strength: number) => {
    if (strength !== sentence.motionStrength) {
      await onUpdate({ motionStrength: strength });
      // Backend marks video dirty
    }
  };

  // ... camera movement UI
}
```

### Batch Regeneration Toolbar

```tsx
// StoryboardToolbar.tsx
function RegenerationStats({ sentences, projectId }: StatsProps) {
  const { regenerateAllDirtyImages, regenerateAllDirtyVideos,
          regeneratingImageCount, regeneratingVideoCount } =
    useVisualRegeneration({ projectId });

  const dirtyImageCount = sentences.filter(s => s.isImageDirty).length;
  const dirtyVideoCount = sentences.filter(s => s.isVideoDirty).length;

  if (dirtyImageCount === 0 && dirtyVideoCount === 0) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-yellow-50 border-b">
      {dirtyImageCount > 0 && (
        <button
          onClick={() => regenerateAllDirtyImages(sentences)}
          disabled={regeneratingImageCount > 0}
          className="text-sm text-yellow-700 hover:text-yellow-900"
        >
          {regeneratingImageCount > 0
            ? `Regenerating ${regeneratingImageCount} images...`
            : `Regenerate ${dirtyImageCount} dirty images`}
        </button>
      )}
      {dirtyVideoCount > 0 && (
        <button
          onClick={() => regenerateAllDirtyVideos(sentences)}
          disabled={regeneratingVideoCount > 0}
          className="text-sm text-orange-700 hover:text-orange-900"
        >
          {regeneratingVideoCount > 0
            ? `Regenerating ${regeneratingVideoCount} videos...`
            : `Regenerate ${dirtyVideoCount} dirty videos`}
        </button>
      )}
    </div>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-031: Dependency Tracking (dirty flags)
- STORY-018: Image Generation Job (image generation)
- STORY-020: Video Generation Job (video generation)
- STORY-025: Scene Inspector Panel (prompt editing UI)

**Blocked Stories:**
- None

**External Dependencies:**
- ComfyUI for image/video generation

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Prompt change detection
  - [ ] Dirty flag cascade
  - [ ] Regeneration queue
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of prompt edit → regenerate flow

---

## Story Points Breakdown

- **Dirty indicator component:** 0.5 points
- **Visual regeneration hook:** 1 point
- **Inspector integration:** 1 point
- **Batch regeneration:** 0.5 points
- **Total:** 3 points

**Rationale:** Similar pattern to audio regeneration. Lower complexity since image/video jobs are already well-established.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
