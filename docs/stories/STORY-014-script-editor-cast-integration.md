# STORY-014: Script Editor Cast & Voice Integration

**Epic:** Script Editor V2 (EPIC-03)
**Priority:** High
**Story Points:** 3
**Status:** Completed
**Assigned To:** Antigravity
**Created:** 2026-01-17
**Sprint:** 2

---

## User Story

As a **creator editing a script (V2)**
I want **to manage my project cast and voice settings throughout the editing process**
So that **I can easily assign characters and voices without leaving the editor.**

---

## Description

### Background
The previous Script Editor (V1) featured a robust sidebar for managing the "Project Cast" (subset of library characters) and "Voice Settings". It also had a "Cast Strip" visualization in the header. These features need to be ported to the new `ScriptEditorV2` component to match functionality and UX.

### Scope
**In scope:**
- Port "Right Sidebar" panel with "Cast" and "Voice" tabs.
- Port "Cast Strip" UI in the editor header.
- Implement Character creation/editing form within the sidebar (inline).
- Implement Voice selection (Platform/Cloned) and preview logic.
- Integrate with `projectsApi` for persisting changes (updating `project.characters` and `project.voiceId`).

**Out of scope:**
- "Visual Style" settings (already present in V2 header).
- Complex voice cloning backend logic (existing props/mocking usage is sufficient).

---

## Acceptance Criteria

- [ ] **Cast Strip**:
  - [ ] Displayed in the header area.
  - [ ] Shows horizontal list of project cast members.
  - [ ] Clicking a cast member opens the Right Sidebar (Cast tab).
- [ ] **Right Sidebar**:
  - [ ] Toggled via "Character Library" and "Voice Settings" buttons.
  - [ ] Slides in from the right.
  - [ ] Contains Tabs: "Cast" and "Voice".
- [ ] **Cast Tab**:
  - [ ] Lists all `libraryCharacters`.
  - [ ] Visually distinguishes characters currently in the project cast (e.g., checkmark, opacity).
  - [ ] Clicking a character toggles their presence in the project cast.
  - [ ] "Create Character" button allows adding new characters to library + project.
  - [ ] Edit character details (Name, Description, Image).
- [ ] **Voice Tab**:
  - [ ] Switch between "Platform" and "Cloned" voices.
  - [ ] List voices with Play/Preview button.
  - [ ] Clicking a voice selects it for the project (`project.voiceId`).
  - [ ] Drag & Drop zone for Voice Cloning (mock/UI only).

---

## Technical Notes

### Component Integration
- `ScriptEditorV2.tsx` needs state:
  - `showRightPanel` (boolean)
  - `activePanelTab` ('cast' | 'voice')
  - `isCreatingChar`, `editingCharacterId`, etc. (for form)
  - `voiceCategory` ('platform' | 'cloned')
  - `previewPlayingId` (for audio preview)
- **Data Persistence**:
  - Update Project Cast: `projectsApi.update(project.id, { characters: updatedList })`? 
    - *Correction*: `project` object has `characters` array. API might need separate endpoint `POST /cast` or general `update` might handle it?
    - STORY-013 introduced `POST /api/v1/projects/:id/cast`.
    - However, `ScriptEditor` V1 seemed to update the project object directly via `onUpdateProject`.
    - V2 uses `projectsApi.update` or `projectsApi.get`.
    - **Crucial**: `projectsApi` might NOT support updating `characters` via `PUT /projects/:id`.
    - `projects.ts` `updateProjectSchema` does NOT include `characters`.
    - So we MUST use the `POST /cast` and `DELETE /cast` endpoints from STORY-013!
    - **Action**: Use `fetch` or `projectsApi` (if updated) to call cast endpoints.
    - *Self-Correction*: I implemented endpoints in `projects.ts` but did I add them to `projectsApi` frontend service?
    - I should check `src/services/backendApi.ts`.

### Dependencies
- `projectsApi` (frontend service) needs methods for Cast (add/remove) if not present.
- Icons from `lucide-react`.

---

## Definition of Done
- [ ] UI implemented in `ScriptEditorV2`.
- [ ] Cast add/remove calls correct Backend API endpoints.
- [ ] Voice selection updates project voice ID.
- [ ] Code compiles and runs without errors.
