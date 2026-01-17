# Story 9.2: Error Handling & Retry UI

Status: ready-for-dev

## Story

As a **creator**,
I want **clear error messages and easy retry options**,
so that **I can recover from failures without losing work**.

## Acceptance Criteria

1. Failed jobs show error message in UI
2. Error messages are human-readable
3. Retry button per failed job
4. "Retry All Failed" batch option
5. Toast notifications for failures
6. Error log viewable per sentence
7. Error count badge in navigation
8. Auto-retry option with configurable limit

## Tasks / Subtasks

- [ ] Task 1: Add error display to job list (AC: 1, 2)
  - [ ] 1.1: Show error message in job card
  - [ ] 1.2: Parse technical errors to human-readable

- [ ] Task 2: Add retry functionality (AC: 3, 4)
  - [ ] 2.1: Add retry button per job
  - [ ] 2.2: Add "Retry All Failed" button
  - [ ] 2.3: Implement retry API endpoint

- [ ] Task 3: Add toast notifications (AC: 5)
  - [ ] 3.1: Toast on job failure
  - [ ] 3.2: Include job type and sentence info

- [ ] Task 4: Add error log (AC: 6)
  - [ ] 4.1: Create ErrorLog component
  - [ ] 4.2: Show in sentence inspector
  - [ ] 4.3: List all errors for sentence

- [ ] Task 5: Add error count badge (AC: 7)
  - [ ] 5.1: Count failed jobs
  - [ ] 5.2: Show badge in nav/toolbar

- [ ] Task 6: Add auto-retry option (AC: 8)
  - [ ] 6.1: Add auto-retry setting
  - [ ] 6.2: Configure max retry count
  - [ ] 6.3: Implement in Inngest functions

- [ ] Task 7: Write tests
  - [ ] 7.1: Unit tests for error parsing
  - [ ] 7.2: Unit tests for retry logic

## Dev Notes

### Error Message Mapping
```typescript
const errorMessages = {
  'ECONNREFUSED': 'Cannot connect to generation service',
  'TIMEOUT': 'Generation timed out - try again',
  'OUT_OF_MEMORY': 'GPU memory exhausted - reduce concurrent jobs',
  'INVALID_WORKFLOW': 'Workflow configuration error',
  'DEFAULT': 'Generation failed - please retry',
};
```

### Source Tree Components

**New Files:**
- `components/Error/ErrorLog.tsx`
- `components/Error/ErrorBadge.tsx`

**Modified Files:**
- `components/Progress/FailedJobsList.tsx` - Add retry buttons
- `hooks/useWebSocket.ts` - Add error handling

### References
- [Source: docs/stories/STORY-035-error-handling-retry-ui.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#NFR-004]

## UX/UI Considerations

### User Flow & Mental Model
Errors are inevitable in a GPU-dependent pipeline. The user's emotional journey goes: confusion → frustration → hope (if recovery is easy). Our job is to skip the frustration phase entirely by making errors feel *expected and recoverable* rather than *surprising and scary*.

### Design Philosophy: Errors as Conversations
Instead of cold technical messages, frame errors as helpful hints:
- ❌ `ECONNREFUSED 127.0.0.1:8188`
- ✅ "Can't reach ComfyUI — is it running?"

### Visual Hierarchy & Token Usage

**Error Toast Notification:**
```
┌────────────────────────────────────────────┐
│ ⚠️ Image generation failed                 │  ← bg-error/10 border-error
│ Scene #12: "The hero stands alone..."      │
│ Can't reach ComfyUI — is it running?       │
│                         [Retry] [Dismiss]  │
└────────────────────────────────────────────┘
```

- Container: `bg-error/10 border border-error/30 rounded-lg p-4`
- Icon: `text-error` warning triangle
- Title: `text-text-primary font-semibold`
- Scene reference: `text-text-secondary text-sm`
- Error message: `text-text-muted text-sm`
- Retry button: `bg-error text-text-inverse hover:bg-error/80`
- Dismiss: `text-text-muted hover:text-text-primary`

**Error Badge in Navigation:**
- Position: On storyboard nav item or in header
- Style: `bg-error text-text-inverse text-[10px] font-bold rounded-full min-w-[18px] h-[18px]`
- Animate: Pulse once when new error arrives (`animate-pulse` then stops)
- Count: Show number (e.g., "3"); if >9, show "9+"

**Error Log Panel (in Scene Inspector):**
```
┌─────────────────────────────────────────┐
│ Error History for Scene #12             │
├─────────────────────────────────────────┤
│ Jan 18, 10:32 AM                        │
│ Image Generation Failed                 │
│ "Connection refused to ComfyUI"         │
│ Attempt 2 of 3 • [View Details]         │
├─────────────────────────────────────────┤
│ Jan 18, 10:30 AM                        │
│ Image Generation Failed                 │
│ "GPU out of memory"                     │
│ Attempt 1 of 3                          │
└─────────────────────────────────────────┘
```

- Log container: `bg-surface-2 rounded-lg max-h-48 overflow-y-auto`
- Each entry: `border-b border-border-subtle p-3`
- Timestamp: `text-text-muted text-[10px]`
- Error type: `text-error font-medium`
- Technical details toggle: "View Details" expands to show stack trace in `font-mono text-[11px] bg-surface-0 p-2 rounded`

### Error Message Mapping (Human-Readable)

| Code | User-Friendly Message | Suggested Action |
|------|----------------------|------------------|
| `ECONNREFUSED` | "Can't reach [service] — is it running?" | Check Docker/service |
| `TIMEOUT` | "Generation took too long — try again" | Retry |
| `OUT_OF_MEMORY` | "GPU memory full — try fewer jobs at once" | Reduce concurrency |
| `INVALID_WORKFLOW` | "Something's wrong with the workflow setup" | Check config |
| `RATE_LIMITED` | "Too many requests — waiting before retry" | Auto-retry w/ backoff |
| `DEFAULT` | "Something went wrong — let's try again" | Retry |

### Auto-Retry UX

**Settings Toggle:**
- Location: Settings panel or project settings
- Label: "Auto-retry failed jobs"
- Control: Toggle with configurable max attempts (dropdown: 1, 2, 3, 5)
- Default: On with 3 attempts

**Visual Indication During Auto-Retry:**
- Show "Attempt 2 of 3..." below job in active list
- Progress resets but keeps attempt counter visible
- If all attempts fail, move to failed list with "All 3 attempts failed"

### Interaction Patterns

1. **Retry Single Job:** Click retry button, job moves from failed → queued → active
2. **Retry All Failed:** Batch button queues all failed jobs; show confirmation if >10 jobs
3. **Toast Stacking:** Max 3 toasts visible; older ones collapse into "+2 more errors" summary
4. **Error Badge Click:** Navigate to Progress Dashboard filtered to failed jobs

### Accessibility Considerations
- Toast notifications use `role="alert"` for screen reader announcement
- Error badge has `aria-label="3 failed jobs"`
- Retry buttons have descriptive labels: `aria-label="Retry audio generation for scene 12"`
- Error log entries are navigable by keyboard

### Responsive Behavior
- **Toast position:** Desktop = top-right, Mobile = bottom-center (thumb-reachable)
- **Error badge:** Always visible in nav regardless of viewport

### Emotional Design Touches
- Use `text-warning` instead of `text-error` for recoverable issues (like rate limiting)
- After successful retry, briefly flash `bg-success/10` on the job row
- "All caught up!" message when last error is resolved

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
