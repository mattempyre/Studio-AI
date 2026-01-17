# STORY-032: Sentence Edit Regeneration

**Epic:** Cascading Updates (EPIC-08)
**Priority:** Must Have
**Story Points:** 5
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 4

---

## User Story

As a **creator**
I want **audio to automatically regenerate when I edit sentence text**
So that **my narration stays in sync with the script**

---

## Description

### Background
When a creator edits the text of a sentence, the existing audio no longer matches. The system should detect text changes and offer to regenerate affected audio. This maintains consistency between script and narration without manual intervention.

### Scope
**In scope:**
- Detect text changes in sentence edit
- Mark audio as dirty (via dependency tracking)
- Prompt user to regenerate immediately or later
- Queue audio regeneration job
- Update sentence with new audio file
- Handle batch text edits

**Out of scope:**
- Auto-regeneration without user consent
- Diff-based partial regeneration
- Audio merging/splicing

### User Flow
1. User edits sentence text in script editor
2. System detects text has changed
3. Audio dirty flag is set
4. User sees "Audio out of sync" indicator
5. User can click "Regenerate Audio" or continue editing
6. If regenerating, audio job is queued
7. New audio replaces old when complete
8. Dirty flag is cleared

---

## Acceptance Criteria

- [ ] Text edit triggers `isAudioDirty = true`
- [ ] UI shows "Audio out of sync" warning on dirty sentences
- [ ] "Regenerate Audio" button appears on dirty sentences
- [ ] Click queues audio generation job
- [ ] Job uses current voice settings
- [ ] Progress shows during regeneration
- [ ] New audio file replaces old
- [ ] Old audio file is cleaned up
- [ ] Dirty flag cleared on completion
- [ ] Batch edit marks all affected sentences dirty
- [ ] "Regenerate All Dirty" option available

---

## Technical Notes

### Components
- **UI:** `src/components/ScriptEditor/SentenceEditor.tsx` (modify)
- **UI:** `src/components/ScriptEditor/DirtyAudioWarning.tsx`
- **Hook:** `src/hooks/useAudioRegeneration.ts`
- **Backend:** Uses existing audio generation job

### Dirty Audio Warning Component

```tsx
// DirtyAudioWarning.tsx
interface DirtyAudioWarningProps {
  sentence: Sentence;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

function DirtyAudioWarning({ sentence, onRegenerate, isRegenerating }: DirtyAudioWarningProps) {
  if (!sentence.isAudioDirty) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
      <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600" />
      <span className="text-sm text-yellow-700">
        Audio is out of sync with text
      </span>
      <button
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="ml-auto text-sm px-2 py-1 bg-yellow-100 hover:bg-yellow-200 rounded text-yellow-800"
      >
        {isRegenerating ? (
          <>
            <Spinner className="w-3 h-3 inline mr-1" />
            Regenerating...
          </>
        ) : (
          'Regenerate Audio'
        )}
      </button>
    </div>
  );
}
```

### Audio Regeneration Hook

```typescript
// useAudioRegeneration.ts
interface UseAudioRegenerationOptions {
  projectId: string;
  voiceId: string;
}

function useAudioRegeneration({ projectId, voiceId }: UseAudioRegenerationOptions) {
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());
  const { lastEvent } = useWebSocket(projectId);

  // Track completion via WebSocket
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'job_complete' && lastEvent.jobType === 'audio') {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(lastEvent.sentenceId);
        return next;
      });
    }

    if (lastEvent.type === 'job_failed' && lastEvent.jobType === 'audio') {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(lastEvent.sentenceId);
        return next;
      });
      toast.error(`Audio regeneration failed: ${lastEvent.error}`);
    }
  }, [lastEvent]);

  const regenerateAudio = async (sentenceId: string, text: string) => {
    setRegeneratingIds(prev => new Set(prev).add(sentenceId));

    try {
      await fetch('/api/v1/audio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sentenceId,
          text,
          voiceId,
        }),
      });
    } catch (error) {
      setRegeneratingIds(prev => {
        const next = new Set(prev);
        next.delete(sentenceId);
        return next;
      });
      throw error;
    }
  };

  const regenerateAllDirty = async (sentences: Sentence[]) => {
    const dirtySentences = sentences.filter(s => s.isAudioDirty);

    for (const sentence of dirtySentences) {
      await regenerateAudio(sentence.id, sentence.text);
    }

    toast.info(`Queued ${dirtySentences.length} audio regenerations`);
  };

  const isRegenerating = (sentenceId: string) => regeneratingIds.has(sentenceId);

  return {
    regenerateAudio,
    regenerateAllDirty,
    isRegenerating,
    regeneratingCount: regeneratingIds.size,
  };
}
```

### Sentence Editor Integration

```tsx
// SentenceEditor.tsx
function SentenceEditor({ sentence, projectId, voiceId, onUpdate }: EditorProps) {
  const [text, setText] = useState(sentence.text);
  const [isEditing, setIsEditing] = useState(false);
  const { regenerateAudio, isRegenerating } = useAudioRegeneration({ projectId, voiceId });
  const debounceRef = useRef<NodeJS.Timeout>();

  // Handle text change with debounced save
  const handleTextChange = (newText: string) => {
    setText(newText);

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Save after 500ms of no typing
    debounceRef.current = setTimeout(async () => {
      if (newText !== sentence.text) {
        await onUpdate({ text: newText });
        // Backend will mark audio as dirty via dependency service
      }
    }, 500);
  };

  const handleRegenerate = () => {
    regenerateAudio(sentence.id, text);
  };

  return (
    <div className="sentence-editor">
      <textarea
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        onFocus={() => setIsEditing(true)}
        onBlur={() => setIsEditing(false)}
        className="w-full p-2 border rounded resize-none"
        rows={3}
      />

      {/* Audio preview */}
      {sentence.audioFile && (
        <div className="mt-2">
          <AudioPlayer src={sentence.audioFile} />
        </div>
      )}

      {/* Dirty warning */}
      <DirtyAudioWarning
        sentence={sentence}
        onRegenerate={handleRegenerate}
        isRegenerating={isRegenerating(sentence.id)}
      />
    </div>
  );
}
```

### Batch Regeneration UI

```tsx
// ScriptEditorToolbar.tsx
function ScriptEditorToolbar({ sentences, projectId, voiceId }: ToolbarProps) {
  const { regenerateAllDirty, regeneratingCount } = useAudioRegeneration({ projectId, voiceId });

  const dirtyCount = sentences.filter(s => s.isAudioDirty).length;

  if (dirtyCount === 0) return null;

  return (
    <div className="toolbar-warning bg-yellow-50 px-4 py-2 flex items-center justify-between">
      <span className="text-sm text-yellow-700">
        {dirtyCount} sentence{dirtyCount > 1 ? 's have' : ' has'} outdated audio
      </span>
      <button
        onClick={() => regenerateAllDirty(sentences)}
        disabled={regeneratingCount > 0}
        className="btn-secondary text-sm"
      >
        {regeneratingCount > 0 ? (
          `Regenerating ${regeneratingCount}...`
        ) : (
          'Regenerate All'
        )}
      </button>
    </div>
  );
}
```

### Backend: Clean Up Old Audio

```typescript
// In audio generation job completion
await step.run('cleanup-old-audio', async () => {
  const sentence = await db.select().from(sentences).where(eq(sentences.id, sentenceId)).get();

  if (sentence?.audioFile && sentence.audioFile !== newAudioFile) {
    // Delete old audio file
    try {
      await fs.unlink(sentence.audioFile);
    } catch (error) {
      // File may already be deleted, log but don't fail
      console.warn(`Could not delete old audio file: ${sentence.audioFile}`);
    }
  }
});

await step.run('update-sentence', async () => {
  await db.update(sentences).set({
    audioFile: newAudioFile,
    audioDuration: duration,
    isAudioDirty: false,
    updatedAt: new Date(),
  }).where(eq(sentences.id, sentenceId));
});
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-031: Dependency Tracking (dirty flags)
- STORY-014: Audio Generation Job (audio generation)
- STORY-010: Script Editor Component (UI)

**Blocked Stories:**
- None

**External Dependencies:**
- Chatterbox TTS service

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Text change detection
  - [ ] Dirty flag propagation
  - [ ] Regeneration queue
- [ ] Integration tests passing
  - [ ] End-to-end regeneration flow
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of edit → regenerate flow

---

## Story Points Breakdown

- **Dirty warning component:** 1 point
- **Regeneration hook:** 1.5 points
- **Editor integration:** 1.5 points
- **Batch regeneration:** 0.5 points
- **Old file cleanup:** 0.5 points
- **Total:** 5 points

**Rationale:** Integration across multiple components. Debounced editing and WebSocket progress tracking add complexity.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
