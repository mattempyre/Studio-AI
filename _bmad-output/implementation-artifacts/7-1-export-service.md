# Story 7.1: Export Service

Status: ready-for-dev

## Story

As a **creator**,
I want **to export all project assets with sequential naming**,
so that **I can import them into my video editor**.

## Acceptance Criteria

1. Export service creates organized folder structure
2. Files named sequentially: `{seq}_{section-slug}_{type}.{ext}`
3. Folders: audio/, images/, videos/
4. All generated files copied to export folder
5. Script.txt included with all narration text
6. Export runs as background job
7. Progress updates via WebSocket
8. ZIP option for single file download
9. Export only completed assets (skip pending)
10. Preserve original quality (no re-encoding)

## Tasks / Subtasks

- [ ] Task 1: Create export service (AC: 1, 2, 3, 4, 10)
  - [ ] 1.1: Create `src/backend/services/exportService.ts`
  - [ ] 1.2: Implement folder structure creation
  - [ ] 1.3: Implement sequential file naming
  - [ ] 1.4: Copy files without re-encoding

- [ ] Task 2: Create script.txt generation (AC: 5)
  - [ ] 2.1: Compile all sentence text
  - [ ] 2.2: Format with section headers
  - [ ] 2.3: Write to script.txt

- [ ] Task 3: Create Inngest function (AC: 6, 7)
  - [ ] 3.1: Create `src/backend/inngest/functions/export.ts`
  - [ ] 3.2: Add `export/start` event type
  - [ ] 3.3: Broadcast progress updates

- [ ] Task 4: Add ZIP option (AC: 8)
  - [ ] 4.1: Install archiver package
  - [ ] 4.2: Create ZIP from export folder

- [ ] Task 5: Create API endpoint
  - [ ] 5.1: Add `POST /api/v1/projects/:id/export`
  - [ ] 5.2: Return export job ID

- [ ] Task 6: Write tests
  - [ ] 6.1: Unit tests for file naming
  - [ ] 6.2: Unit tests for folder structure
  - [ ] 6.3: Integration tests for full export

## Dev Notes

### File Naming Convention
`{seq}_{section-slug}_{type}.{ext}`
- seq: 3-digit sequence number (001, 002, etc.)
- section-slug: URL-friendly section title
- type: audio, image, video
- ext: wav, png, mp4

### Folder Structure
```
export_{projectId}_{timestamp}/
  audio/
    001_introduction_audio.wav
    002_introduction_audio.wav
  images/
    001_introduction_image.png
    002_introduction_image.png
  videos/
    001_introduction_video.mp4
    002_introduction_video.mp4
  script.txt
```

### Source Tree Components

**New Files:**
- `src/backend/services/exportService.ts`
- `src/backend/inngest/functions/export.ts`

**Modified Files:**
- `src/backend/api/projects.ts` - Add export endpoint
- `src/backend/inngest/client.ts` - Add export event types

### References
- [Source: docs/architecture-videogen-ai-studio-2026-01-17.md] - Architecture v1.1 (2026-01-19)
- [Source: docs/stories/STORY-028-export-service.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-701 to FR-705]
- [Source: src/backend/services/fileStorage.ts] - Existing file storage utilities
- [Source: src/backend/services/outputPaths.ts] - Path generation utilities
- [Source: src/backend/inngest/client.ts] - Event types (export/start, export/completed)

### Architecture v1.1 Integration Notes

The architecture includes these relevant components:
- **fileStorage.ts**: Utility service for file operations - can be leveraged for copy operations
- **outputPaths.ts**: Generates consistent paths for project assets
- **export/start event**: Already defined in Inngest client schema
- **export/completed event**: Already defined for job completion notification

Consider using existing services:
```typescript
import { outputPaths } from '../services/outputPaths';
import { fileStorage } from '../services/fileStorage';
```

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
