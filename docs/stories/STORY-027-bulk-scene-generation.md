# STORY-027: Bulk Scene Generation

**Epic:** Storyboard UI (EPIC-06)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 4

---

## User Story

As a **creator**
I want **to generate all images and videos at once**
So that **I can proceed efficiently without triggering each one manually**

---

## Description

### Background
After finalizing the script and audio, creators need to generate images and videos for all scenes. Bulk generation queues all necessary jobs in the correct order (audio → images → videos) and shows overall progress. This is the final step before export.

### Scope
**In scope:**
- "Generate All Images" button
- "Generate All Videos" button
- "Generate All" (audio → images → videos)
- Overall progress indicator
- Cancellation support
- Skip already-generated assets option

**Out of scope:**
- Selective batch generation
- Priority ordering
- Parallel audio+image generation (different dependencies)

### User Flow
1. User has script with sentences and prompts
2. User clicks "Generate All" in storyboard toolbar
3. System shows "Generating..." with overall progress
4. Audio generates first (if needed)
5. Then images generate (sequential, GPU)
6. Then videos generate (sequential, GPU)
7. Progress updates as each asset completes
8. User can cancel remaining jobs
9. On completion, all scenes are ready for export

---

## Acceptance Criteria

- [ ] "Generate All Images" button in storyboard toolbar
- [ ] "Generate All Videos" button in storyboard toolbar
- [ ] "Generate All" button (full pipeline)
- [ ] Dropdown to select generation option
- [ ] Option to skip non-dirty assets (default: true)
- [ ] Overall progress bar showing total completion
- [ ] Progress text: "Generating images: 15/50 (30%)"
- [ ] Each stage shows separate progress
- [ ] Cancel button stops remaining jobs
- [ ] Cancel confirms with dialog
- [ ] Already-completed assets are kept on cancel
- [ ] WebSocket updates drive progress
- [ ] Success toast on completion
- [ ] Error summary if any failed

---

## Technical Notes

### Components
- **Toolbar:** `src/components/Storyboard/GenerationToolbar.tsx`
- **Progress:** `src/components/Storyboard/BulkGenerationProgress.tsx`
- **Hook:** `src/hooks/useBulkGeneration.ts`

### API Endpoints

```
POST /api/v1/projects/:id/generate-all
{
  "stages": ["audio", "images", "videos"],  // Which stages to run
  "skipClean": true  // Skip non-dirty assets
}

Response (202):
{
  "jobCounts": {
    "audio": 24,
    "image": 50,
    "video": 50
  },
  "totalJobs": 124,
  "message": "Generation started"
}

POST /api/v1/projects/:id/generate-images
POST /api/v1/projects/:id/generate-videos
// Similar structure
```

### Generation Toolbar

```tsx
// GenerationToolbar.tsx
function GenerationToolbar({ projectId, sentences }: ToolbarProps) {
  const {
    isGenerating,
    progress,
    startGeneration,
    cancelGeneration,
  } = useBulkGeneration(projectId);

  const [showOptions, setShowOptions] = useState(false);

  const counts = useMemo(() => ({
    dirtyAudio: sentences.filter(s => s.isAudioDirty || !s.audioFile).length,
    dirtyImage: sentences.filter(s => s.isImageDirty || !s.imageFile).length,
    dirtyVideo: sentences.filter(s => s.isVideoDirty || !s.videoFile).length,
  }), [sentences]);

  if (isGenerating) {
    return <BulkGenerationProgress progress={progress} onCancel={cancelGeneration} />;
  }

  return (
    <div className="generation-toolbar flex items-center gap-2">
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="btn-primary flex items-center gap-2"
        >
          Generate All
          <ChevronDownIcon className="w-4 h-4" />
        </button>

        {showOptions && (
          <div className="absolute top-full mt-1 w-56 bg-white border rounded shadow-lg z-10">
            <button
              onClick={() => {
                startGeneration(['audio', 'images', 'videos']);
                setShowOptions(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50"
            >
              Generate All
              <span className="text-xs text-gray-500 block">
                Audio → Images → Videos
              </span>
            </button>
            <button
              onClick={() => {
                startGeneration(['images']);
                setShowOptions(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50"
            >
              Generate Images Only
              <span className="text-xs text-gray-500 block">
                {counts.dirtyImage} images to generate
              </span>
            </button>
            <button
              onClick={() => {
                startGeneration(['videos']);
                setShowOptions(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-50"
            >
              Generate Videos Only
              <span className="text-xs text-gray-500 block">
                {counts.dirtyVideo} videos to generate
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="text-sm text-gray-500">
        {counts.dirtyImage > 0 && <span>{counts.dirtyImage} images pending</span>}
        {counts.dirtyVideo > 0 && <span className="ml-3">{counts.dirtyVideo} videos pending</span>}
      </div>
    </div>
  );
}
```

### Bulk Generation Progress

```tsx
// BulkGenerationProgress.tsx
function BulkGenerationProgress({ progress, onCancel }: ProgressProps) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const overallPercent = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  return (
    <div className="bulk-progress flex items-center gap-4 flex-1">
      {/* Progress bar */}
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span>
            {progress.currentStage}: {progress.stageCompleted}/{progress.stageTotal}
          </span>
          <span>{overallPercent}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Overall: {progress.completed}/{progress.total}</span>
          {progress.failed > 0 && (
            <span className="text-red-500">{progress.failed} failed</span>
          )}
        </div>
      </div>

      {/* Cancel button */}
      <button
        onClick={() => setShowCancelConfirm(true)}
        className="btn-secondary"
      >
        Cancel
      </button>

      {showCancelConfirm && (
        <ConfirmDialog
          title="Cancel Generation?"
          message="Already generated assets will be kept. Remaining jobs will be cancelled."
          onConfirm={() => { onCancel(); setShowCancelConfirm(false); }}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}
    </div>
  );
}
```

### Bulk Generation Hook

```typescript
// useBulkGeneration.ts
interface BulkProgress {
  total: number;
  completed: number;
  failed: number;
  currentStage: 'audio' | 'images' | 'videos';
  stageTotal: number;
  stageCompleted: number;
}

function useBulkGeneration(projectId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<BulkProgress>({
    total: 0, completed: 0, failed: 0,
    currentStage: 'audio', stageTotal: 0, stageCompleted: 0,
  });

  const { lastEvent } = useWebSocket(projectId);

  // Track progress via WebSocket
  useEffect(() => {
    if (!lastEvent || !isGenerating) return;

    if (lastEvent.type === 'job_complete') {
      setProgress(prev => ({
        ...prev,
        completed: prev.completed + 1,
        stageCompleted: prev.stageCompleted + 1,
      }));
    }

    if (lastEvent.type === 'job_failed') {
      setProgress(prev => ({
        ...prev,
        failed: prev.failed + 1,
        stageCompleted: prev.stageCompleted + 1,
      }));
    }

    // Check for stage transition (via custom event or count)
    if (lastEvent.type === 'generation_stage_change') {
      setProgress(prev => ({
        ...prev,
        currentStage: lastEvent.stage,
        stageTotal: lastEvent.stageTotal,
        stageCompleted: 0,
      }));
    }
  }, [lastEvent, isGenerating]);

  // Check completion
  useEffect(() => {
    if (isGenerating && progress.completed + progress.failed >= progress.total) {
      setIsGenerating(false);
      if (progress.failed > 0) {
        toast.warn(`Completed with ${progress.failed} failures`);
      } else {
        toast.success('All generation complete!');
      }
    }
  }, [progress, isGenerating]);

  const startGeneration = async (stages: string[]) => {
    setIsGenerating(true);

    const response = await fetch(`/api/v1/projects/${projectId}/generate-all`, {
      method: 'POST',
      body: JSON.stringify({ stages, skipClean: true }),
    });

    const data = await response.json();

    setProgress({
      total: data.totalJobs,
      completed: 0,
      failed: 0,
      currentStage: stages[0] as any,
      stageTotal: data.jobCounts[stages[0]],
      stageCompleted: 0,
    });
  };

  const cancelGeneration = async () => {
    await fetch(`/api/v1/projects/${projectId}/cancel-generation`, {
      method: 'POST',
    });
    setIsGenerating(false);
  };

  return { isGenerating, progress, startGeneration, cancelGeneration };
}
```

### Backend: Bulk Generation Endpoint

```typescript
// POST /api/v1/projects/:id/generate-all
router.post('/:id/generate-all', async (req, res) => {
  const { id: projectId } = req.params;
  const { stages, skipClean } = req.body;

  const project = await getProjectWithSentences(projectId);
  const events: any[] = [];
  const jobCounts: Record<string, number> = {};

  for (const stage of stages) {
    const sentences = project.sentences.filter(s => {
      if (skipClean) {
        if (stage === 'audio') return s.isAudioDirty || !s.audioFile;
        if (stage === 'images') return s.isImageDirty || !s.imageFile;
        if (stage === 'videos') return s.isVideoDirty || !s.videoFile;
      }
      return true;
    });

    jobCounts[stage] = sentences.length;

    if (stage === 'audio') {
      events.push(...sentences.map(s => ({
        name: 'audio/generate',
        data: { projectId, sentenceId: s.id, text: s.text, voiceId: project.voiceId },
      })));
    }

    if (stage === 'images') {
      events.push(...sentences.map(s => ({
        name: 'image/generate',
        data: { projectId, sentenceId: s.id, imagePrompt: s.imagePrompt },
      })));
    }

    if (stage === 'videos') {
      events.push(...sentences.filter(s => s.imageFile).map(s => ({
        name: 'video/generate',
        data: {
          projectId,
          sentenceId: s.id,
          imageFile: s.imageFile,
          cameraMovement: s.cameraMovement,
          motionStrength: s.motionStrength,
        },
      })));
    }
  }

  await inngest.send(events);

  res.status(202).json({
    jobCounts,
    totalJobs: events.length,
    message: 'Generation started',
  });
});
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-016: Bulk Audio Generation (audio stage)
- STORY-018: Image Generation Job (image stage)
- STORY-020: Video Generation Job (video stage)
- STORY-023: Storyboard Table View (toolbar location)

**Blocked Stories:**
- STORY-028: Export Service (all assets must be generated)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Stage filtering
  - [ ] Progress calculation
  - [ ] Cancel logic
- [ ] Integration tests passing
  - [ ] Multi-stage generation
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with full pipeline

---

## Story Points Breakdown

- **Toolbar with dropdown:** 1 point
- **Progress component:** 1 point
- **Backend endpoint:** 0.5 points
- **Cancel functionality:** 0.5 points
- **Total:** 3 points

**Rationale:** Orchestration of existing generation jobs. Progress tracking requires coordination across multiple job types.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
