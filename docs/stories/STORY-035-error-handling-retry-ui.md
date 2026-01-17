# STORY-035: Error Handling & Retry UI

**Epic:** Polish & Usability (EPIC-09)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **to see clear error messages and retry failed generations**
So that **I can recover from failures without losing work**

---

## Description

### Background
Generation jobs can fail due to API errors, network issues, or content policy violations. Users need clear feedback about what went wrong and easy ways to retry. Good error handling prevents frustration and helps users understand how to proceed.

### Scope
**In scope:**
- Error state display on scenes
- Clear error messages (not technical jargon)
- One-click retry for failed jobs
- Batch retry for multiple failures
- Error summary in dashboard
- Persistent error state until resolved

**Out of scope:**
- Auto-retry logic (backend handles this)
- Error analytics/logging dashboard
- Custom error message editing
- Error notification preferences

### User Flow
1. Generation job fails
2. Scene shows error indicator with message
3. User sees what failed and why
4. User clicks "Retry" to try again
5. If multiple failures, user can retry all at once
6. Error clears when job succeeds
7. If error persists, user can try different parameters

---

## Acceptance Criteria

- [ ] Failed jobs show error indicator on scene
- [ ] Error message is user-friendly (not raw API error)
- [ ] "Retry" button on each failed item
- [ ] Retry queues new job with same parameters
- [ ] Error state persists until success or manual clear
- [ ] "Retry All Failed" button for batch retry
- [ ] Error count shown in progress dashboard
- [ ] Different error types have appropriate messages
- [ ] Content policy errors suggest prompt changes
- [ ] Network errors suggest trying again later
- [ ] Tooltip shows full error details on hover

---

## Technical Notes

### Components
- **UI:** `src/components/Storyboard/ErrorIndicator.tsx`
- **UI:** `src/components/Storyboard/ErrorSummary.tsx`
- **Service:** `src/backend/services/errorService.ts`
- **Hook:** `src/hooks/useErrorHandling.ts`

### Error Message Mapping

```typescript
// errorMessages.ts
export const ERROR_MESSAGES: Record<string, string> = {
  // API Errors
  'RATE_LIMIT': 'Too many requests. Please wait a moment and try again.',
  'API_UNAVAILABLE': 'The AI service is temporarily unavailable. Please try again later.',
  'INVALID_API_KEY': 'API configuration error. Please contact support.',

  // Content Errors
  'CONTENT_POLICY': 'This prompt may violate content guidelines. Try adjusting the prompt.',
  'NSFW_DETECTED': 'Content moderation flagged this request. Please revise the prompt.',
  'PROMPT_TOO_LONG': 'The prompt is too long. Please shorten it and try again.',

  // Generation Errors
  'GENERATION_FAILED': 'Generation failed. Please try again.',
  'TIMEOUT': 'The request timed out. Please try again.',
  'INSUFFICIENT_CREDITS': 'Insufficient credits to complete this generation.',

  // File Errors
  'FILE_NOT_FOUND': 'Required file not found. Please regenerate the preceding asset.',
  'FILE_CORRUPTED': 'File is corrupted. Please regenerate.',
  'STORAGE_FULL': 'Storage is full. Please free up space and try again.',

  // Network Errors
  'NETWORK_ERROR': 'Network error. Please check your connection and try again.',
  'CONNECTION_REFUSED': 'Could not connect to the service. Please try again later.',

  // Default
  'UNKNOWN': 'An unexpected error occurred. Please try again.',
};

export function getUserFriendlyError(errorCode: string, rawMessage?: string): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES['UNKNOWN'];
}
```

### Error Indicator Component

```tsx
// ErrorIndicator.tsx
interface ErrorIndicatorProps {
  error: {
    code: string;
    message: string;
    jobType: 'audio' | 'image' | 'video';
    timestamp: string;
  };
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying: boolean;
}

function ErrorIndicator({ error, onRetry, onDismiss, isRetrying }: ErrorIndicatorProps) {
  const friendlyMessage = getUserFriendlyError(error.code, error.message);

  const jobTypeLabels = {
    audio: 'Audio generation',
    image: 'Image generation',
    video: 'Video generation',
  };

  return (
    <div className="error-indicator bg-red-50 border border-red-200 rounded-lg p-3">
      <div className="flex items-start gap-3">
        <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />

        <div className="flex-1">
          <div className="font-medium text-red-800">
            {jobTypeLabels[error.jobType]} failed
          </div>
          <p className="text-sm text-red-700 mt-1">
            {friendlyMessage}
          </p>

          {/* Show technical details on hover */}
          <details className="mt-2">
            <summary className="text-xs text-red-500 cursor-pointer hover:underline">
              Technical details
            </summary>
            <pre className="mt-1 text-xs bg-red-100 p-2 rounded overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </details>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded"
          >
            {isRetrying ? (
              <>
                <Spinner className="w-3 h-3 inline mr-1" />
                Retrying...
              </>
            ) : (
              'Retry'
            )}
          </button>
          <button
            onClick={onDismiss}
            className="p-1 text-red-400 hover:text-red-600"
            title="Dismiss error"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Scene Error State

```tsx
// SceneCard.tsx with error handling
function SceneCard({ sentence, projectId }: SceneCardProps) {
  const { errors, retryJob, dismissError, isRetrying } = useErrorHandling(projectId);
  const sentenceErrors = errors.filter(e => e.sentenceId === sentence.id);

  return (
    <div className="scene-card relative">
      {/* Scene content */}
      <div className="scene-content">
        {/* ... existing scene display */}
      </div>

      {/* Error indicators */}
      {sentenceErrors.length > 0 && (
        <div className="errors-panel mt-2 space-y-2">
          {sentenceErrors.map((error, idx) => (
            <ErrorIndicator
              key={`${error.jobType}-${idx}`}
              error={error}
              onRetry={() => retryJob(sentence, error.jobType)}
              onDismiss={() => dismissError(error.id)}
              isRetrying={isRetrying(error.id)}
            />
          ))}
        </div>
      )}

      {/* Error badge on card corner */}
      {sentenceErrors.length > 0 && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 rounded-full
                        flex items-center justify-center text-white text-xs">
          {sentenceErrors.length}
        </div>
      )}
    </div>
  );
}
```

### Error Handling Hook

```typescript
// useErrorHandling.ts
interface JobError {
  id: string;
  sentenceId: string;
  jobType: 'audio' | 'image' | 'video';
  code: string;
  message: string;
  timestamp: string;
}

function useErrorHandling(projectId: string) {
  const [errors, setErrors] = useState<JobError[]>([]);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const { lastEvent } = useWebSocket(projectId);

  // Collect errors from WebSocket events
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'job_failed') {
      const newError: JobError = {
        id: `${lastEvent.sentenceId}-${lastEvent.jobType}-${Date.now()}`,
        sentenceId: lastEvent.sentenceId,
        jobType: lastEvent.jobType,
        code: lastEvent.errorCode || 'UNKNOWN',
        message: lastEvent.error,
        timestamp: new Date().toISOString(),
      };

      setErrors(prev => [...prev, newError]);
    }

    // Clear error on success
    if (lastEvent.type === 'job_complete') {
      setErrors(prev =>
        prev.filter(e =>
          !(e.sentenceId === lastEvent.sentenceId && e.jobType === lastEvent.jobType)
        )
      );
    }
  }, [lastEvent]);

  const retryJob = async (sentence: Sentence, jobType: 'audio' | 'image' | 'video') => {
    const errorId = errors.find(e =>
      e.sentenceId === sentence.id && e.jobType === jobType
    )?.id;

    if (errorId) {
      setRetryingIds(prev => new Set(prev).add(errorId));
    }

    try {
      if (jobType === 'audio') {
        await fetch('/api/v1/audio/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            sentenceId: sentence.id,
            text: sentence.text,
          }),
        });
      } else if (jobType === 'image') {
        await fetch('/api/v1/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            sentenceId: sentence.id,
            imagePrompt: sentence.imagePrompt,
          }),
        });
      } else if (jobType === 'video') {
        await fetch('/api/v1/videos/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            sentenceId: sentence.id,
            imageFile: sentence.imageFile,
            cameraMovement: sentence.cameraMovement,
            motionStrength: sentence.motionStrength,
          }),
        });
      }
    } finally {
      if (errorId) {
        setRetryingIds(prev => {
          const next = new Set(prev);
          next.delete(errorId);
          return next;
        });
      }
    }
  };

  const dismissError = (errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  };

  const retryAllFailed = async (sentences: Sentence[]) => {
    const uniqueRetries = new Map<string, { sentence: Sentence; jobType: 'audio' | 'image' | 'video' }>();

    for (const error of errors) {
      const sentence = sentences.find(s => s.id === error.sentenceId);
      if (sentence) {
        const key = `${error.sentenceId}-${error.jobType}`;
        uniqueRetries.set(key, { sentence, jobType: error.jobType });
      }
    }

    for (const { sentence, jobType } of uniqueRetries.values()) {
      await retryJob(sentence, jobType);
    }

    toast.info(`Queued ${uniqueRetries.size} retries`);
  };

  return {
    errors,
    retryJob,
    dismissError,
    retryAllFailed,
    isRetrying: (errorId: string) => retryingIds.has(errorId),
    errorCount: errors.length,
  };
}
```

### Error Summary Component

```tsx
// ErrorSummary.tsx - for dashboard/toolbar
interface ErrorSummaryProps {
  errors: JobError[];
  sentences: Sentence[];
  onRetryAll: () => void;
  onDismissAll: () => void;
}

function ErrorSummary({ errors, sentences, onRetryAll, onDismissAll }: ErrorSummaryProps) {
  if (errors.length === 0) return null;

  const byType = {
    audio: errors.filter(e => e.jobType === 'audio').length,
    image: errors.filter(e => e.jobType === 'image').length,
    video: errors.filter(e => e.jobType === 'video').length,
  };

  return (
    <div className="error-summary bg-red-50 border-b border-red-200 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-red-700 font-medium">
            {errors.length} failed generation{errors.length > 1 ? 's' : ''}
          </span>
          <div className="text-sm text-red-600 flex gap-3">
            {byType.audio > 0 && <span>{byType.audio} audio</span>}
            {byType.image > 0 && <span>{byType.image} image</span>}
            {byType.video > 0 && <span>{byType.video} video</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRetryAll}
            className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded"
          >
            Retry All
          </button>
          <button
            onClick={onDismissAll}
            className="text-sm px-3 py-1 text-red-600 hover:text-red-800"
          >
            Dismiss All
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Content Policy Error Handling

```tsx
// ContentPolicyError.tsx - special handling for policy violations
function ContentPolicyError({ error, onEditPrompt }: ContentPolicyProps) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <ShieldExclamationIcon className="w-5 h-5 text-yellow-600" />
        <div>
          <h4 className="font-medium text-yellow-800">Content Policy Issue</h4>
          <p className="text-sm text-yellow-700 mt-1">
            The prompt may contain content that doesn't meet guidelines.
            Try adjusting the prompt to be more descriptive of the scene
            without potentially problematic elements.
          </p>
          <button
            onClick={onEditPrompt}
            className="mt-3 text-sm text-yellow-800 underline hover:no-underline"
          >
            Edit prompt
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-007: WebSocket Progress Server (error events)
- STORY-014: Audio Generation Job (retry mechanism)
- STORY-018: Image Generation Job (retry mechanism)
- STORY-020: Video Generation Job (retry mechanism)

**Blocked Stories:**
- None

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Error message mapping
  - [ ] Retry logic
  - [ ] Error state management
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Error messages reviewed for clarity
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of error scenarios

---

## Story Points Breakdown

- **Error message mapping:** 0.5 points
- **Error indicator component:** 1 point
- **Error handling hook:** 1 point
- **Batch retry & summary:** 0.5 points
- **Total:** 3 points

**Rationale:** Error handling is crucial for UX. Clear state management and user-friendly messages require careful implementation.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
