# STORY-034: Progress Dashboard

**Epic:** Polish & Usability (EPIC-09)
**Priority:** Should Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **to see overall project progress at a glance**
So that **I know how close my video is to completion**

---

## Description

### Background
With multiple generation stages (audio, images, videos) and many scenes, creators need visibility into overall project completion. The progress dashboard aggregates status across all scenes and shows generation stage progress, helping creators understand what's done, in progress, and remaining.

### Scope
**In scope:**
- Progress summary in project header
- Per-stage completion percentages
- Visual progress bars
- Quick stats: total scenes, completed, pending
- Link to jump to incomplete items
- Real-time updates via WebSocket

**Out of scope:**
- Detailed job history
- Time estimates
- Cost tracking
- Resource usage

### User Flow
1. User opens project
2. Dashboard shows overall completion percentage
3. Breakdown by stage: audio %, images %, videos %
4. User can see how many scenes need attention
5. Click "X incomplete" to filter/navigate to them
6. Progress updates in real-time as jobs complete

---

## Acceptance Criteria

- [ ] Progress summary visible in project header or sidebar
- [ ] Overall completion percentage calculated
- [ ] Per-stage progress: audio, images, videos
- [ ] Visual progress bars for each stage
- [ ] Scene counts: total, complete, in-progress, pending
- [ ] "X scenes incomplete" with quick filter link
- [ ] Real-time updates via WebSocket
- [ ] Dirty items counted separately
- [ ] Empty state for new projects
- [ ] Compact mode for smaller screens

---

## Technical Notes

### Components
- **Dashboard:** `src/components/Project/ProgressDashboard.tsx`
- **Stats:** `src/components/Project/ProjectStats.tsx`
- **Hook:** `src/hooks/useProjectProgress.ts`

### Progress Calculation

```typescript
// useProjectProgress.ts
interface ProjectProgress {
  total: number;
  audio: { complete: number; dirty: number; missing: number };
  images: { complete: number; dirty: number; missing: number };
  videos: { complete: number; dirty: number; missing: number };
  overallPercent: number;
}

function useProjectProgress(sentences: Sentence[]): ProjectProgress {
  return useMemo(() => {
    const total = sentences.length;

    const audio = {
      complete: sentences.filter(s => s.audioFile && !s.isAudioDirty).length,
      dirty: sentences.filter(s => s.audioFile && s.isAudioDirty).length,
      missing: sentences.filter(s => !s.audioFile).length,
    };

    const images = {
      complete: sentences.filter(s => s.imageFile && !s.isImageDirty).length,
      dirty: sentences.filter(s => s.imageFile && s.isImageDirty).length,
      missing: sentences.filter(s => !s.imageFile).length,
    };

    const videos = {
      complete: sentences.filter(s => s.videoFile && !s.isVideoDirty).length,
      dirty: sentences.filter(s => s.videoFile && s.isVideoDirty).length,
      missing: sentences.filter(s => !s.videoFile).length,
    };

    // Overall: count each asset type as 1/3 of total progress
    const audioPercent = total > 0 ? (audio.complete / total) * 100 : 0;
    const imagePercent = total > 0 ? (images.complete / total) * 100 : 0;
    const videoPercent = total > 0 ? (videos.complete / total) * 100 : 0;

    const overallPercent = Math.round((audioPercent + imagePercent + videoPercent) / 3);

    return { total, audio, images, videos, overallPercent };
  }, [sentences]);
}
```

### Progress Dashboard Component

```tsx
// ProgressDashboard.tsx
interface ProgressDashboardProps {
  sentences: Sentence[];
  onFilterIncomplete: (type: 'audio' | 'images' | 'videos') => void;
}

function ProgressDashboard({ sentences, onFilterIncomplete }: ProgressDashboardProps) {
  const progress = useProjectProgress(sentences);

  return (
    <div className="progress-dashboard bg-white rounded-lg shadow p-4">
      {/* Overall Progress */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="font-semibold">Project Progress</span>
          <span className="text-2xl font-bold text-blue-600">
            {progress.overallPercent}%
          </span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress.overallPercent}%` }}
          />
        </div>
      </div>

      {/* Stage Breakdown */}
      <div className="space-y-3">
        <StageProgress
          label="Audio"
          icon={<SpeakerIcon className="w-4 h-4" />}
          stats={progress.audio}
          total={progress.total}
          color="green"
          onClickIncomplete={() => onFilterIncomplete('audio')}
        />
        <StageProgress
          label="Images"
          icon={<ImageIcon className="w-4 h-4" />}
          stats={progress.images}
          total={progress.total}
          color="purple"
          onClickIncomplete={() => onFilterIncomplete('images')}
        />
        <StageProgress
          label="Videos"
          icon={<VideoIcon className="w-4 h-4" />}
          stats={progress.videos}
          total={progress.total}
          color="orange"
          onClickIncomplete={() => onFilterIncomplete('videos')}
        />
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t text-sm text-gray-500">
        {progress.total} scenes total
        {progress.audio.dirty + progress.images.dirty + progress.videos.dirty > 0 && (
          <span className="ml-2 text-yellow-600">
            • {progress.audio.dirty + progress.images.dirty + progress.videos.dirty} need regeneration
          </span>
        )}
      </div>
    </div>
  );
}
```

### Stage Progress Component

```tsx
// StageProgress.tsx
interface StageProgressProps {
  label: string;
  icon: React.ReactNode;
  stats: { complete: number; dirty: number; missing: number };
  total: number;
  color: 'green' | 'purple' | 'orange';
  onClickIncomplete: () => void;
}

function StageProgress({ label, icon, stats, total, color, onClickIncomplete }: StageProgressProps) {
  const percent = total > 0 ? Math.round((stats.complete / total) * 100) : 0;
  const incomplete = stats.dirty + stats.missing;

  const colorClasses = {
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div>
      <div className="flex justify-between items-center text-sm mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-600">{stats.complete}/{total}</span>
          {incomplete > 0 && (
            <button
              onClick={onClickIncomplete}
              className="text-xs text-blue-600 hover:underline"
            >
              {incomplete} incomplete
            </button>
          )}
        </div>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex">
        {/* Complete portion */}
        <div
          className={`${colorClasses[color]} transition-all`}
          style={{ width: `${percent}%` }}
        />
        {/* Dirty portion (needs regeneration) */}
        {stats.dirty > 0 && (
          <div
            className="bg-yellow-400"
            style={{ width: `${(stats.dirty / total) * 100}%` }}
            title={`${stats.dirty} need regeneration`}
          />
        )}
      </div>
    </div>
  );
}
```

### Compact Progress Indicator

```tsx
// CompactProgress.tsx - for project header
function CompactProgress({ sentences }: { sentences: Sentence[] }) {
  const progress = useProjectProgress(sentences);

  return (
    <div className="flex items-center gap-3">
      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500"
          style={{ width: `${progress.overallPercent}%` }}
        />
      </div>
      <span className="text-sm text-gray-600">
        {progress.overallPercent}% complete
      </span>
    </div>
  );
}
```

### Real-time Updates

```tsx
// In parent component using WebSocket
function ProjectView({ projectId }: { projectId: string }) {
  const { data, mutate } = useStoryboard(projectId);
  const { lastEvent } = useWebSocket(projectId);

  // Update sentences when jobs complete
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'job_complete' || lastEvent.type === 'sentence_dirty_changed') {
      // Refetch to get latest state
      mutate();
    }
  }, [lastEvent, mutate]);

  return (
    <div>
      <ProgressDashboard
        sentences={data?.sentences || []}
        onFilterIncomplete={(type) => {
          // Navigate to storyboard with filter
          setFilter({ type, status: 'incomplete' });
        }}
      />
      {/* Rest of UI */}
    </div>
  );
}
```

### Integration in Project Header

```tsx
// ProjectHeader.tsx
function ProjectHeader({ project, sentences }: HeaderProps) {
  return (
    <header className="flex items-center justify-between p-4 border-b bg-white">
      <div>
        <h1 className="text-xl font-bold">{project.name}</h1>
        <span className="text-sm text-gray-500">{project.topic}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Compact progress indicator */}
        <CompactProgress sentences={sentences} />

        {/* Actions */}
        <ExportButton projectId={project.id} />
      </div>
    </header>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-031: Dependency Tracking (dirty flags for accurate progress)
- STORY-007: WebSocket Progress Server (real-time updates)

**Blocked Stories:**
- None

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Progress calculation
  - [ ] Dirty handling
  - [ ] Percentage rounding
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Responsive design tested
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with various project states

---

## Story Points Breakdown

- **Progress calculation hook:** 1 point
- **Dashboard component:** 1 point
- **Stage progress bars:** 0.5 points
- **Real-time updates:** 0.5 points
- **Total:** 3 points

**Rationale:** Primarily data aggregation and visualization. Real-time updates leverage existing WebSocket infrastructure.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
