# STORY-006: Long-Form Script Generation

**Status:** Completed
**Priority:** High
**Estimated Effort:** 3-5 days
**Created:** 2026-01-17

---

## Problem Statement

The current `DeepseekClient.generateScript()` method generates scripts in a single API call, which is limited to ~2,000 words output. Users need to generate scripts for videos ranging from **1 minute to 3 hours** (150 to 27,000+ words). Single-call generation cannot produce coherent long-form content, and without memory management, longer scripts suffer from repetition and inconsistency.

## Solution

Implement the **AgentWrite pattern** with **recursive summarization**:

1. **Phase 1 - Outline Generation**: Generate a structured outline with section targets
2. **Phase 2 - Section-by-Section Generation**: Generate each section with context from previous sections
3. **Memory Management**: Maintain a running summary to prevent repetition
4. **Two Modes**: Support both fully automatic and outline-review-first workflows

---

## Requirements

### Functional Requirements

- **FR-1**: Generate scripts from 1 minute to 3 hours duration (150-27,000 words)
- **FR-2**: Generate outline first with section titles, descriptions, and duration targets
- **FR-3**: Support "auto-generate" mode (topic → complete script)
- **FR-4**: Support "outline-first" mode (topic → outline → user review → generate sections)
- **FR-5**: Prevent repetition using running summary and covered-topics tracking
- **FR-6**: Real-time progress updates as each section completes
- **FR-7**: Ability to pause/resume long generation jobs
- **FR-8**: Regenerate individual sections without regenerating entire script

### Non-Functional Requirements

- **NFR-1**: Each section generation should complete in <30 seconds
- **NFR-2**: Total generation time for 3-hour script should be <15 minutes
- **NFR-3**: Cost per 3-hour script should be <$0.10 (Deepseek API)

### Out of Scope

- Local LLM support (future story)
- Parallel section generation (sections must be sequential for context)
- User editing of individual sentences during generation (post-generation editing only)

---

## Technical Approach

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend                                  │
│  ScriptEditor.tsx                                               │
│  ├─ "Generate Script" button                                    │
│  ├─ Outline review modal (optional)                             │
│  └─ Real-time progress display                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ POST /api/v1/projects/:id/generate-script
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Express API                                  │
│  api/scripts.ts                                                 │
│  ├─ POST /generate-outline     → Returns outline for review     │
│  ├─ POST /generate-script      → Triggers full generation       │
│  └─ GET  /generation-status    → SSE stream for progress        │
└─────────────────────────┬───────────────────────────────────────┘
                          │ inngest.send('script/generate-long')
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Inngest Function                             │
│  inngest/functions/generateLongScript.ts                        │
│  ├─ Step 1: Generate/load outline                               │
│  ├─ Step 2-N: For each section:                                 │
│  │   ├─ Build context (summary + previous ending)               │
│  │   ├─ Generate section content                                │
│  │   ├─ Save to database                                        │
│  │   ├─ Update running summary                                  │
│  │   └─ Update progress                                         │
│  └─ Final: Mark job complete                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DeepseekClient                                 │
│  clients/deepseek.ts                                            │
│  ├─ generateOutline()           → ScriptOutline                 │
│  ├─ generateSectionWithContext() → GeneratedSection             │
│  └─ compressSummary()           → string                        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model Changes

#### New Table: `script_outlines`

```typescript
export const scriptOutlines = sqliteTable('script_outlines', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  totalTargetMinutes: integer('total_target_minutes').notNull(),
  sections: text('sections', { mode: 'json' }).$type<SectionOutline[]>().notNull(),
  status: text('status').notNull().default('draft'), // draft, approved, generating, completed
  runningSummary: text('running_summary'), // Updated as sections generate
  coveredTopics: text('covered_topics', { mode: 'json' }).$type<string[]>().default([]),
  currentSectionIndex: integer('current_section_index').default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

interface SectionOutline {
  index: number;
  title: string;
  description: string;
  targetMinutes: number;
  keyPoints: string[];
  status: 'pending' | 'generating' | 'completed' | 'failed';
}
```

#### Update: `generation_jobs` table

Add support for section-level progress:

```typescript
// Existing fields plus:
totalSteps: integer('total_steps'),      // Total sections to generate
currentStep: integer('current_step'),    // Current section being generated
stepName: text('step_name'),             // "Generating section: Introduction"
```

### API Design

#### Generate Outline Only

```
POST /api/v1/projects/:projectId/generate-outline

Request:
{
  "topic": "The History of Space Exploration",
  "targetDurationMinutes": 120,
  "visualStyle": "cinematic documentary"
}

Response:
{
  "outlineId": "outline_abc123",
  "title": "Journey to the Stars: A History of Space Exploration",
  "totalTargetMinutes": 120,
  "sections": [
    {
      "index": 0,
      "title": "The Dream of Flight",
      "description": "Early visionaries and the birth of rocketry",
      "targetMinutes": 8,
      "keyPoints": ["Tsiolkovsky", "Goddard", "V-2 rockets"]
    },
    // ... more sections
  ]
}
```

#### Generate Full Script

```
POST /api/v1/projects/:projectId/generate-script

Request:
{
  "mode": "auto" | "from-outline",
  "outlineId": "outline_abc123",  // Required if mode is "from-outline"
  "topic": "...",                  // Required if mode is "auto"
  "targetDurationMinutes": 120,
  "visualStyle": "cinematic"
}

Response:
{
  "jobId": "job_xyz789",
  "status": "queued",
  "totalSections": 15,
  "estimatedDurationSeconds": 300
}
```

#### Real-Time Progress (SSE)

```
GET /api/v1/projects/:projectId/generation-status

SSE Events:
event: progress
data: {
  "jobId": "job_xyz789",
  "status": "running",
  "currentSection": 3,
  "totalSections": 15,
  "currentSectionTitle": "The Space Race Begins",
  "percentComplete": 20,
  "sectionsCompleted": ["Introduction", "Early Pioneers"]
}

event: section-complete
data: {
  "sectionIndex": 2,
  "sectionTitle": "The Space Race Begins",
  "sentenceCount": 24,
  "durationMinutes": 8.2
}

event: complete
data: {
  "jobId": "job_xyz789",
  "status": "completed",
  "totalSections": 15,
  "totalSentences": 340,
  "totalDurationMinutes": 118.5
}
```

### DeepseekClient Extensions

```typescript
// New interfaces
interface ScriptOutline {
  title: string;
  totalTargetMinutes: number;
  sections: SectionOutline[];
}

interface SectionOutline {
  index: number;
  title: string;
  description: string;
  targetMinutes: number;
  keyPoints: string[];
}

interface SectionGenerationContext {
  outline: ScriptOutline;
  currentSectionIndex: number;
  runningSummary: string;
  previousSectionEnding: string;
  coveredTopics: string[];
  visualStyle: string;
}

// New methods
class DeepseekClient {
  // Generate outline for long-form script
  async generateOutline(options: {
    topic: string;
    targetDurationMinutes: number;
    visualStyle?: string;
  }): Promise<ScriptOutline>;

  // Generate a single section with full context
  async generateSectionWithContext(
    context: SectionGenerationContext
  ): Promise<GeneratedSection>;

  // Compress content into running summary
  async compressSummary(
    previousSummary: string,
    newSection: GeneratedSection,
    maxWords?: number
  ): Promise<string>;

  // Extract key topics from section for anti-repetition
  async extractCoveredTopics(
    section: GeneratedSection
  ): Promise<string[]>;
}
```

### Inngest Event Types

```typescript
// Add to StudioEvents
'script/generate-long': {
  data: {
    projectId: string;
    outlineId?: string;      // If using existing outline
    topic: string;
    targetDurationMinutes: number;
    visualStyle: string;
    mode: 'auto' | 'from-outline';
  };
};

'script/section-completed': {
  data: {
    projectId: string;
    outlineId: string;
    sectionIndex: number;
    sectionTitle: string;
    sentenceCount: number;
  };
};

'script/outline-generated': {
  data: {
    projectId: string;
    outlineId: string;
    sectionCount: number;
  };
};
```

### Prompt Engineering

#### Outline Generation System Prompt

```
You are a professional video script planner. Create a detailed outline for a {{duration}} minute video about "{{topic}}".

OUTPUT FORMAT (JSON):
{
  "title": "Engaging Video Title",
  "sections": [
    {
      "index": 0,
      "title": "Section Title",
      "description": "2-3 sentence description of what this section covers",
      "targetMinutes": 8,
      "keyPoints": ["Point 1", "Point 2", "Point 3"]
    }
  ]
}

GUIDELINES:
- Create {{sectionCount}} sections (approximately 1 section per 8 minutes)
- Each section should have a clear focus and natural flow to the next
- Distribute time based on topic importance
- First section should hook the viewer
- Last section should provide satisfying conclusion
- Key points should be specific and actionable for the writer
```

#### Section Generation System Prompt

```
You are a professional video script writer continuing a {{totalDuration}} minute video.

FULL OUTLINE:
{{outline as JSON}}

CURRENT SECTION TO WRITE:
Section {{index}}: "{{sectionTitle}}"
Description: {{description}}
Target: {{targetMinutes}} minutes (~{{wordCount}} words, {{sentenceCount}} sentences)
Key points to cover: {{keyPoints}}

STORY SO FAR (summary):
{{runningSummary}}

PREVIOUS SECTION ENDED WITH:
"{{lastParagraph}}"

ALREADY COVERED (do not re-explain):
{{coveredTopics as bullet list}}

Continue the script naturally. Output JSON with sentences array.
Each sentence needs: text, imagePrompt, videoPrompt.
```

---

## Implementation Plan

### Task Breakdown

| Task | Description | Est. Hours |
|------|-------------|------------|
| 1 | Add `script_outlines` table and migrate | 1 |
| 2 | Extend `generation_jobs` with step tracking | 0.5 |
| 3 | Add `generateOutline()` to DeepseekClient | 2 |
| 4 | Add `generateSectionWithContext()` to DeepseekClient | 3 |
| 5 | Add `compressSummary()` to DeepseekClient | 1 |
| 6 | Create Inngest function for long-form generation | 4 |
| 7 | Add API endpoints (outline, generate, SSE progress) | 3 |
| 8 | Write unit tests for new DeepseekClient methods | 2 |
| 9 | Write integration tests for full generation flow | 2 |
| 10 | Update frontend for outline review (optional) | 3 |
| **Total** | | **21.5 hours** |

### Implementation Order

```
Phase 1: Core Backend (Tasks 1-6)
├── Database schema changes
├── DeepseekClient extensions
└── Inngest long-form generation function

Phase 2: API Layer (Task 7)
├── Outline generation endpoint
├── Script generation endpoint
└── SSE progress streaming

Phase 3: Testing (Tasks 8-9)
├── Unit tests for client methods
└── Integration tests for full flow

Phase 4: Frontend (Task 10) [Can be separate story]
├── Outline review modal
└── Progress display component
```

---

## Acceptance Criteria

### Must Have

- [ ] Can generate script outlines for 1-180 minute videos
- [ ] Can generate full scripts using section-by-section approach
- [ ] Running summary prevents repetition across sections
- [ ] Progress updates available via API during generation
- [ ] Each section saved to database immediately after generation
- [ ] Generation can be resumed if interrupted (via outline state)
- [ ] Existing `script/generate` event still works for short scripts (<10 min)

### Should Have

- [ ] SSE endpoint streams real-time progress
- [ ] "Outline-first" mode allows user review before generation
- [ ] Individual sections can be regenerated without full script regeneration

### Could Have

- [ ] Cancel in-progress generation
- [ ] Edit outline before generation (add/remove/reorder sections)
- [ ] Parallel generation of non-dependent content (images while next section generates)

---

## Test Plan

### Unit Tests

```typescript
describe('DeepseekClient - Long Form', () => {
  describe('generateOutline', () => {
    it('generates outline with correct section count for duration');
    it('allocates time proportionally across sections');
    it('handles 1-minute scripts (single section)');
    it('handles 180-minute scripts (20+ sections)');
  });

  describe('generateSectionWithContext', () => {
    it('includes running summary in prompt');
    it('includes previous section ending for continuity');
    it('respects covered topics list');
    it('generates correct sentence count for target duration');
  });

  describe('compressSummary', () => {
    it('keeps summary under max word limit');
    it('preserves key facts and entities');
    it('combines previous summary with new content');
  });
});
```

### Integration Tests

```typescript
describe('Long-Form Script Generation', () => {
  it('generates 30-minute script with 4 sections');
  it('generates 2-hour script with 15 sections');
  it('updates progress in database during generation');
  it('saves each section immediately after generation');
  it('can resume generation from saved outline state');
  it('prevents repetition across sections');
});
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Deepseek rate limits during long generation | Medium | High | Add exponential backoff, respect rate limits |
| Running summary loses important details | Medium | Medium | Test with real scripts, tune compression prompt |
| Generation interrupted loses progress | Low | High | Save state after each section, enable resume |
| Cost exceeds estimates for very long scripts | Low | Low | Add cost estimation before generation |

---

## Dependencies

- **STORY-005**: Deepseek API Client (completed)
- **Inngest**: Already configured and working
- **Database**: Drizzle ORM already set up

---

## Open Questions

1. **Q**: Should outline generation be a separate billable operation, or bundled with script generation?
   **A**: Bundle it - outline is ~2% of total cost

2. **Q**: Maximum supported duration?
   **A**: 3 hours (can be extended later if needed)

3. **Q**: Should we support editing the outline before generation?
   **A**: Yes, as "should have" - user can review and approve outline

---

## References

- [Research Report: Long-Form Script Generation](./research-long-form-script-generation.md)
- [LongWriter Paper (ICLR 2025)](https://github.com/THUDM/LongWriter)
- [DOME: Dynamic Hierarchical Outlining](https://arxiv.org/html/2412.13575)

---

*Created by BMAD Method - Product Manager*
