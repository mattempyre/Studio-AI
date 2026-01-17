# STORY-029: Export UI & Download

**Epic:** Export System (EPIC-07)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **an export button that downloads my project assets as a zip file**
So that **I can easily get all my generated content for editing**

---

## Description

### Background
The export service creates zip files, but users need a UI to trigger exports and download results. The UI should show export progress, handle completion, and initiate browser download.

### Scope
**In scope:**
- Export button in project header
- Progress indicator during export
- Automatic download of zip file
- Success notification with folder structure info
- Error handling with retry option

**Out of scope:**
- Export options/configuration
- Selective export
- Export history
- Cloud storage upload

### User Flow
1. User clicks "Export" button in project header
2. Confirmation dialog shows what will be exported
3. User confirms export
4. Progress bar shows export progress
5. On completion, browser downloads zip automatically
6. Success toast shows with folder info
7. If error, user sees error message with retry option

---

## Acceptance Criteria

- [ ] Export button visible in project header
- [ ] Button shows export icon
- [ ] Click opens confirmation dialog
- [ ] Dialog shows: project name, asset counts, estimated size
- [ ] "Export" button in dialog starts export
- [ ] Button changes to progress indicator during export
- [ ] Progress shows percentage
- [ ] On completion, browser download initiated automatically
- [ ] Success toast: "Export complete! Check your downloads folder."
- [ ] Toast includes folder structure hint
- [ ] Error toast shows message with "Retry" button
- [ ] Button returns to normal state after download

---

## Technical Notes

### Components
- **Button:** `src/components/Project/ExportButton.tsx`
- **Dialog:** `src/components/Project/ExportDialog.tsx`
- **Progress:** `src/components/Project/ExportProgress.tsx`

### Export Button

```tsx
// ExportButton.tsx
function ExportButton({ projectId }: { projectId: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const { isExporting, progress, startExport } = useExport(projectId);

  if (isExporting) {
    return <ExportProgress progress={progress} />;
  }

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="btn-secondary flex items-center gap-2"
      >
        <DownloadIcon className="w-4 h-4" />
        Export
      </button>

      {showDialog && (
        <ExportDialog
          projectId={projectId}
          onConfirm={() => {
            setShowDialog(false);
            startExport();
          }}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </>
  );
}
```

### Export Dialog

```tsx
// ExportDialog.tsx
function ExportDialog({ projectId, onConfirm, onCancel }: DialogProps) {
  const { data } = useStoryboard(projectId);

  const stats = useMemo(() => {
    if (!data) return null;

    const sentences = data.scenes;
    return {
      audioCount: sentences.filter(s => s.audioFile).length,
      imageCount: sentences.filter(s => s.imageFile).length,
      videoCount: sentences.filter(s => s.videoFile).length,
      total: sentences.length,
      missingAudio: sentences.filter(s => !s.audioFile).length,
    };
  }, [data]);

  if (!stats) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-bold mb-4">Export Project</h2>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span>Audio files:</span>
            <span>{stats.audioCount} / {stats.total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Image files:</span>
            <span>{stats.imageCount} / {stats.total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Video files:</span>
            <span>{stats.videoCount} / {stats.total}</span>
          </div>
        </div>

        {stats.missingAudio > 0 && (
          <div className="bg-yellow-50 text-yellow-700 p-3 rounded text-sm mb-4">
            <WarningIcon className="w-4 h-4 inline mr-2" />
            {stats.missingAudio} sentences are missing audio
          </div>
        )}

        <p className="text-sm text-gray-600 mb-4">
          Export will create a zip file with organized folders for audio, images, and videos.
        </p>

        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-primary">
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Export Progress

```tsx
// ExportProgress.tsx
function ExportProgress({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2">
      <Spinner className="w-4 h-4" />
      <span className="text-sm">Exporting... {progress}%</span>
    </div>
  );
}
```

### Export Hook

```typescript
// useExport.ts
function useExport(projectId: string) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const { lastEvent } = useWebSocket(projectId);

  // Handle WebSocket updates
  useEffect(() => {
    if (!lastEvent || !isExporting) return;

    if (lastEvent.jobId === jobId) {
      if (lastEvent.type === 'progress') {
        setProgress(lastEvent.progress);
      }

      if (lastEvent.type === 'job_complete') {
        // Trigger download
        const downloadUrl = lastEvent.result.downloadUrl;
        triggerDownload(downloadUrl);

        setIsExporting(false);
        setProgress(0);
        setJobId(null);

        toast.success(
          <div>
            <strong>Export complete!</strong>
            <p className="text-sm">Check your downloads folder.</p>
            <p className="text-xs text-gray-500 mt-1">
              Folders: audio/, images/, videos/
            </p>
          </div>
        );
      }

      if (lastEvent.type === 'job_failed') {
        setIsExporting(false);
        setProgress(0);
        setJobId(null);

        toast.error(
          <div>
            <strong>Export failed</strong>
            <p className="text-sm">{lastEvent.error}</p>
            <button
              onClick={() => startExport()}
              className="text-sm underline mt-2"
            >
              Retry
            </button>
          </div>
        );
      }
    }
  }, [lastEvent, jobId, isExporting]);

  const startExport = async () => {
    setIsExporting(true);
    setProgress(0);

    const response = await fetch(`/api/v1/projects/${projectId}/export`, {
      method: 'POST',
    });

    const data = await response.json();
    setJobId(data.jobId);
  };

  return { isExporting, progress, startExport };
}

function triggerDownload(url: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = '';  // Browser will use Content-Disposition filename
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
```

### Integration in Project Header

```tsx
// ProjectHeader.tsx
function ProjectHeader({ project }: { project: Project }) {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div>
        <h1 className="text-xl font-bold">{project.name}</h1>
        <span className="text-sm text-gray-500">{project.topic}</span>
      </div>

      <div className="flex items-center gap-3">
        <ExportButton projectId={project.id} />
        {/* Other actions */}
      </div>
    </header>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-028: Export Service (backend export)
- STORY-007: WebSocket Progress Server (progress updates)

**Blocked Stories:**
- None

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Dialog rendering
  - [ ] Progress state
  - [ ] Download trigger
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of full export flow

---

## Story Points Breakdown

- **Export button & dialog:** 1 point
- **Progress indicator:** 0.5 points
- **Download trigger & toast:** 1 point
- **Error handling:** 0.5 points
- **Total:** 3 points

**Rationale:** UI components leveraging existing export backend. Download trigger is standard browser API.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
