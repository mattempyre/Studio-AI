# Story 7.2: Export UI & Download

Status: ready-for-dev

## Story

As a **creator**,
I want **a UI to trigger exports and download the results**,
so that **I can get my assets for video editing**.

## Acceptance Criteria

1. "Export" button in storyboard toolbar
2. Export dialog with options (folder vs ZIP)
3. Progress indicator during export
4. Download link when export complete
5. Export history showing recent exports
6. Delete old exports option
7. Toast notification on completion
8. Error handling with retry option

## Tasks / Subtasks

- [ ] Task 1: Create ExportDialog component (AC: 2)
  - [ ] 1.1: Create `components/Export/ExportDialog.tsx`
  - [ ] 1.2: Add export format options
  - [ ] 1.3: Add export name input

- [ ] Task 2: Create ExportProgress component (AC: 3, 4)
  - [ ] 2.1: Create `components/Export/ExportProgress.tsx`
  - [ ] 2.2: Show progress bar
  - [ ] 2.3: Show download link on complete

- [ ] Task 3: Create ExportHistory component (AC: 5, 6)
  - [ ] 3.1: Create `components/Export/ExportHistory.tsx`
  - [ ] 3.2: List recent exports
  - [ ] 3.3: Add delete button per export

- [ ] Task 4: Add to storyboard (AC: 1)
  - [ ] 4.1: Add Export button to toolbar
  - [ ] 4.2: Open dialog on click

- [ ] Task 5: Add download endpoint
  - [ ] 5.1: Add `GET /api/v1/exports/:id/download`
  - [ ] 5.2: Stream file response

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for dialog
  - [ ] 6.2: Unit tests for progress
  - [ ] 6.3: Integration tests for download

## Dev Notes

### Architecture Patterns
- Dialog opens from toolbar
- WebSocket events update progress
- Download via streaming response

### Source Tree Components

**New Files:**
- `components/Export/ExportDialog.tsx`
- `components/Export/ExportProgress.tsx`
- `components/Export/ExportHistory.tsx`

**Modified Files:**
- `pages/Storyboard.tsx` - Add export button
- `src/backend/api/exports.ts` - Add download endpoint

### References
- [Source: docs/stories/STORY-029-export-ui-download.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-702]

## UX/UI Considerations

### User Flow & Mental Model
This is the creator's "finish line" — they've generated all their assets and now want to take them into their video editor (DaVinci, Premiere, Final Cut). Export should feel like gift-wrapping: choose your format, give it a name, and receive a neat package. No ambiguity about what's included or where it goes.

### Visual Hierarchy & Token Usage

**Export Button (Toolbar):**
- Position: Right side of storyboard toolbar, prominent but not primary
- Style: `bg-surface-2 hover:bg-surface-3 border-border-color text-text-primary px-4 py-2 rounded-lg`
- Icon: Download/export icon + "Export" label
- Disabled state (if incomplete): `opacity-50 cursor-not-allowed` with tooltip "Generate all assets to export"

**Export Dialog:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Export Project                                           [✕]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                │
│ Export Name                                                    │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Brand-Video-2024-Export                                   │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                │
│ Format                                                         │
│ ┌─────────────────────┐  ┌─────────────────────┐             │
│ │  📦 ZIP Archive     │  │  📁 Folder          │             │
│ │  (Recommended)      │  │  Local directory    │             │
│ │  ● Selected         │  │                     │             │
│ └─────────────────────┘  └─────────────────────┘             │
│                                                                │
│ Include                                                        │
│ ☑ Audio files (.wav)           50 files • 245 MB             │
│ ☑ Images (.png)                50 files • 180 MB             │
│ ☑ Videos (.mp4)                50 files • 1.2 GB             │
│ ☑ Metadata (project.json)      1 file                        │
│ ─────────────────────────────────────────────                │
│ Total: 151 files • ~1.6 GB                                   │
│                                                                │
│                              [Cancel]  [Start Export]          │
└─────────────────────────────────────────────────────────────────┘
```

**Token Application:**

**Dialog Container:**
- Backdrop: `bg-surface-0/80 backdrop-blur-sm`
- Modal: `bg-surface-2 border-border-color rounded-xl shadow-2xl max-w-lg w-full`
- Header: `text-text-primary text-lg font-semibold border-b border-border-subtle pb-4`

**Export Name Input:**
- Style: `bg-surface-1 border-border-color rounded-lg px-3 py-2 w-full`
- Focus: `border-primary ring-1 ring-primary/20`

**Format Selection Cards:**
- Unselected: `bg-surface-1 border-border-subtle rounded-lg p-4 cursor-pointer hover:border-border-color`
- Selected: `bg-primary/10 border-primary ring-2 ring-primary rounded-lg p-4`
- Icon: `text-text-primary text-2xl mb-2`
- Title: `text-text-primary font-medium`
- Subtitle: `text-text-muted text-sm`

**Include Checkboxes:**
- Checkbox: `accent-primary w-4 h-4`
- Label: `text-text-primary`
- File count/size: `text-text-muted text-sm ml-auto`

**Summary:**
- Total line: `text-text-primary font-semibold border-t border-border-subtle pt-3 mt-3`

**Action Buttons:**
- Cancel: `bg-surface-3 hover:bg-surface-4 text-text-primary px-4 py-2 rounded-lg`
- Start Export: `bg-primary hover:bg-primary-hover text-text-inverse font-medium px-6 py-2 rounded-lg`

### Export Progress View

```
┌─────────────────────────────────────────────────────────────────┐
│ Exporting...                                             [✕]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                │
│ Brand-Video-2024-Export.zip                                    │
│                                                                │
│ ████████████████████████████████░░░░░░░░░░░░░  72%            │
│                                                                │
│ Packaging videos... (36/50)                                    │
│                                                                │
│ Stage Progress:                                                │
│ ✓ Audio files                  50/50                          │
│ ✓ Images                       50/50                          │
│ ◐ Videos                       36/50                          │
│ ○ Metadata                     0/1                            │
│                                                                │
│                              [Cancel Export]                   │
└─────────────────────────────────────────────────────────────────┘
```

**Progress Tokens:**
- Main progress bar: `bg-primary h-3 rounded-full` on `bg-surface-3` track
- Stage complete (✓): `text-success`
- Stage in progress (◐): `text-info animate-pulse`
- Stage pending (○): `text-text-muted`
- Current action: `text-text-secondary text-sm`

### Export Complete View

```
┌─────────────────────────────────────────────────────────────────┐
│ Export Complete! ✓                                       [✕]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                │
│      [Download icon - large, animated bounce]                  │
│                                                                │
│ Brand-Video-2024-Export.zip                                    │
│ 151 files • 1.58 GB                                           │
│                                                                │
│            [⬇ Download ZIP]                                   │
│                                                                │
│ Link expires in 24 hours                                       │
│                                                                │
│                              [Done]  [Export Another]         │
└─────────────────────────────────────────────────────────────────┘
```

**Download Button:**
- Style: `bg-success hover:bg-success/80 text-text-inverse font-semibold px-8 py-3 rounded-lg text-lg`
- Icon: Download arrow with subtle animation on hover

### Export History Panel

```
┌─────────────────────────────────────────────────────────────────┐
│ Recent Exports                                                 │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Brand-Video-2024-Export.zip         [⬇]  [🗑]           │  │
│ │ Today, 2:30 PM • 1.58 GB • Expires in 23h              │  │
│ └───────────────────────────────────────────────────────────┘  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Brand-Video-Draft.zip               [Expired]           │  │
│ │ Yesterday • 1.2 GB                                      │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**History Item Tokens:**
- Container: `bg-surface-1 border-border-subtle rounded-lg p-3`
- Name: `text-text-primary font-medium`
- Metadata: `text-text-muted text-sm`
- Download button: `text-primary hover:text-primary-hover`
- Delete button: `text-text-muted hover:text-error`
- Expired badge: `text-warning bg-warning/10 text-[10px] px-2 py-0.5 rounded`

### Interaction Patterns

1. **Validation Before Export:** If assets are incomplete, show confirmation: "15 images missing. Export anyway?"
2. **Background Export:** User can close dialog; toast shows progress, another toast on completion with download link
3. **Download Trigger:** Clicking download starts browser download immediately
4. **Cancel Export:** Confirmation modal: "Cancel export? Progress will be lost."
5. **History Cleanup:** Delete removes from list and server; auto-cleanup after 7 days

### Toast Notifications

**Export Started:**
- `bg-info/10 border-info/20`: "Export started. You can continue working."

**Export Complete:**
- `bg-success/10 border-success/20`: "Export ready! [Download]" with inline download button

**Export Failed:**
- `bg-error/10 border-error/20`: "Export failed. [Retry]"

### Accessibility Considerations
- Dialog traps focus and is dismissible with Escape
- Progress bar has `role="progressbar"` with `aria-valuenow`
- Download link has clear `aria-label`: "Download Brand-Video-2024-Export.zip, 1.58 gigabytes"
- Checkboxes have associated labels
- Stage icons have `sr-only` text equivalents

### Responsive Behavior
- **Desktop:** Dialog centered, 480px width
- **Mobile:** Dialog expands to full width with bottom-sheet style
- Format cards stack vertically on narrow screens

### Edge Cases
- **Massive export (>5GB):** Warning about download time; suggest folder export
- **Browser download blocked:** Detect and show fallback "Copy link" button
- **Export while generating:** Warn that some assets may be incomplete
- **Network interruption:** Resume-capable export if possible; otherwise show retry

### Performance Considerations
- Export runs server-side with progress pushed via WebSocket
- Large ZIPs streamed rather than held in memory
- History limited to last 10 exports to avoid DB bloat

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
