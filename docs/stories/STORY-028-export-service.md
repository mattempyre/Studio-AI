# STORY-028: Export Service

**Epic:** Export System (EPIC-07)
**Priority:** Must Have
**Story Points:** 5
**Status:** Not Started
**Assigned To:** Unassigned
**Created:** 2026-01-17
**Sprint:** 5

---

## User Story

As a **creator**
I want **to export all assets with proper naming**
So that **I can import into my video editor (DaVinci, Premiere, FCP)**

---

## Description

### Background
After all generation is complete, creators need to export their assets in a format compatible with professional video editors. The export creates an organized folder structure with sequential file naming that maintains scene order when imported.

### Scope
**In scope:**
- Export API endpoint
- Create folder structure: audio/, images/, videos/
- Sequential naming: 001_section-slug_type.ext
- Copy all generated files
- Create script.txt with narration
- Generate zip file for download

**Out of scope:**
- Video concatenation/assembly
- EDL/XML/AAF export
- Cloud storage upload
- Incremental exports

### User Flow
1. User clicks "Export" button
2. System validates all assets are generated
3. Export job starts in background
4. Folder structure created with copied files
5. script.txt generated with all narration
6. Zip file created
7. User downloads zip file
8. User imports into video editor

---

## Acceptance Criteria

- [ ] `POST /api/v1/projects/:id/export` starts export job
- [ ] Export validates all sentences have audio (warning if missing)
- [ ] Creates folder structure in temp directory
- [ ] Audio files: `audio/001_section-slug.wav`
- [ ] Image files: `images/001_section-slug.png`
- [ ] Video files: `videos/001_section-slug.mp4`
- [ ] Sequential numbering maintains scene order
- [ ] Section slug is URL-safe version of title
- [ ] script.txt includes all narration with timecodes
- [ ] Creates zip file of entire export folder
- [ ] Zip filename: `{project-name}-export-{timestamp}.zip`
- [ ] Progress updates via WebSocket
- [ ] Returns download URL on completion
- [ ] Cleans up temp files after download

---

## Technical Notes

### Components
- **API:** `src/backend/api/exports.ts`
- **Inngest:** `src/backend/inngest/functions/exportProject.ts`
- **Service:** `src/backend/services/exportService.ts`

### API Endpoints

```
POST /api/v1/projects/:id/export

Response (202):
{
  "jobId": "job_export_xyz",
  "message": "Export started"
}

GET /api/v1/exports/:jobId/status

Response (200):
{
  "status": "running" | "completed" | "failed",
  "progress": 75,
  "downloadUrl": "/api/v1/exports/job_xyz/download"  // When completed
}

GET /api/v1/exports/:jobId/download

Response: Binary zip file with Content-Disposition header
```

### Export Folder Structure

```
project-name-export-20260117/
├── audio/
│   ├── 001_introduction.wav
│   ├── 002_introduction.wav
│   ├── 003_origins-of-coffee.wav
│   └── ...
├── images/
│   ├── 001_introduction.png
│   ├── 002_introduction.png
│   └── ...
├── videos/
│   ├── 001_introduction.mp4
│   ├── 002_introduction.mp4
│   └── ...
└── script.txt
```

### Export Service

```typescript
// src/backend/services/exportService.ts
import { mkdir, copyFile, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';
import { createWriteStream } from 'fs';

interface ExportOptions {
  projectId: string;
  includeAudio: boolean;
  includeImages: boolean;
  includeVideos: boolean;
}

class ExportService {
  private tempDir = join(process.cwd(), 'temp', 'exports');

  async exportProject(projectId: string, onProgress: (p: number) => void): Promise<string> {
    const project = await getProjectWithAllData(projectId);
    const exportDir = join(this.tempDir, `${slugify(project.name)}-export-${Date.now()}`);

    // Create directories
    await mkdir(join(exportDir, 'audio'), { recursive: true });
    await mkdir(join(exportDir, 'images'), { recursive: true });
    await mkdir(join(exportDir, 'videos'), { recursive: true });

    // Build flat list of all sentences with numbering
    const allSentences = project.sections.flatMap((section, sIdx) =>
      section.sentences.map((sentence, sentIdx) => ({
        ...sentence,
        globalIndex: this.calculateGlobalIndex(project.sections, sIdx, sentIdx),
        sectionSlug: slugify(section.title),
      }))
    );

    // Copy files with progress
    let completed = 0;
    const total = allSentences.length * 3;  // audio, image, video

    for (const sentence of allSentences) {
      const number = String(sentence.globalIndex + 1).padStart(3, '0');
      const baseName = `${number}_${sentence.sectionSlug}`;

      // Copy audio
      if (sentence.audioFile) {
        await copyFile(
          sentence.audioFile,
          join(exportDir, 'audio', `${baseName}.wav`)
        );
      }
      completed++;
      onProgress(Math.round((completed / total) * 100));

      // Copy image
      if (sentence.imageFile) {
        await copyFile(
          sentence.imageFile,
          join(exportDir, 'images', `${baseName}.png`)
        );
      }
      completed++;
      onProgress(Math.round((completed / total) * 100));

      // Copy video
      if (sentence.videoFile) {
        await copyFile(
          sentence.videoFile,
          join(exportDir, 'videos', `${baseName}.mp4`)
        );
      }
      completed++;
      onProgress(Math.round((completed / total) * 100));
    }

    // Generate script.txt
    await this.generateScriptFile(exportDir, project, allSentences);

    // Create zip
    const zipPath = `${exportDir}.zip`;
    await this.createZip(exportDir, zipPath);

    // Clean up export dir (keep zip)
    await rm(exportDir, { recursive: true });

    return zipPath;
  }

  private async generateScriptFile(
    exportDir: string,
    project: Project,
    sentences: SentenceWithMeta[]
  ): Promise<void> {
    let content = `# ${project.name}\n`;
    content += `# Exported: ${new Date().toISOString()}\n\n`;

    let currentSection = '';
    let cumulativeTime = 0;

    for (const sentence of sentences) {
      if (sentence.sectionSlug !== currentSection) {
        currentSection = sentence.sectionSlug;
        content += `\n## ${sentence.section?.title || currentSection}\n\n`;
      }

      const timecode = this.formatTimecode(cumulativeTime);
      const duration = sentence.audioDuration || 0;
      const endTimecode = this.formatTimecode(cumulativeTime + duration);

      content += `[${timecode} - ${endTimecode}]\n`;
      content += `${sentence.text}\n\n`;

      cumulativeTime += duration;
    }

    await writeFile(join(exportDir, 'script.txt'), content, 'utf-8');
  }

  private formatTimecode(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const frames = Math.floor((ms % 1000) / (1000 / 24));  // Assuming 24fps

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }

  private async createZip(sourceDir: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
}

export const exportService = new ExportService();
```

### Inngest Function

```typescript
// src/backend/inngest/functions/exportProject.ts
export const exportProject = inngest.createFunction(
  {
    id: 'export-project',
    concurrency: { limit: 2 },
  },
  { event: 'export/start' },
  async ({ event, step }) => {
    const { projectId } = event.data;

    const job = await step.run('create-job', async () => {
      return await jobService.createJob({
        projectId,
        jobType: 'export',
        status: 'running',
      });
    });

    const zipPath = await step.run('export-files', async () => {
      return await exportService.exportProject(projectId, (progress) => {
        broadcastToProject(projectId, {
          type: 'progress',
          jobId: job.id,
          jobType: 'export',
          progress,
          message: `Exporting: ${progress}%`,
        });
      });
    });

    await step.run('complete-job', async () => {
      await jobService.completeJob(job.id, { resultFile: zipPath });

      broadcastToProject(projectId, {
        type: 'job_complete',
        jobId: job.id,
        jobType: 'export',
        result: { downloadUrl: `/api/v1/exports/${job.id}/download` },
      });
    });

    return { success: true, zipPath };
  }
);
```

### Download Endpoint

```typescript
// GET /api/v1/exports/:jobId/download
router.get('/:jobId/download', async (req, res) => {
  const { jobId } = req.params;

  const job = await jobService.getJob(jobId);
  if (!job || job.status !== 'completed') {
    return res.status(404).json({ error: 'Export not ready' });
  }

  const zipPath = job.resultFile;
  const filename = path.basename(zipPath);

  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/zip');

  const stream = createReadStream(zipPath);
  stream.pipe(res);

  // Clean up after download
  stream.on('end', async () => {
    await rm(zipPath, { force: true });
    await jobService.deleteJob(jobId);
  });
});
```

### Security Considerations
- Validate project ownership before export
- Limit zip file size
- Clean up temp files on error
- Prevent path traversal in file names

---

## Dependencies

**Prerequisite Stories:**
- STORY-014: Audio Generation Job (audio files)
- STORY-018: Image Generation Job (image files)
- STORY-020: Video Generation Job (video files)

**Blocked Stories:**
- STORY-029: Export UI & Download
- STORY-030: Export Metadata

**External Dependencies:**
- `archiver` npm package for zip creation

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] File naming logic
  - [ ] Script generation
  - [ ] Zip creation
- [ ] Integration tests passing
  - [ ] End-to-end export
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Export tested with DaVinci Resolve import
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with full project

---

## Story Points Breakdown

- **Export service implementation:** 2 points
- **File organization & naming:** 1 point
- **Zip creation:** 1 point
- **Inngest function & progress:** 1 point
- **Total:** 5 points

**Rationale:** File operations, naming conventions, and zip creation require careful implementation. Script.txt generation adds complexity.

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
