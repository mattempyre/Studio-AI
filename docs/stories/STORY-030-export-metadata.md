# STORY-030: Export Metadata

**Epic:** Export System (EPIC-07)
**Priority:** Should Have
**Story Points:** 2
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **metadata.json included in exports**
So that **I have structured project information for automation or re-import**

---

## Description

### Background
Beyond the script.txt file, some creators may want structured data about their project for automation workflows, archive purposes, or potential re-import. The metadata.json file provides comprehensive project information in a machine-readable format.

### Scope
**In scope:**
- metadata.json file in export root
- Project info: name, topic, settings, timestamps
- Section and sentence details
- File mappings for each asset
- Durations and timing info

**Out of scope:**
- Import from metadata.json
- External schema validation
- Version compatibility checking

### User Flow
1. User exports project
2. metadata.json is automatically included
3. User can parse JSON for automation
4. Structure allows potential re-import (future feature)

---

## Acceptance Criteria

- [ ] metadata.json included in export zip root
- [ ] Contains project-level info: name, topic, visualStyle, voiceId
- [ ] Contains export timestamp
- [ ] Contains sections array with section info
- [ ] Each section contains sentences array
- [ ] Each sentence has: text, durations, file paths
- [ ] File paths are relative to export root
- [ ] JSON is pretty-printed for readability
- [ ] Total duration calculated and included
- [ ] Schema version number included for future compatibility

---

## Technical Notes

### Components
- **Service:** `src/backend/services/exportService.ts` (extend)

### Metadata Structure

```json
{
  "schemaVersion": "1.0",
  "exportedAt": "2026-01-17T10:30:00Z",
  "project": {
    "id": "proj_abc123",
    "name": "The History of Coffee",
    "topic": "Coffee history and culture",
    "visualStyle": "documentary",
    "voiceId": "puck",
    "targetDuration": 8,
    "createdAt": "2026-01-15T08:00:00Z",
    "updatedAt": "2026-01-17T10:00:00Z"
  },
  "statistics": {
    "totalSections": 4,
    "totalSentences": 45,
    "totalDurationMs": 480000,
    "audioFiles": 45,
    "imageFiles": 45,
    "videoFiles": 45
  },
  "sections": [
    {
      "id": "sec_001",
      "title": "Introduction",
      "order": 0,
      "sentences": [
        {
          "id": "sent_001",
          "order": 0,
          "globalIndex": 0,
          "text": "Coffee is one of the world's most beloved beverages.",
          "imagePrompt": "A steaming cup of coffee with morning light...",
          "videoPrompt": "Slow zoom into the coffee cup",
          "cameraMovement": "zoom_in",
          "motionStrength": 0.5,
          "audioDurationMs": 4200,
          "files": {
            "audio": "audio/001_introduction.wav",
            "image": "images/001_introduction.png",
            "video": "videos/001_introduction.mp4"
          }
        }
      ]
    }
  ],
  "characters": [
    {
      "id": "char_001",
      "name": "Dr. Sarah Chen",
      "description": "A distinguished scientist..."
    }
  ]
}
```

### Implementation

```typescript
// Add to exportService.ts

interface ExportMetadata {
  schemaVersion: string;
  exportedAt: string;
  project: {
    id: string;
    name: string;
    topic: string;
    visualStyle: string;
    voiceId: string;
    targetDuration: number;
    createdAt: string;
    updatedAt: string;
  };
  statistics: {
    totalSections: number;
    totalSentences: number;
    totalDurationMs: number;
    audioFiles: number;
    imageFiles: number;
    videoFiles: number;
  };
  sections: SectionMetadata[];
  characters: CharacterMetadata[];
}

async generateMetadataFile(
  exportDir: string,
  project: ProjectWithAllData,
  sentences: SentenceWithMeta[]
): Promise<void> {
  const metadata: ExportMetadata = {
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name,
      topic: project.topic || '',
      visualStyle: project.visualStyle,
      voiceId: project.voiceId,
      targetDuration: project.targetDuration,
      createdAt: project.createdAt?.toISOString() || '',
      updatedAt: project.updatedAt?.toISOString() || '',
    },
    statistics: {
      totalSections: project.sections.length,
      totalSentences: sentences.length,
      totalDurationMs: sentences.reduce((sum, s) => sum + (s.audioDuration || 0), 0),
      audioFiles: sentences.filter(s => s.audioFile).length,
      imageFiles: sentences.filter(s => s.imageFile).length,
      videoFiles: sentences.filter(s => s.videoFile).length,
    },
    sections: project.sections.map(section => ({
      id: section.id,
      title: section.title,
      order: section.order,
      sentences: sentences
        .filter(s => s.sectionId === section.id)
        .map(sentence => {
          const number = String(sentence.globalIndex + 1).padStart(3, '0');
          const slug = slugify(section.title);

          return {
            id: sentence.id,
            order: sentence.order,
            globalIndex: sentence.globalIndex,
            text: sentence.text,
            imagePrompt: sentence.imagePrompt || null,
            videoPrompt: sentence.videoPrompt || null,
            cameraMovement: sentence.cameraMovement,
            motionStrength: sentence.motionStrength,
            audioDurationMs: sentence.audioDuration || null,
            files: {
              audio: sentence.audioFile ? `audio/${number}_${slug}.wav` : null,
              image: sentence.imageFile ? `images/${number}_${slug}.png` : null,
              video: sentence.videoFile ? `videos/${number}_${slug}.mp4` : null,
            },
          };
        }),
    })),
    characters: project.cast?.map(char => ({
      id: char.id,
      name: char.name,
      description: char.description || '',
    })) || [],
  };

  await writeFile(
    join(exportDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );
}
```

### Update Export Service

```typescript
// In exportProject method, add before zip creation:
await this.generateMetadataFile(exportDir, project, allSentences);
```

---

## Dependencies

**Prerequisite Stories:**
- STORY-028: Export Service (base export functionality)

**Blocked Stories:**
- None (optional enhancement)

**External Dependencies:**
- None

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Metadata structure
  - [ ] Statistics calculation
  - [ ] File path mapping
- [ ] Integration tests passing
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] JSON schema documented
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing of metadata content

---

## Story Points Breakdown

- **Metadata structure design:** 0.5 points
- **Data collection & mapping:** 1 point
- **JSON generation:** 0.5 points
- **Total:** 2 points

**Rationale:** Straightforward data transformation. Main work is ensuring all fields are correctly populated.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
