# STORY-025: Scene Inspector Panel

**Epic:** Storyboard UI (EPIC-06)
**Priority:** Must Have
**Story Points:** 5
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 4

---

## User Story

As a **creator**
I want **a scene inspector panel**
So that **I can view and edit scene details including prompts and settings**

---

## Description

### Background
When a scene is selected in the storyboard, the inspector panel shows detailed information and controls. This is the primary interface for editing prompts, adjusting settings, and triggering regeneration. The panel has tabs for IMAGE and VIDEO settings.

### Scope
**In scope:**
- Right panel that appears on scene selection
- IMAGE tab: prompt editor, style, regenerate button
- VIDEO tab: prompt, camera movement, motion strength, regenerate
- Preview of current image/video
- Audio playback for sentence
- Close button to deselect scene

**Out of scope:**
- Multiple scene selection
- Batch editing
- Advanced image/video editing
- Comparison views

### User Flow
1. User clicks scene in storyboard
2. Inspector panel slides in from right
3. Default tab shows IMAGE settings
4. User can edit image prompt and regenerate
5. User can switch to VIDEO tab
6. User can adjust camera settings and regenerate
7. User can play audio
8. User clicks X to close panel

---

## Acceptance Criteria

- [ ] Panel slides in from right when scene selected
- [ ] Panel width: 400px on desktop, full width on mobile
- [ ] Close button (X) in header
- [ ] Scene narration text displayed at top
- [ ] Audio play button if audio exists
- [ ] Tab navigation: IMAGE | VIDEO
- [ ] IMAGE tab includes:
  - [ ] Current image preview
  - [ ] Image prompt textarea (editable)
  - [ ] Regenerate Image button
  - [ ] Dirty indicator if prompt changed
- [ ] VIDEO tab includes:
  - [ ] Current video preview with controls
  - [ ] Video prompt textarea (optional)
  - [ ] Camera movement selector
  - [ ] Motion strength slider
  - [ ] Regenerate Video button
  - [ ] Dirty indicator if settings changed
- [ ] Generation progress shown inline
- [ ] WebSocket updates reflected in real-time
- [ ] Click outside panel does not close (only X button)

---

## Technical Notes

### Components
- **Panel:** `src/components/Storyboard/SceneInspector.tsx`
- **Tabs:** `src/components/Storyboard/InspectorTabs.tsx`
- **ImageTab:** `src/components/Storyboard/ImageTabContent.tsx`
- **VideoTab:** `src/components/Storyboard/VideoTabContent.tsx`

### Scene Inspector

```tsx
// SceneInspector.tsx
type Tab = 'image' | 'video';

function SceneInspector({ sentence, projectId, onClose, onUpdate }: InspectorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('image');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleUpdate = async (updates: Partial<Sentence>) => {
    await fetch(`/api/v1/sentences/${sentence.id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    onUpdate();
  };

  const toggleAudio = () => {
    if (!sentence.audioFile) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioRef.current = new Audio(sentence.audioFile);
      audioRef.current.play();
      audioRef.current.onended = () => setIsPlaying(false);
      setIsPlaying(true);
    }
  };

  return (
    <div className="scene-inspector w-[400px] border-l bg-white h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Scene #{sentence.globalIndex + 1}</h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
          <XIcon className="w-5 h-5" />
        </button>
      </header>

      {/* Narration */}
      <div className="p-4 border-b">
        <div className="flex items-start gap-2">
          {sentence.audioFile && (
            <button
              onClick={toggleAudio}
              className="p-2 rounded-full bg-blue-100 hover:bg-blue-200"
            >
              {isPlaying ? <StopIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            </button>
          )}
          <p className="text-sm text-gray-700 flex-1">{sentence.text}</p>
        </div>
        {sentence.audioDuration && (
          <p className="text-xs text-gray-500 mt-1">
            Duration: {formatDuration(sentence.audioDuration)}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-2 text-center ${
            activeTab === 'image' ? 'border-b-2 border-blue-500 font-semibold' : ''
          }`}
        >
          IMAGE
        </button>
        <button
          onClick={() => setActiveTab('video')}
          className={`flex-1 py-2 text-center ${
            activeTab === 'video' ? 'border-b-2 border-blue-500 font-semibold' : ''
          }`}
        >
          VIDEO
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'image' ? (
          <ImageTabContent
            sentence={sentence}
            projectId={projectId}
            onUpdate={handleUpdate}
          />
        ) : (
          <VideoTabContent
            sentence={sentence}
            projectId={projectId}
            onUpdate={handleUpdate}
          />
        )}
      </div>
    </div>
  );
}
```

### Image Tab Content

```tsx
// ImageTabContent.tsx
function ImageTabContent({ sentence, projectId, onUpdate }: TabProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { lastEvent } = useWebSocket(projectId);

  useEffect(() => {
    if (lastEvent?.type === 'job_complete' &&
        lastEvent.jobType === 'image' &&
        lastEvent.sentenceId === sentence.id) {
      setIsRegenerating(false);
      onUpdate({});
    }
  }, [lastEvent]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await fetch(`/api/v1/sentences/${sentence.id}/regenerate-image`, {
      method: 'POST',
    });
  };

  return (
    <div className="space-y-4">
      {/* Image Preview */}
      <div className="relative aspect-video bg-gray-100 rounded overflow-hidden">
        {sentence.imageFile ? (
          <img
            src={sentence.imageFile}
            alt="Scene"
            className={`w-full h-full object-cover ${isRegenerating ? 'opacity-50' : ''}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No image
          </div>
        )}
        {isRegenerating && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="w-8 h-8" />
          </div>
        )}
      </div>

      {/* Image Prompt */}
      <ImagePromptEditor
        prompt={sentence.imagePrompt || ''}
        onChange={(imagePrompt) => onUpdate({ imagePrompt, isImageDirty: true, isVideoDirty: true })}
        disabled={isRegenerating}
      />

      {/* Dirty Indicator */}
      {sentence.isImageDirty && sentence.imageFile && (
        <p className="text-yellow-600 text-sm flex items-center gap-1">
          <WarningIcon className="w-4 h-4" />
          Prompt changed. Regenerate to update.
        </p>
      )}

      {/* Regenerate Button */}
      <button
        onClick={handleRegenerate}
        disabled={isRegenerating || !sentence.imagePrompt}
        className="btn-primary w-full disabled:opacity-50"
      >
        {isRegenerating ? 'Generating...' : sentence.imageFile ? 'Regenerate Image' : 'Generate Image'}
      </button>
    </div>
  );
}
```

### Animation & Styling

```css
/* Panel slide-in animation */
.scene-inspector {
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .scene-inspector {
    width: 100%;
    position: fixed;
    inset: 0;
    z-index: 50;
  }
}
```

### Integration with Storyboard

```tsx
// Storyboard.tsx
function Storyboard({ projectId }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, refetch } = useStoryboard(projectId);

  const selectedScene = selectedId
    ? data?.scenes.find(s => s.id === selectedId)
    : null;

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1">
        {/* Table or Grid */}
      </div>

      {/* Inspector */}
      {selectedScene && (
        <SceneInspector
          sentence={selectedScene}
          projectId={projectId}
          onClose={() => setSelectedId(null)}
          onUpdate={refetch}
        />
      )}
    </div>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-023: Storyboard Table View
- STORY-019: Image Regeneration (image controls)
- STORY-022: Video Regeneration (video controls)

**Blocked Stories:**
- None (integrates existing functionality)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Tab switching
  - [ ] Audio playback
  - [ ] Update propagation
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Responsive design tested
- [ ] Accessibility reviewed (keyboard navigation, screen readers)
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of all interactions

---

## Story Points Breakdown

- **Panel structure & animation:** 1 point
- **Image tab content:** 1.5 points
- **Video tab content:** 1.5 points
- **Audio playback:** 0.5 points
- **WebSocket integration:** 0.5 points
- **Total:** 5 points

**Rationale:** Combines several features into cohesive panel. Real-time updates and state management add complexity.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
