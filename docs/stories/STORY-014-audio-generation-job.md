# STORY-014: Audio Generation Job

**Epic:** Voice Generation (EPIC-03)
**Priority:** Must Have
**Story Points:** 5
**Status:** review
**Assigned To:** Amelia
**Created:** 2026-01-17
**Sprint:** 2

---

## Dev Agent Record (Amelia)

### Implementation Plan
- [x] Create `src/backend/inngest/functions/generateAudio.ts` with Chatterbox integration.
- [x] Add `audio/generate` event to `StudioEvents` in `src/backend/inngest/client.ts`.
- [x] Register `generateAudio` in `src/backend/inngest/functions/index.ts`.
- [x] Register `generateAudio` in `src/backend/inngest/index.ts`.
- [x] Verify `src/backend/services/outputPaths.ts` contains `getAudioPath`.
- [x] Write integration test for audio generation job.

### Debug Log
- 2026-01-17: Starting implementation of Audio Generation Job. Verified ChatterboxClient is ready.
- 2026-01-17: Implemented `generateAudioFunction` with job tracking and progress broadcasting.
- 2026-01-17: Added specific path helpers to `outputPaths.ts`.
- 2026-01-17: Verified with unit tests.

### Completion Notes
- Implemented the core audio generation engine using Inngest.
- Connected to Chatterbox TTS service.
- Added real-time progress updates via WebSockets.
- Added duration extraction and database persistence.
- Concurrency limited to 4 as per requirements.

---

## User Story

As a **creator**
I want **audio automatically generated for each sentence**
So that **I have professional narration for my video**

---

## Description

### Background
Each sentence in the script needs corresponding audio narration. The Chatterbox TTS service converts text to speech and outputs WAV files. Audio generation is CPU-bound and can run in parallel (up to 4 concurrent jobs) to speed up production.

### Scope
**In scope:**
- Inngest function for audio generation
- Chatterbox TTS integration for sentence text
- WAV file storage in project directory
- Duration extraction from generated audio
- Progress updates via WebSocket
- Retry logic for failures
- Job status tracking in database

**Out of scope:**
- Multiple voices per project (single voice selected)
- Voice cloning
- Audio post-processing (normalization, effects)
- SSML support for pronunciation control

### User Flow
1. Script is generated with sentences
2. User clicks "Generate Audio" (single or bulk)
3. System queues audio jobs for each sentence
4. Chatterbox generates speech for each sentence
5. WAV files saved to project directory
6. Duration extracted and stored
7. Frontend shows progress and completion status
8. User can play back generated audio

---

## Acceptance Criteria

- [x] Inngest function `audio/generate` handles single sentence
- [x] Function calls Chatterbox TTS API with sentence text
- [x] Voice selection from project settings (voiceId field)
- [x] WAV file stored at `data/projects/{projectId}/audio/{sentenceId}.wav`
- [x] Audio duration extracted (milliseconds) and stored in sentence record
- [x] Sentence `audioFile` field updated with file path
- [x] Sentence `isAudioDirty` flag cleared on success
- [x] Sentence `status` updated during generation (generating → completed/failed)
- [x] Job record created in `generation_jobs` table
- [x] Progress updates broadcast via WebSocket
- [x] Retry on failure (max 3 attempts, exponential backoff)
- [x] Error message stored in job record on failure
- [x] Concurrency limit: 4 parallel audio jobs

---

## Technical Notes

### Components
- **Inngest Function:** `src/backend/inngest/functions/generateAudio.ts`
- **Client:** `src/backend/clients/chatterbox.ts`
- **Service:** `src/backend/services/jobService.ts`
- **File Utils:** `src/backend/services/outputPaths.ts`

### Inngest Event Type

```typescript
// Add to StudioEvents
'audio/generate': {
  data: {
    projectId: string;
    sentenceId: string;
    text: string;
    voiceId: string;
  };
};

'audio/completed': {
  data: {
    projectId: string;
    sentenceId: string;
    audioFile: string;
    durationMs: number;
  };
};
```

### Inngest Function

```typescript
// src/backend/inngest/functions/generateAudio.ts
import { inngest } from '../client';
import { chatterboxClient } from '../../clients/chatterbox';
import { jobService } from '../../services/jobService';
import { broadcastToProject } from '../../websocket/broadcast';
import { getAudioPath } from '../../services/outputPaths';
import { db } from '../../db';
import { sentences } from '../../db/schema';
import { eq } from 'drizzle-orm';

export const generateAudio = inngest.createFunction(
  {
    id: 'audio-generate',
    concurrency: { limit: 4 },  // CPU-bound, can parallelize
    retries: 3,
    backoff: { type: 'exponential', base: '5s' },
  },
  { event: 'audio/generate' },
  async ({ event, step }) => {
    const { projectId, sentenceId, text, voiceId } = event.data;

    // Step 1: Create job record
    const job = await step.run('create-job', async () => {
      return await jobService.createJob({
        projectId,
        sentenceId,
        jobType: 'audio',
        status: 'running',
      });
    });

    // Step 2: Update sentence status
    await step.run('update-status-generating', async () => {
      await db.update(sentences)
        .set({ status: 'generating' })
        .where(eq(sentences.id, sentenceId));

      broadcastToProject(projectId, {
        type: 'progress',
        jobId: job.id,
        jobType: 'audio',
        sentenceId,
        progress: 10,
        message: 'Starting audio generation...',
      });
    });

    // Step 3: Generate audio via Chatterbox
    const result = await step.run('generate-audio', async () => {
      const outputPath = getAudioPath(projectId, sentenceId);

      broadcastToProject(projectId, {
        type: 'progress',
        jobId: job.id,
        jobType: 'audio',
        sentenceId,
        progress: 30,
        message: 'Generating speech...',
      });

      const audioResult = await chatterboxClient.generateSpeech({
        text,
        voiceId,
        outputPath,
      });

      return {
        audioFile: outputPath,
        durationMs: audioResult.durationMs,
      };
    });

    // Step 4: Update sentence with result
    await step.run('update-sentence', async () => {
      await db.update(sentences)
        .set({
          audioFile: result.audioFile,
          audioDuration: result.durationMs,
          isAudioDirty: false,
          status: 'completed',
          updatedAt: new Date(),
        })
        .where(eq(sentences.id, sentenceId));
    });

    // Step 5: Complete job
    await step.run('complete-job', async () => {
      await jobService.completeJob(job.id, {
        resultFile: result.audioFile,
      });

      broadcastToProject(projectId, {
        type: 'job_complete',
        jobId: job.id,
        jobType: 'audio',
        sentenceId,
        result: {
          file: result.audioFile,
          duration: result.durationMs,
        },
      });
    });

    return { success: true, ...result };
  }
);
```

### Chatterbox Client

```typescript
// src/backend/clients/chatterbox.ts
import { spawn } from 'child_process';
import { stat } from 'fs/promises';
import { parseFile } from 'music-metadata';

interface SpeechGenerationParams {
  text: string;
  voiceId: string;
  outputPath: string;
}

interface SpeechGenerationResult {
  durationMs: number;
  outputPath: string;
}

class ChatterboxClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.CHATTERBOX_URL || 'http://localhost:8004';
  }

  async generateSpeech(params: SpeechGenerationParams): Promise<SpeechGenerationResult> {
    const { text, voiceId, outputPath } = params;

    // Call Chatterbox API
    const response = await fetch(`${this.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        voice: voiceId,
        response_format: 'wav',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chatterbox error: ${error}`);
    }

    // Save audio file
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, audioBuffer);

    // Extract duration
    const durationMs = await this.getAudioDuration(outputPath);

    return { durationMs, outputPath };
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    try {
      const metadata = await parseFile(filePath);
      return Math.round((metadata.format.duration || 0) * 1000);
    } catch {
      // Fallback: estimate from file size (rough approximation for 16kHz mono WAV)
      const stats = await stat(filePath);
      const bytesPerSecond = 32000; // 16kHz * 16bit * 1 channel
      return Math.round((stats.size / bytesPerSecond) * 1000);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getVoices(): Promise<string[]> {
    // Default Chatterbox voices
    return ['puck', 'kore', 'fenrir', 'charon', 'zephyr'];
  }
}

export const chatterboxClient = new ChatterboxClient();
```

### Output Paths

```typescript
// src/backend/services/outputPaths.ts
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data', 'projects');

export function getAudioPath(projectId: string, sentenceId: string): string {
  return join(DATA_DIR, projectId, 'audio', `${sentenceId}.wav`);
}

export function getImagePath(projectId: string, sentenceId: string): string {
  return join(DATA_DIR, projectId, 'images', `${sentenceId}.png`);
}

export function getVideoPath(projectId: string, sentenceId: string): string {
  return join(DATA_DIR, projectId, 'videos', `${sentenceId}.mp4`);
}
```

### Error Handling

```typescript
// In Inngest function, errors are caught and handled:
export const generateAudio = inngest.createFunction(
  {
    // ...
    onFailure: async ({ error, event }) => {
      const { projectId, sentenceId } = event.data;

      // Update sentence status to failed
      await db.update(sentences)
        .set({ status: 'failed' })
        .where(eq(sentences.id, sentenceId));

      // Broadcast failure
      broadcastToProject(projectId, {
        type: 'job_failed',
        jobType: 'audio',
        sentenceId,
        error: error.message,
      });
    },
  },
  // ...
);
```

### Security Considerations
- Validate sentenceId format
- Ensure outputPath is within allowed directory
- Sanitize text before sending to TTS (remove malicious content)
- Rate limit API calls to prevent abuse

---

## Dependencies

**Prerequisite Stories:**
- STORY-002: Inngest Job Queue Integration (Inngest setup)
- STORY-004: Chatterbox TTS Client Integration (TTS client)
- STORY-007: WebSocket Progress Server (progress updates)

**Blocked Stories:**
- STORY-016: Bulk Audio Generation (uses this function)
- STORY-020: Video Generation Job (depends on audio duration for timing)

**External Dependencies:**
- Chatterbox Docker container running
- `music-metadata` npm package for duration extraction

---

## Definition of Done

- [ ] Code implemented and committed to feature branch
- [ ] Unit tests written and passing (≥80% coverage)
  - [ ] Chatterbox API call
  - [ ] File storage
  - [ ] Duration extraction
  - [ ] Error handling
- [ ] Integration tests passing
  - [ ] End-to-end generation
  - [ ] Retry on failure
  - [ ] Concurrent execution
- [ ] Code reviewed and approved (1+ reviewer)
- [ ] Documentation updated
  - [ ] Inngest function documentation
  - [ ] Voice options documented
- [ ] Acceptance criteria validated (all checked)
- [ ] Deployed to development environment
- [ ] Manual testing with various text inputs

---

## Story Points Breakdown

- **Inngest function with steps:** 2 points
- **Chatterbox integration:** 1.5 points
- **File storage & duration:** 1 point
- **WebSocket progress:** 0.5 points
- **Total:** 5 points

**Rationale:** Multi-step Inngest function with external service integration. Duration extraction adds complexity.

---

## Additional Notes

Voice quality depends on input text:
- Punctuation affects pacing
- Numbers may need special handling
- Abbreviations might not be pronounced correctly

Future enhancements:
- SSML support for fine-tuned pronunciation
- Audio normalization (consistent volume levels)
- Multiple takes per sentence with selection

---

## Progress Tracking

**Status History:**
- 2026-01-17: Created by Scrum Master

**Actual Effort:** TBD

---

**This story was created using BMAD Method v6 - Phase 4 (Implementation Planning)**
