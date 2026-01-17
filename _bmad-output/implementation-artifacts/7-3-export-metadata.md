# Story 7.3: Export Metadata

Status: ready-for-dev

## Story

As a **creator**,
I want **metadata.json included in exports**,
so that **I have project information for reference**.

## Acceptance Criteria

1. metadata.json included in export folder
2. Contains project info: name, topic, style, duration
3. Contains section list with titles and sentence counts
4. Contains sentence list with prompts and filenames
5. Contains character list with names and descriptions
6. Contains generation timestamps
7. JSON is human-readable (pretty-printed)
8. Optional: EDL/XML for NLE import

## Tasks / Subtasks

- [ ] Task 1: Create metadata generator (AC: 1, 2, 3, 4, 5, 6, 7)
  - [ ] 1.1: Create metadata generation function in exportService
  - [ ] 1.2: Build project info object
  - [ ] 1.3: Build sections array
  - [ ] 1.4: Build sentences array with filenames
  - [ ] 1.5: Build characters array
  - [ ] 1.6: Pretty-print JSON output

- [ ] Task 2: Add to export process
  - [ ] 2.1: Call metadata generator in export
  - [ ] 2.2: Write metadata.json to export folder

- [ ] Task 3: Optional EDL/XML (AC: 8)
  - [ ] 3.1: Research EDL format
  - [ ] 3.2: Create EDL generator (future)

- [ ] Task 4: Write tests
  - [ ] 4.1: Unit tests for metadata structure
  - [ ] 4.2: Snapshot tests for JSON format

## Dev Notes

### Metadata Structure
```json
{
  "project": {
    "id": "proj_abc",
    "name": "My Video",
    "topic": "Coffee production",
    "visualStyle": "cinematic",
    "targetDuration": 8,
    "createdAt": "2026-01-18T10:00:00Z",
    "exportedAt": "2026-01-18T12:00:00Z"
  },
  "sections": [
    {
      "id": "sec_001",
      "title": "Introduction",
      "order": 0,
      "sentenceCount": 5
    }
  ],
  "sentences": [
    {
      "id": "sent_001",
      "sectionId": "sec_001",
      "text": "Coffee is grown...",
      "imagePrompt": "A wide shot...",
      "audioFile": "001_introduction_audio.wav",
      "imageFile": "001_introduction_image.png",
      "videoFile": "001_introduction_video.mp4"
    }
  ],
  "characters": [
    {
      "id": "char_001",
      "name": "Host",
      "description": "A friendly narrator"
    }
  ]
}
```

### Source Tree Components

**Modified Files:**
- `src/backend/services/exportService.ts` - Add metadata generation

### References
- [Source: docs/stories/STORY-030-export-metadata.md]
- [Source: docs/prd-videogen-ai-studio-2026-01-16.md#FR-706]

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled during implementation)

### Completion Notes List
(To be filled upon completion)

### File List
(To be filled with all files created/modified)
