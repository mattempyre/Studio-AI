# STORY-008: Project CRUD API

**Epic:** Script Management (EPIC-01)
**Priority:** Must Have
**Story Points:** 3
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 1

---

## User Story

As a **creator**
I want **to create and manage projects via API**
So that **I can organize my video productions**

---

## Description

### Background
Projects are the core container for all video content. Each project holds a script (sections/sentences), character cast, settings (duration, voice, style), and generated assets. The API must support full CRUD operations plus project retrieval with nested data.

### Scope
**In scope:**
- Create new project with default settings
- List all projects with summary info
- Get single project with full nested data (sections, sentences)
- Update project metadata (name, topic, targetDuration, visualStyle, voiceId)
- Delete project and cascade delete all related data and files

**Out of scope:**
- Project duplication/cloning
- Project sharing/collaboration
- Import/export project as JSON

### User Flow
1. User creates new project with name and topic
2. System creates project record with defaults
3. User can view project list on dashboard
4. User can open project to see full details
5. User can update project settings
6. User can delete project (with confirmation)

---

## Acceptance Criteria

- [ ] `POST /api/v1/projects` creates new project with required `name` field
- [ ] Created project has default values: `targetDuration: 8`, `visualStyle: 'cinematic'`, `voiceId: 'puck'`, `status: 'draft'`
- [ ] `GET /api/v1/projects` returns list of all projects
- [ ] List includes: id, name, topic, targetDuration, status, createdAt, updatedAt
- [ ] List is sorted by `updatedAt` descending (most recent first)
- [ ] `GET /api/v1/projects/:id` returns project with nested sections and sentences
- [ ] Nested data includes generation status for each sentence
- [ ] `PUT /api/v1/projects/:id` updates allowed fields (name, topic, targetDuration, visualStyle, voiceId)
- [ ] Update sets `updatedAt` to current timestamp
- [ ] `DELETE /api/v1/projects/:id` removes project and all related data
- [ ] Delete cascades to: sections, sentences, generation_jobs, project_cast, script_outlines
- [ ] Delete removes generated files from `data/projects/{projectId}/`
- [ ] All endpoints return appropriate HTTP status codes (200, 201, 400, 404, 500)
- [ ] Request validation using Zod schemas
- [ ] Error responses follow standard format: `{ error: { code, message, details? } }`

---

## Technical Notes

### Components
- **API Route:** `src/backend/api/projects.ts`
- **Service:** `src/backend/services/projectService.ts` (optional, can start inline)
- **File Utils:** `src/backend/services/outputPaths.ts` (for file deletion)

### API Specifications

#### Create Project
```
POST /api/v1/projects
Content-Type: application/json

Request:
{
  "name": "My First Video",
  "topic": "The History of Coffee",
  "targetDuration": 10,
  "visualStyle": "documentary"
}

Response (201):
{
  "id": "proj_abc123",
  "name": "My First Video",
  "topic": "The History of Coffee",
  "targetDuration": 10,
  "visualStyle": "documentary",
  "voiceId": "puck",
  "status": "draft",
  "createdAt": "2026-01-17T10:00:00Z",
  "updatedAt": "2026-01-17T10:00:00Z"
}
```

#### List Projects
```
GET /api/v1/projects

Response (200):
{
  "projects": [
    {
      "id": "proj_abc123",
      "name": "My First Video",
      "topic": "The History of Coffee",
      "targetDuration": 10,
      "visualStyle": "documentary",
      "status": "generating",
      "sectionCount": 3,
      "sentenceCount": 24,
      "createdAt": "2026-01-17T10:00:00Z",
      "updatedAt": "2026-01-17T12:00:00Z"
    }
  ]
}
```

#### Get Project with Details
```
GET /api/v1/projects/:id

Response (200):
{
  "id": "proj_abc123",
  "name": "My First Video",
  "topic": "The History of Coffee",
  "targetDuration": 10,
  "visualStyle": "documentary",
  "voiceId": "puck",
  "status": "generating",
  "sections": [
    {
      "id": "sec_001",
      "title": "Introduction",
      "order": 0,
      "sentences": [
        {
          "id": "sent_001",
          "text": "Coffee is one of the world's most beloved beverages.",
          "order": 0,
          "imagePrompt": "...",
          "videoPrompt": "...",
          "cameraMovement": "static",
          "motionStrength": 0.5,
          "audioFile": "/data/projects/proj_abc123/audio/sent_001.wav",
          "imageFile": null,
          "videoFile": null,
          "isAudioDirty": false,
          "isImageDirty": true,
          "isVideoDirty": true,
          "status": "pending"
        }
      ]
    }
  ],
  "createdAt": "2026-01-17T10:00:00Z",
  "updatedAt": "2026-01-17T12:00:00Z"
}
```

#### Update Project
```
PUT /api/v1/projects/:id
Content-Type: application/json

Request:
{
  "name": "Updated Title",
  "targetDuration": 15
}

Response (200):
{
  "id": "proj_abc123",
  "name": "Updated Title",
  "targetDuration": 15,
  ...
}
```

#### Delete Project
```
DELETE /api/v1/projects/:id

Response (204): No content
```

### Zod Schemas

```typescript
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  topic: z.string().max(1000).optional(),
  targetDuration: z.number().int().min(1).max(180).optional().default(8),
  visualStyle: z.string().max(100).optional().default('cinematic'),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  topic: z.string().max(1000).optional(),
  targetDuration: z.number().int().min(1).max(180).optional(),
  visualStyle: z.string().max(100).optional(),
  voiceId: z.string().max(50).optional(),
});
```

### Database Queries

```typescript
// Get project with nested data
const projectWithData = await db.query.projects.findFirst({
  where: eq(projects.id, projectId),
  with: {
    sections: {
      orderBy: [asc(sections.order)],
      with: {
        sentences: {
          orderBy: [asc(sentences.order)],
        },
      },
    },
  },
});
```

### File Deletion

```typescript
import { rm } from 'fs/promises';
import { join } from 'path';

async function deleteProjectFiles(projectId: string) {
  const projectDir = join(process.cwd(), 'data', 'projects', projectId);
  await rm(projectDir, { recursive: true, force: true });
}
```

### Security Considerations
- Validate projectId format (prevent path traversal)
- Sanitize project name and topic fields
- Ensure cascade delete doesn't leave orphaned files

---

## Dependencies

**Prerequisite Stories:**
- STORY-001: Project Setup & Database Schema (database must exist)

**Blocked Stories:**
- STORY-009: AI Script Generation (needs project to exist)
- STORY-010: Script Editor Component (fetches project data)
- STORY-013: Project Cast Management (extends project API)
- STORY-036: Project Dashboard (lists projects)

**External Dependencies:**
- Drizzle ORM configured
- Express server running

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Create project with defaults
  - [ ] Create project with custom values
  - [ ] Validation error handling
  - [ ] List projects ordering
  - [ ] Get project with nested data
  - [ ] Update project fields
  - [ ] Delete project cascade
- [ ] Integration tests passing
  - [ ] Full CRUD flow test
  - [ ] 404 handling for missing project
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] API endpoint documentation
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing completed via Postman/curl

---

## Story Points Breakdown

- **CRUD endpoints:** 2 points
- **Nested data retrieval:** 0.5 points
- **File deletion logic:** 0.5 points
- **Total:** 3 points

**Rationale:** Standard CRUD with some complexity for nested retrieval and cascade deletes. Drizzle ORM handles most of the heavy lifting.

---

## Additional Notes

The project API is foundational - most other features depend on it. Consider adding:
- Pagination for project list (when list grows large)
- Search/filter projects by name or topic
- Project thumbnail (first generated image)

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
