# Story 5.4: Video Generation UI

Status: coding_done

## Story

As a **creator**,
I want **UI controls to edit video prompts and generate videos individually or in bulk**,
so that **I can generate videos after reviewing images and have creative control over motion**.

## Acceptance Criteria

### Media Display Toggle (Sentence Cards) - NEW
1. Each sentence card displays tab pills below the media area
2. Two tabs: Image (🖼️) and Video (📹)
3. Image tab shown when imageFile exists
4. Video tab shown when videoFile exists OR video is generating
5. Clicking tab switches displayed content
6. Active tab has white/highlighted background
7. Inactive tab has transparent background with dimmed icon
8. Video tab shows spinner icon when video is generating
9. Default view: Show video if exists, otherwise show image
10. Works in both Table view and Grid view modes
11. Per-card tab respects global toggle override when set

### Global Media Toggle (Storyboard Header) - NEW
12. Toggle button group in header toolbar: "Show: Images | Videos"
13. Positioned near the Table/Grid view toggle for consistency
14. "Images" sets all cards to show images (overrides per-card state)
15. "Videos" sets all cards to show videos (overrides per-card state)
16. Toggle only affects cards that have the respective media available
17. Cards without video still show image even when "Videos" selected
18. Clicking per-card tab clears global override for that card only

### Video Prompt Editing (Scene Inspector)
19. Video prompt editable in scene inspector video tab
20. Prompt changes auto-save with debounce
21. Editing prompt sets `isVideoDirty: true` on sentence

### Individual Video Generation (Scene Inspector)
22. "Generate Video" button in Scene Inspector's video tab
23. Button disabled if selected sentence has no imageFile
24. Button disabled during active generation for that sentence
25. Click triggers `video/generate` Inngest event for single sentence (NOT Gemini API)
26. Loading spinner/progress shown during generation
27. Generated video preview updates immediately after completion
28. Error state shows with retry option
29. New video does NOT delete old video (preserve for future history feature)

### Bulk Video Generation (Storyboard Header)
30. "Generate All Videos" button visible in Storyboard header toolbar
31. Button only appears when project has at least one sentence with imageFile
32. Button positioned next to existing "Generate All Images" / "Re-Generate Images" button
33. Click triggers bulk video generation via `POST /api/v1/projects/:id/generate-videos`
34. Progress indicator shows during bulk generation: "Generating... (X/Y)"
35. Cancel button available during generation
36. Completion notification displayed (success or with failures)
37. Only queues videos for sentences that have:
    - imageFile exists (source image required)
    - videoPrompt exists (motion description required)
38. "Re-Generate Videos" option available when videos already exist

### WebSocket Integration
39. Real-time progress updates via existing WebSocket connection
40. Video completion events update UI immediately

## Tasks / Subtasks

- [x] Task 1: Create MediaToggle component for sentence cards (AC: 1-11)
  - [x] 1.1: Create `components/Storyboard/MediaToggle.tsx` component
  - [x] 1.2: Implement tab pills UI (Image 🖼️ / Video 📹) with styling
  - [x] 1.3: Add active/inactive/generating states for tabs
  - [x] 1.4: Add state management for activeMediaTab per scene
  - [x] 1.5: Integrate MediaToggle into Table view sentence cards (lines 448-464)
  - [x] 1.6: Integrate MediaToggle into Grid view sentence cards (lines 486-517)
  - [x] 1.7: Handle click to switch between image and video content
  - [x] 1.8: Show spinner on video tab during generation
  - [x] 1.9: Respect global toggle override when set

- [x] Task 2: Add global media toggle to header toolbar (AC: 12-18)
  - [x] 2.1: Add `globalMediaView: 'image' | 'video' | null` state to Storyboard
  - [x] 2.2: Create toggle button group UI near Table/Grid toggle
  - [x] 2.3: Style to match existing Table/Grid toggle pattern
  - [x] 2.4: Clicking global toggle sets all cards to that view
  - [x] 2.5: Per-card click clears global override for that card only
  - [x] 2.6: Cards without video fallback to image when "Videos" selected

- [x] Task 3: Add video prompt editing (AC: 19-21)
  - [x] 3.1: Video prompt textarea already exists in Storyboard.tsx video tab
  - [x] 3.2: Add debounced auto-save for videoPrompt field
  - [x] 3.3: Update sentence API to set isVideoDirty on videoPrompt change

- [x] Task 4: Fix individual video generation connection (AC: 22-29)
  - [x] 4.1: Remove `generateVideo` import from geminiService in Storyboard.tsx
  - [x] 4.2: Create `POST /api/v1/sentences/:id/generate-video` endpoint in images.ts
  - [x] 4.3: Update `handleGenerateVideo` to call backend API instead of Gemini
  - [x] 4.4: Add job polling for video completion (similar to image regeneration)
  - [x] 4.5: Add WebSocket listener for video completion events
  - [x] 4.6: Video file naming preserved (uses existing timestamp pattern from outputPaths.ts)

- [x] Task 5: Add bulk video generation button to toolbar (AC: 30-32, 38)
  - [x] 5.1: Add state for video generation in BulkGenerationToolbar
  - [x] 5.2: Add "Generate All Videos" button conditionally rendered when images exist
  - [x] 5.3: Add "Re-Generate Videos" variant when videos already exist
  - [x] 5.4: Position next to existing image generation buttons

- [x] Task 6: Implement bulk video generation logic (AC: 33-37)
  - [x] 6.1: Add `generateAllVideos` function to useSceneGeneration hook
  - [x] 6.2: Call `POST /api/v1/projects/:id/generate-videos` endpoint
  - [x] 6.3: Track video generation progress separately from images
  - [x] 6.4: Implement cancel functionality (uses existing cancelAll)
  - [x] 6.5: Display completion notification

- [x] Task 7: Add video-specific stats to hook (AC: 31, 37)
  - [x] 7.1: Add `videoEligibleCount` to sceneStats (sentences with imageFile + videoPrompt)
  - [x] 7.2: Add `existingVideoCount` to sceneStats
  - [x] 7.3: Update `hasExistingVideos` computed value

- [x] Task 8: Write tests
  - [x] 8.1: Unit tests for MediaToggle component (12 tests)
  - [x] 8.2: Unit tests for generateAllVideos function
  - [x] 8.3: Unit tests for video-specific computed values
  - [x] 8.4: Unit tests for bulk video button visibility logic
  - [x] 8.5: All 29 tests passing

## Dev Notes

### UX Design: Media Toggle Component

Tab pills positioned **below** the media area (not overlaid) for clear separation:

```
┌─────────────────────────────────────────┐
│                                         │
│    [Image content or Video content]     │
│                                         │
└─────────────────────────────────────────┘
┌───────────────┐
│  🖼️  │  📹   │  ← Tabs below media
└───────────────┘
```

**Why below instead of overlay:**
- No content obscured - full image/video visible
- More discoverable - traditional tab placement
- Better accessibility - easier to click
- Cleaner visual separation between content and controls

**Tab Pill Styling (Tailwind):**
```tsx
{/* Container - flex row below media */}
<div className="flex items-center gap-1 mt-2">
  {/* Image tab */}
  <button className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
    activeTab === 'image'
      ? 'bg-white/20 text-white'
      : 'text-white/50 hover:text-white/70'
  }`}>
    <ImageIcon size={12} />
    <span>Image</span>
  </button>

  {/* Video tab */}
  <button className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
    activeTab === 'video'
      ? 'bg-white/20 text-white'
      : 'text-white/50 hover:text-white/70'
  }`}>
    {isGenerating ? <Spinner size={12} /> : <VideoIcon size={12} />}
    <span>Video</span>
  </button>
</div>
```

### UX Design: Global Media Toggle

Toggle in the header toolbar (near Table/Grid toggle) to switch all cards at once:

```
┌──────────────────────────────────────────────────────────────┐
│  Storyboard Flow    [TABLE][GRID]     [🖼️ Images][📹 Videos] │
└──────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Clicking "Images" → All cards show images
- Clicking "Videos" → All cards show videos (fallback to image if no video)
- Clicking per-card tab → Clears global override for that card only
- Neither selected → Per-card state controls each card independently

**Global Toggle Styling (Tailwind):**
```tsx
<div className="flex items-center bg-[#1e1933] rounded-lg p-1 border border-white/5">
  <button className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 ${
    globalView === 'image' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'
  }`}>
    <ImageIcon size={12} /> Images
  </button>
  <button className={`px-3 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 ${
    globalView === 'video' ? 'bg-primary text-white' : 'text-text-muted hover:text-white'
  }`}>
    <VideoIcon size={12} /> Videos
  </button>
</div>
```

**State Management:**
- `globalMediaView: 'image' | 'video' | null` - Global override (null = no override)
- `perCardOverrides: Set<string>` - Scene IDs that ignore global toggle
- Track `activeMediaTab: Map<string, 'image' | 'video'>` for per-scene state
- Default: Show 'video' tab if videoFile exists, otherwise 'image'
- When video generation starts: Auto-switch to 'video' tab
- When video completes: Stay on 'video' tab

### Architecture Patterns
- Video generation requires images to exist first (workflow: images -> review -> videos)
- Uses same WebSocket broadcast pattern as image generation
- Bulk endpoint already exists: `POST /api/v1/projects/:id/generate-videos`
- Individual generation queues `video/generate` Inngest event
- **Video History**: Old videos are NOT deleted - use timestamped filenames to preserve generations for future history feature

### Video File Naming for History
Instead of overwriting `{sentenceId}.mp4`, use timestamped names:
```
{sentenceId}_{timestamp}.mp4
```
The `videoFile` field on sentence points to the latest generation.

### Current Bug to Fix

The `handleGenerateVideo` function in `Storyboard.tsx` (lines 197-215) incorrectly calls:
```typescript
import { generateVideo } from '../services/geminiService';
// ...
const videoUrl = await generateVideo(prompt);
```

This should call the backend API endpoint which queues an Inngest event:
```typescript
const response = await fetch(`${API_BASE}/api/v1/sentences/${sceneId}/generate-video`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt }),
});
```

### Existing Backend Support

The following already exists from Story 5-1:
- `POST /api/v1/projects/:id/generate-videos` - Bulk endpoint (in projects.ts)
- `video/generate` Inngest event type
- `generateVideoFunction` Inngest handler
- WebSocket broadcasting via jobService

### Existing UI Elements

The video tab in Scene Inspector already has:
- Video prompt textarea (lines 670-678 in Storyboard.tsx)
- Camera movement dropdown (lines 682-699)
- Motion strength slider (lines 701-704)
- Generate Video button (lines 706-713)

These just need to be wired to the backend properly.

### Source Tree Components

**New Files:**
- `components/Storyboard/MediaToggle.tsx` - Tab pills component for switching image/video in sentence cards

**Modified Files:**
- `components/Storyboard.tsx` - Integrate MediaToggle, fix handleGenerateVideo, add debounced auto-save, manage activeMediaTab state
- `components/Storyboard/BulkGenerationToolbar.tsx` - Add video generation buttons
- `hooks/useSceneGeneration.ts` - Add video generation functions and stats
- `src/backend/api/sentences.ts` - Add individual video generation endpoint, dirty flag on prompt change
- `src/backend/services/outputPaths.ts` - Update video path to include timestamp

### References
- [Source: components/Storyboard.tsx:197-215] - Current incorrect Gemini connection
- [Source: components/Storyboard.tsx:448-464] - Table view media area (needs MediaToggle integration)
- [Source: components/Storyboard.tsx:486-517] - Grid view media area (needs MediaToggle integration)
- [Source: components/Storyboard.tsx:663-720] - Existing video tab UI in Scene Inspector
- [Source: components/Storyboard/BulkGenerationToolbar.tsx] - Pattern for bulk generation UI
- [Source: src/backend/api/projects.ts] - Bulk video generation endpoint
- [Source: src/backend/inngest/functions/generateVideo.ts] - Video generation Inngest function
- [Source: _bmad-output/implementation-artifacts/5-1-video-generation-job.md] - Backend implementation

### Dependencies
- Story 5-1: Video Generation Job (backend Inngest function) - COMPLETED

### Supersedes
- Story 5-3: Video Regeneration & Override (merged into this story)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
- All 29 unit tests passing (MediaToggle: 12, useSceneGeneration: 17)
- TypeScript compilation successful for new code

### Completion Notes List
1. Created MediaToggle component with tab pills UI for switching between image/video content
2. Added global media toggle (IMAGES/VIDEOS) to header toolbar next to TABLE/GRID toggle
3. Implemented debounced auto-save for video prompt with 500ms delay
4. Fixed individual video generation to use backend API instead of Gemini client
5. Added `POST /api/v1/sentences/:id/generate-video` endpoint for single sentence video generation
6. Added `GET /api/v1/sentences/:id/video-status` endpoint for polling
7. Created VideoRegenerateModal for confirming bulk video regeneration
8. Added `generateAllVideos` function to useSceneGeneration hook
9. Added video-specific stats: `videoEligibleCount`, `existingVideoCount`, `hasExistingVideos`, `canGenerateVideos`
10. Updated scene-stats endpoint to include video-specific stats

### File List

**New Files:**
- `components/Storyboard/MediaToggle.tsx` - Tab pills component for image/video toggle
- `components/Storyboard/VideoRegenerateModal.tsx` - Modal for confirming bulk video regeneration
- `tests/components/Storyboard/MediaToggle.test.tsx` - Unit tests for MediaToggle (12 tests)

**Modified Files:**
- `components/Storyboard.tsx` - Integrated MediaToggle, global toggle, debounced auto-save, updated handleGenerateVideo
- `components/Storyboard/BulkGenerationToolbar.tsx` - Added "Generate All Videos" / "Re-Generate Videos" buttons
- `hooks/useSceneGeneration.ts` - Added generateAllVideos, video stats, video-specific computed values
- `src/backend/api/images.ts` - Added generate-video and video-status endpoints
- `src/backend/api/projects.ts` - Added videoEligibleCount and existingVideoCount to scene-stats
- `tests/unit/useSceneGeneration.test.ts` - Added video generation tests (6 new tests)
