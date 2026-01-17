# STORY-016: Bulk Audio Generation

**Epic:** Voice Generation (EPIC-03)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator**
I want **to generate audio for all sentences at once**
So that **I can proceed efficiently without clicking each one individually**

---

## Description

### Background
Scripts can have dozens or hundreds of sentences. Generating audio one-by-one would be tedious. Bulk generation queues audio jobs for all sentences at once, with a progress indicator showing overall completion. The system handles parallelism (up to 4 concurrent jobs) automatically via Inngest.

### Scope
**In scope:**
- "Generate All Audio" button in script editor
- Queue audio events for all sentences lacking audio
- Overall progress bar showing completion percentage
- Individual sentence status indicators
- Audio playback inline with each sentence
- Cancel generation option

**Out of scope:**
- Selective generation (generating subset of sentences)
- Priority ordering (generate section by section)
- Resume interrupted generation (new session)

### User Flow
1. User has script with sentences
2. User clicks "Generate All Audio"
3. Button shows "Generating... (0/24)"
4. Progress bar fills as sentences complete
5. Each sentence shows status: pending → generating → complete
6. Completed sentences show play button
7. User can click play to hear sentence audio
8. When all complete, button changes to "Regenerate Audio"
9. User can cancel to stop remaining jobs

---

## Acceptance Criteria

- [ ] "Generate All Audio" button in script editor toolbar
- [ ] Button disabled if all sentences have audio (not dirty)
- [ ] Clicking button queues `audio/generate` events for all dirty sentences
- [ ] Progress shows: "Generating... (5/24)" with live updates
- [ ] Progress bar shows percentage completion
- [ ] Each sentence row shows generation status icon:
  - ⏳ Pending (in queue)
  - 🔄 Generating (in progress)
  - ✓ Complete (has audio)
  - ❌ Failed (error)
- [ ] Completed sentences show play button
- [ ] Play button plays audio inline (not full audio player)
- [ ] Multiple plays queue/overlap handling (stop previous)
- [ ] "Cancel" button stops remaining queued jobs
- [ ] Cancel does not remove already-generated audio
- [ ] WebSocket updates drive all status changes
- [ ] On completion, show success toast with count
- [ ] Failed sentences show retry option

---

## Technical Notes

### Components
- **UI:** `src/components/ScriptEditor/AudioToolbar.tsx`
- **UI:** `src/components/ScriptEditor/SentenceAudioStatus.tsx`
- **Hook:** `src/hooks/useAudioGeneration.ts`

### API Endpoint

```
POST /api/v1/projects/:id/generate-audio
Content-Type: application/json

Request:
{
  "sentenceIds": ["sent_1", "sent_2"],  // Optional, all dirty if omitted
  "force": false  // If true, regenerate even non-dirty
}

Response (202):
{
  "jobCount": 24,
  "message": "Audio generation started for 24 sentences"
}
```

### Audio Toolbar Component

```tsx
// AudioToolbar.tsx
function AudioToolbar({ projectId, sentences, voiceId }: AudioToolbarProps) {
  const { isGenerating, progress, startGeneration, cancelGeneration } = useAudioGeneration(projectId);

  const dirtySentences = sentences.filter(s => s.isAudioDirty || !s.audioFile);
  const completedCount = sentences.filter(s => s.audioFile && !s.isAudioDirty).length;

  const handleGenerate = () => {
    startGeneration(dirtySentences.map(s => s.id), voiceId);
  };

  return (
    <div className="audio-toolbar flex items-center gap-4 p-3 bg-gray-100 rounded">
      {isGenerating ? (
        <>
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span>Generating audio...</span>
              <span>{progress.completed}/{progress.total}</span>
            </div>
            <div className="w-full bg-gray-300 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(progress.completed / progress.total) * 100}%` }}
              />
            </div>
          </div>
          <button onClick={cancelGeneration} className="btn-secondary">
            Cancel
          </button>
        </>
      ) : (
        <>
          <span className="text-sm">
            {completedCount}/{sentences.length} sentences have audio
          </span>
          <button
            onClick={handleGenerate}
            disabled={dirtySentences.length === 0}
            className="btn-primary disabled:opacity-50"
          >
            {completedCount === 0 ? 'Generate All Audio' : 'Regenerate Dirty Audio'}
            {dirtySentences.length > 0 && ` (${dirtySentences.length})`}
          </button>
        </>
      )}
    </div>
  );
}
```

### Sentence Audio Status Component

```tsx
// SentenceAudioStatus.tsx
function SentenceAudioStatus({ sentence, generationStatus }: SentenceAudioStatusProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const status = generationStatus || (sentence.audioFile ? 'complete' : 'pending');

  const togglePlay = () => {
    if (!sentence.audioFile) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      // Stop any other playing audio
      document.querySelectorAll('audio').forEach(a => a.pause());

      audioRef.current = new Audio(sentence.audioFile);
      audioRef.current.play();
      audioRef.current.onended = () => setIsPlaying(false);
      setIsPlaying(true);
    }
  };

  return (
    <div className="sentence-audio-status flex items-center gap-2">
      {status === 'pending' && <ClockIcon className="w-4 h-4 text-gray-400" />}
      {status === 'generating' && <Spinner className="w-4 h-4 text-blue-500" />}
      {status === 'complete' && (
        <button onClick={togglePlay} className="p-1 hover:bg-gray-200 rounded">
          {isPlaying ? (
            <StopIcon className="w-4 h-4 text-blue-500" />
          ) : (
            <PlayIcon className="w-4 h-4 text-green-500" />
          )}
        </button>
      )}
      {status === 'failed' && (
        <span className="text-red-500" title="Generation failed">
          <XCircleIcon className="w-4 h-4" />
        </span>
      )}

      {sentence.audioDuration && status === 'complete' && (
        <span className="text-xs text-gray-500">
          {formatDuration(sentence.audioDuration)}
        </span>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}
```

### Generation Hook

```typescript
// useAudioGeneration.ts
function useAudioGeneration(projectId: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, failed: 0 });
  const [sentenceStatuses, setSentenceStatuses] = useState<Record<string, string>>({});
  const { lastEvent } = useWebSocket(projectId);

  // Handle WebSocket events
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'progress' && lastEvent.jobType === 'audio') {
      setSentenceStatuses(prev => ({
        ...prev,
        [lastEvent.sentenceId]: 'generating',
      }));
    }

    if (lastEvent.type === 'job_complete' && lastEvent.jobType === 'audio') {
      setSentenceStatuses(prev => ({
        ...prev,
        [lastEvent.sentenceId]: 'complete',
      }));
      setProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
    }

    if (lastEvent.type === 'job_failed' && lastEvent.jobType === 'audio') {
      setSentenceStatuses(prev => ({
        ...prev,
        [lastEvent.sentenceId]: 'failed',
      }));
      setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
    }
  }, [lastEvent]);

  // Check if generation is complete
  useEffect(() => {
    if (isGenerating && progress.completed + progress.failed >= progress.total) {
      setIsGenerating(false);
      toast.success(`Generated ${progress.completed} audio files`);
    }
  }, [progress, isGenerating]);

  const startGeneration = async (sentenceIds: string[], voiceId: string) => {
    setIsGenerating(true);
    setProgress({ completed: 0, total: sentenceIds.length, failed: 0 });
    setSentenceStatuses(
      Object.fromEntries(sentenceIds.map(id => [id, 'pending']))
    );

    await fetch(`/api/v1/projects/${projectId}/generate-audio`, {
      method: 'POST',
      body: JSON.stringify({ sentenceIds }),
    });
  };

  const cancelGeneration = async () => {
    // Cancel remaining jobs
    await fetch(`/api/v1/projects/${projectId}/cancel-audio`, {
      method: 'POST',
    });
    setIsGenerating(false);
  };

  return {
    isGenerating,
    progress,
    sentenceStatuses,
    startGeneration,
    cancelGeneration,
  };
}
```

### Backend: Bulk Queue Endpoint

```typescript
// POST /api/v1/projects/:id/generate-audio
router.post('/:id/generate-audio', async (req, res) => {
  const { id: projectId } = req.params;
  const { sentenceIds, force } = req.body;

  // Get project with voice
  const project = await getProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Get sentences to generate
  let toGenerate: Sentence[];
  if (sentenceIds) {
    toGenerate = await getSentencesByIds(sentenceIds);
  } else {
    // All dirty sentences
    const allSentences = await getSentencesByProject(projectId);
    toGenerate = allSentences.filter(s => s.isAudioDirty || !s.audioFile || force);
  }

  // Queue events
  const events = toGenerate.map(sentence => ({
    name: 'audio/generate' as const,
    data: {
      projectId,
      sentenceId: sentence.id,
      text: sentence.text,
      voiceId: project.voiceId,
    },
  }));

  await inngest.send(events);

  res.status(202).json({
    jobCount: events.length,
    message: `Audio generation started for ${events.length} sentences`,
  });
});
```

### Cancel Endpoint

```typescript
// POST /api/v1/projects/:id/cancel-audio
router.post('/:id/cancel-audio', async (req, res) => {
  const { id: projectId } = req.params;

  // Mark queued jobs as cancelled
  await db.update(generationJobs)
    .set({ status: 'cancelled' })
    .where(
      and(
        eq(generationJobs.projectId, projectId),
        eq(generationJobs.jobType, 'audio'),
        eq(generationJobs.status, 'queued')
      )
    );

  // Note: Running jobs will complete - Inngest handles this
  res.json({ message: 'Remaining audio jobs cancelled' });
});
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-014: Audio Generation Job (individual audio generation)
- STORY-010: Script Editor Component (displays sentences)
- STORY-007: WebSocket Progress Server (progress updates)

**Blocked Stories:**
- STORY-027: Bulk Scene Generation (similar pattern)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Progress calculation
  - [ ] Status tracking
  - [ ] Cancel logic
- [ ] Integration tests passing
  - [ ] Bulk queue flow
  - [ ] WebSocket updates
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with 20+ sentence project

---

## Story Points Breakdown

- **Bulk queue API endpoint:** 1 point
- **Progress UI components:** 1 point
- **WebSocket integration & state:** 1 point
- **Total:** 3 points

**Rationale:** Coordination logic between frontend state and WebSocket events is the main complexity. Individual generation is already handled by STORY-014.

---

## Additional Notes

Performance considerations:
- With 4 concurrent jobs, 100 sentences takes ~25x single sentence time
- Consider showing ETA based on average generation time
- Large projects may benefit from batch progress (every 10%)

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
