# Story 4.3: Prompt Display in Storyboard

Status: done

## Story

As a **creator**,
I want **to see image and video prompts displayed below each sentence in the Storyboard**,
so that **I can review what will be generated before triggering bulk generation**.

## Acceptance Criteria

1. Each sentence row in Storyboard shows its image prompt below the narration text
2. Video/motion prompt displayed alongside or below image prompt (if exists)
3. Prompts are visually distinct from narration (muted color, smaller text, icon prefix)
4. Empty prompts show placeholder text "No prompt generated"
5. Prompts are read-only in this story (editing comes in 4-5)
6. Camera movement setting visible with prompt
7. Table view and Grid view both show prompts
8. Prompt text truncates with ellipsis if too long, expandable on click/hover

## Tasks / Subtasks

- [x] Task 1: Update Storyboard table row component (AC: 1, 2, 3, 4)
  - [x] 1.1: Add prompt display section below narration in table rows
  - [x] 1.2: Style with muted text and image/video icons
  - [x] 1.3: Handle empty prompt state with placeholder

- [x] Task 2: Update Storyboard grid card component (AC: 1, 2, 7)
  - [x] 2.1: Add prompt display to grid card layout
  - [x] 2.2: Ensure responsive layout for prompts

- [x] Task 3: Add camera movement indicator (AC: 6)
  - [x] 3.1: Display camera movement type with icon
  - [ ] 3.2: Show motion strength indicator if applicable *(Blocked: Scene type lacks motionStrength field - requires data model update)*

- [x] Task 4: Add truncation and expansion (AC: 8)
  - [x] 4.1: Implement text truncation for long prompts
  - [x] 4.2: Add expand/collapse toggle or hover tooltip

- [x] Task 5: Write tests
  - [x] 5.1: Unit tests for prompt display component
  - [x] 5.2: Test empty state rendering
  - [x] 5.3: Test truncation behavior

## Dev Notes

### Architecture Patterns
- Read-only display - no state mutation in this story
- Data already available from backend via `sentence.imagePrompt` and `sentence.videoPrompt`
- Storyboard already receives transformed data from `StoryboardPage` in routes.tsx

### Data Available from Backend
The `StoryboardPage` already transforms backend sentences into Scene objects with:
```typescript
{
  id: sentence.id,
  narration: sentence.text,
  imagePrompt: sentence.imagePrompt || '',
  videoPrompt: sentence.videoPrompt || undefined,
  cameraMovement: sentence.cameraMovement || 'static',
  // ... other fields
}
```

### Source Tree Components

**Modified Files:**
- `components/Storyboard.tsx` - Add prompt display to table/grid views
- Potentially extract `components/Storyboard/SceneRow.tsx` for table row
- Potentially extract `components/Storyboard/SceneCard.tsx` for grid card

### UI Token Application (from design system)

**Prompt Text:**
- Container: `bg-surface-1/50 rounded-md p-2 mt-2`
- Label: `text-text-muted text-[10px] uppercase tracking-wide`
- Text: `text-text-secondary text-sm font-mono`
- Icon: `text-text-muted mr-1` (image icon, video icon)

**Empty State:**
- Text: `text-text-muted italic text-sm`
- Content: "No prompt generated" (per AC 4)

**Camera Movement Badge:**
- Container: `bg-surface-2 px-2 py-0.5 rounded text-[10px]`
- Icon: Camera icon matching movement type

### UX Design Reference
- [UX Design Specification](../planning-artifacts/ux-design-specification.md) - Wireframes, design tokens, component specs

### References
- [Source: routes.tsx] - StoryboardPage data transformation
- [Source: components/Storyboard.tsx] - Current Storyboard component
- [Source: types.ts:178-191] - Scene interface definition

## Dev Agent Record

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
- Vitest config updated to include `.tsx` test files and jsdom environment for component tests
- Added Camera icon to Icons.tsx for camera movement indicator
- Added component test setup with jest-dom matchers

### Completion Notes List
- Implemented prompt display in table view with Image/Video icons, labels, and prompts
- Implemented prompt display in grid view with compact layout
- Added camera movement badge with Camera icon in both views
- Implemented expand/collapse functionality for long prompts using line-clamp-2 with click toggle
- Added title tooltips showing "Click to expand" / "Click to collapse"
- Created comprehensive test suite with 15 tests covering:
  - Table view prompt rendering
  - Video prompt display
  - Empty state placeholders
  - Camera movement badges
  - Prompt truncation and expansion
  - Grid view functionality
  - View mode toggle

### File List
- `components/Storyboard.tsx` - Modified (added prompt display to table/grid views, expand/collapse state)
- `components/Icons.tsx` - Modified (added Camera icon export)
- `vitest.config.ts` - Modified (added tsx test files, jsdom environment, path alias)
- `tests/components/setup.ts` - Created (jest-dom matchers for component tests)
- `tests/components/Storyboard/PromptDisplay.test.tsx` - Created (15 tests for prompt display)

### Code Review Fixes (2026-01-19)
- **H1 Fixed**: Staged test file in git (`git add tests/components/Storyboard/`)
- **M1 Fixed**: Grid view now consistently shows video prompt section with "No prompt generated" placeholder (was hidden when empty)
- **M2 Fixed**: Updated all placeholder text from "No image prompt" / "No video prompt" to "No prompt generated" to match AC 4
- **M3 Documented**: Task 3.2 (motion strength indicator) marked as blocked - Scene type lacks `motionStrength` field, requires data model update in future story

## Change Log

- 2026-01-19: Code review fixes - consistent video prompt display in grid view, AC-compliant placeholder text
- 2026-01-19: Implemented prompt display in Storyboard (table and grid views), added truncation with expand/collapse, added Camera icon, created 15 unit tests
