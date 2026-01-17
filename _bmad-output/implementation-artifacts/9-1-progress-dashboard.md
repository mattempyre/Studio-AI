# Story 9.1: Progress Dashboard

Status: ready-for-dev

## Story

As a **creator**,
I want **to see overall project generation progress**,
so that **I know how much work is complete and what's remaining**.

## Acceptance Criteria

1. Dashboard shows overall completion percentage
2. Breakdown by asset type: audio %, images %, videos %
3. Shows active jobs with progress bars
4. Shows failed jobs with retry option
5. Shows queued jobs waiting to start
6. Real-time updates via WebSocket
7. Estimated time remaining (based on average)
8. Pause/resume all generation option

## Tasks / Subtasks

- [ ] Task 1: Create ProgressDashboard component (AC: 1, 2)
  - [ ] 1.1: Create `components/Progress/ProgressDashboard.tsx`
  - [ ] 1.2: Calculate overall completion
  - [ ] 1.3: Calculate per-type completion

- [ ] Task 2: Create ActiveJobsList component (AC: 3, 6)
  - [ ] 2.1: Create `components/Progress/ActiveJobsList.tsx`
  - [ ] 2.2: Show running jobs with progress
  - [ ] 2.3: Update via WebSocket

- [ ] Task 3: Create FailedJobsList component (AC: 4)
  - [ ] 3.1: Create `components/Progress/FailedJobsList.tsx`
  - [ ] 3.2: List failed jobs with error messages
  - [ ] 3.3: Add retry button per job

- [ ] Task 4: Create QueuedJobsList component (AC: 5)
  - [ ] 4.1: Create `components/Progress/QueuedJobsList.tsx`
  - [ ] 4.2: Show queued jobs

- [ ] Task 5: Add time estimation (AC: 7)
  - [ ] 5.1: Track average job duration
  - [ ] 5.2: Calculate ETA for remaining

- [ ] Task 6: Add pause/resume (AC: 8)
  - [ ] 6.1: Add pause endpoint
  - [ ] 6.2: Add resume endpoint
  - [ ] 6.3: UI controls

- [ ] Task 7: Write tests
  - [ ] 7.1: Unit tests for progress calculation
  - [ ] 7.2: Unit tests for ETA calculation

## Dev Notes

### Progress Calculation
```
total = sentences.length * 3 (audio, image, video)
completed = sentences with audioFile + imageFile + videoFile
percentage = completed / total * 100
```

### Source Tree Components

**New Files:**
- `components/Progress/ProgressDashboard.tsx`
- `components/Progress/ActiveJobsList.tsx`
- `components/Progress/FailedJobsList.tsx`
- `components/Progress/QueuedJobsList.tsx`

**Modified Files:**
- `pages/Storyboard.tsx` - Add progress section

### References
- [Source: docs/stories/STORY-034-progress-dashboard.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#NFR-006]

## UX/UI Considerations

### User Flow & Mental Model
Picture Diego running a 200-sentence project overnight. He checks back in the morning and needs to instantly understand: "How far along am I? What's stuck? How much longer?" This dashboard is his mission control — a bird's eye view of the entire generation pipeline.

### Visual Hierarchy & Token Usage

**Dashboard Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Overall Progress                                    [⏸] [▶]   │
│  ████████████████████░░░░░░░░░░░░░░░░░░░  52%                  │
│  "104 of 200 assets complete • ~12 min remaining"              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ 🔊 Audio     │  │ 🖼 Images    │  │ 🎬 Videos    │         │
│  │ ████████ 80% │  │ █████░░ 60%  │  │ ██░░░░░ 15% │         │
│  │ 40/50 done   │  │ 30/50 done   │  │ 8/50 done   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
├─────────────────────────────────────────────────────────────────┤
│  Active Jobs (3)                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🖼 Image #24 "The hero stands..." ████████░░░░ 73%        │  │
│  │ 🔊 Audio #31 "Meanwhile..."       ███████████░░ 92%       │  │
│  │ 🎬 Video #18 "Wide shot of..."    ██░░░░░░░░░░░ 15%       │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Failed Jobs (2)                    [Retry All Failed]         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ⚠ Image #12 - GPU timeout         [Retry]                │  │
│  │ ⚠ Audio #45 - Voice model error   [Retry]                │  │
│  └──────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Queued (47 jobs waiting)                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Token Application:**
- Dashboard container: `bg-surface-1 rounded-xl border-border-subtle`
- Overall progress bar track: `bg-surface-3 h-3 rounded-full`
- Overall progress fill: `bg-primary` with `shadow-glow-sm`
- Time remaining text: `text-text-muted text-sm`

**Asset Type Cards:**
- Card background: `bg-surface-2 rounded-lg p-4`
- Audio icon: `text-accent-teal`
- Image icon: `text-accent-violet`
- Video icon: `text-accent-rose`
- Progress bar uses same icon color for fill

**Active Jobs List:**
- Container: `bg-surface-2 rounded-lg`
- Each job row: `border-b border-border-subtle last:border-0 p-3`
- Job type icon + name: `text-text-primary`
- Narration preview: `text-text-muted text-sm truncate`
- Progress bar: colored by job type

**Failed Jobs:**
- Container: `bg-error/5 border border-error/20 rounded-lg`
- Error icon: `text-error`
- Error message: `text-text-secondary text-sm`
- Retry button: `bg-surface-3 hover:bg-primary text-text-primary hover:text-text-inverse`
- "Retry All Failed" button: `bg-error hover:bg-error/80`

### Interaction Patterns

1. **Live Updates:** All progress values animate smoothly (CSS transitions) rather than jumping
2. **Pause/Resume:** Pause button changes to play icon when paused; shows "Paused" state
3. **Job Details on Click:** Clicking an active/failed job opens scene inspector for that sentence
4. **Sticky Header:** Overall progress section stays visible when scrolling through job lists

### ETA Calculation UX
- Show ETA only when confidence is reasonable (>10 jobs completed for sampling)
- Format: "~12 min remaining" or "~2 hours remaining"
- When paused: "Paused • ~12 min remaining when resumed"
- If ETA uncertain: "Calculating..." with spinner

### Accessibility Considerations
- Progress bars have `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Live region for active job count: `aria-live="polite"` updates screen readers
- Retry buttons have clear `aria-label="Retry image generation for scene 12"`

### Responsive Behavior
- **≥1024px:** Full dashboard layout as shown
- **768-1023px:** Asset type cards stack 2-across
- **<768px:** Single column, all sections stacked vertically

### Empty & Edge States
- **No jobs yet:** "Start generating to see progress here" with button to storyboard
- **All complete:** Celebratory state with confetti animation (subtle) and "All 200 assets ready!" message
- **All failed:** Warning state suggesting user check service connections

### Performance Considerations
- Throttle WebSocket updates to max 2/second for UI rendering
- Use React.memo on job list items to prevent unnecessary re-renders
- Batch state updates when multiple jobs complete simultaneously

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
