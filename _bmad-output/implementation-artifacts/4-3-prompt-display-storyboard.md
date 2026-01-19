# Story 4.3: Prompt Display in Storyboard

Status: ready-for-dev

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

- [ ] Task 1: Update Storyboard table row component (AC: 1, 2, 3, 4)
  - [ ] 1.1: Add prompt display section below narration in table rows
  - [ ] 1.2: Style with muted text and image/video icons
  - [ ] 1.3: Handle empty prompt state with placeholder

- [ ] Task 2: Update Storyboard grid card component (AC: 1, 2, 7)
  - [ ] 2.1: Add prompt display to grid card layout
  - [ ] 2.2: Ensure responsive layout for prompts

- [ ] Task 3: Add camera movement indicator (AC: 6)
  - [ ] 3.1: Display camera movement type with icon
  - [ ] 3.2: Show motion strength indicator if applicable

- [ ] Task 4: Add truncation and expansion (AC: 8)
  - [ ] 4.1: Implement text truncation for long prompts
  - [ ] 4.2: Add expand/collapse toggle or hover tooltip

- [ ] Task 5: Write tests
  - [ ] 5.1: Unit tests for prompt display component
  - [ ] 5.2: Test empty state rendering
  - [ ] 5.3: Test truncation behavior

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
- Content: "No image prompt" / "No video prompt"

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
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
