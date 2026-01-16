# Research Report: Long-Form Script Generation (2+ Hours)

**Date:** 2026-01-16
**Research Type:** Technical Research
**Duration:** ~45 minutes

## Executive Summary

Generating coherent 2+ hour video scripts (18,000+ words at 150 wpm) is achievable using a combination of **hierarchical outline generation**, **sliding context with recursive summarization**, and **memory-enhanced generation**. The research identifies 5 proven patterns from recent academic work (2024-2025) that can be adapted for your Deepseek-based script generation system.

Key findings:
- Current LLMs cap output at ~2,000 words per call due to training data limitations, not context window size
- The **AgentWrite** pattern (divide-and-conquer) successfully generates 20,000+ word outputs
- **Recursive summarization** prevents repetition by maintaining compressed memory of previous content
- **DOME's memory module** reduces content conflicts by 87.6% using structured knowledge extraction

## Research Questions Answered

### Q1: What patterns exist for generating coherent long-form content with LLMs?

**Answer:** Five primary patterns have emerged:

| Pattern | Description | Best For | Source |
|---------|-------------|----------|--------|
| **AgentWrite** | Divide task into paragraph-level subtasks, execute sequentially | 10K-30K words | [LongWriter](https://github.com/THUDM/LongWriter) |
| **DOME** | Dynamic hierarchical outlining with memory-enhanced generation | Novel-length fiction | [arXiv 2412.13575](https://arxiv.org/html/2412.13575) |
| **Plan-and-Write** | Structure-guided planning with word budget allocation | Precise length control | [arXiv 2511.01807](https://arxiv.org/html/2511.01807v1) |
| **Hierarchical Expansion** | High-level → section → paragraph progressive expansion | Educational/technical content | [OpenCredo](https://www.opencredo.com/blogs/how-to-use-llms-to-generate-coherent-long-form-content-using-hierarchical-expansion) |
| **Recursive Summarization** | Compress history into running summary, feed to next generation | Dialogue/conversational | [arXiv 2308.15022](https://arxiv.org/abs/2308.15022) |

**Confidence:** High

---

### Q2: How do you maintain narrative consistency across many sections?

**Answer:** Three complementary techniques:

1. **Outline-First Generation**: Generate full outline before any content. The outline serves as a "contract" that all sections must fulfill.

2. **Context Bridging**: Feed the last 1-2 paragraphs of the previous section plus a summary of earlier content when generating each new section.

3. **Memory Modules**: Extract key entities, events, and facts into structured storage (like knowledge graphs), then retrieve relevant items for each section.

DOME's research shows that "LLMs tend to ignore information in the middle of long inputs" - so rather than feeding all previous content, structured extraction + retrieval works better.

**Confidence:** High

---

### Q3: What techniques prevent repetition when context windows are limited?

**Answer:**

1. **Recursive Summarization**: After generating each section, summarize it and append to a running "memory" summary. Discard full text, keep summary. This prevents the model from seeing (and repeating) the same verbose content.

2. **Entity Tracking**: Maintain a list of "already covered topics/facts" and include this in the prompt as "DO NOT repeat these points: [list]".

3. **Temporal Knowledge Graphs**: DOME uses quadruples (subject, action, object, chapter_index) to track what happened when. When generating new content, retrieve relevant history but filter out redundant information.

4. **Explicit Anti-Repetition Instructions**: Include in system prompt: "The following topics have already been covered in previous sections. Reference them if needed but do not re-explain: [summary]"

**Confidence:** High

---

### Q4: How do outline-first approaches compare to linear generation?

**Answer:**

| Approach | Pros | Cons |
|----------|------|------|
| **Outline-First** | Better coherence, predictable structure, easier to parallelize | Extra API calls, outline quality affects all content |
| **Linear Generation** | Simpler implementation, natural flow | Drift, repetition, unpredictable length |

Research strongly favors outline-first for long content. The [LongWriter paper](https://arxiv.org/abs/2408.07055) found that breaking into planned paragraphs enabled 10x longer coherent output.

**Confidence:** High

---

### Q5: What memory/summarization strategies work for multi-section content?

**Answer:**

**Tiered Memory Strategy (Recommended):**
```
┌─────────────────────────────────────────────────────┐
│ FULL OUTLINE (always included)                      │
│ - All section titles and brief descriptions        │
│ - Target duration/word count per section           │
├─────────────────────────────────────────────────────┤
│ RUNNING SUMMARY (compressed, ~500 words max)        │
│ - Key points covered so far                        │
│ - Main entities/characters introduced              │
│ - Important facts/statistics mentioned             │
├─────────────────────────────────────────────────────┤
│ PREVIOUS SECTION (last 2-3 paragraphs, verbatim)   │
│ - Provides natural transition context              │
│ - Maintains voice/style consistency                │
├─────────────────────────────────────────────────────┤
│ CURRENT SECTION TASK                                │
│ - Section title and goals from outline             │
│ - Target word count for this section               │
│ - Any specific requirements                         │
└─────────────────────────────────────────────────────┘
```

**Confidence:** High

---

### Q6: Are there existing tools for long-form video script generation?

**Answer:**

**Academic/Open Source:**
- [LongWriter](https://github.com/THUDM/LongWriter) - ICLR 2025, models available
- [DOME](https://arxiv.org/html/2412.13575) - NAACL 2025, story generation
- [WritingPath](https://arxiv.org/html/2404.13919v1) - Outline-guided framework

**Commercial APIs:**
- Deepseek's `deepseek-chat` model supports up to 64K context
- Claude 3.5/4 supports 200K context (but output still limited)
- GPT-4 Turbo supports 128K context

No existing tool specifically addresses video scripts with per-sentence image/video prompts at 2+ hour scale. This is a novel use case.

**Confidence:** High

---

## Recommended Architecture for Studio-AI

Based on research, here's the recommended pattern combining **AgentWrite + Recursive Summarization**:

### Phase 1: Outline Generation

```typescript
interface ScriptOutline {
  title: string;
  totalTargetMinutes: number;
  sections: SectionOutline[];
}

interface SectionOutline {
  index: number;
  title: string;
  description: string;           // 2-3 sentence summary of section
  targetMinutes: number;         // Duration for this section
  keyPoints: string[];           // 3-5 bullet points to cover
  transitionFrom?: string;       // How to connect from previous
}
```

**API Call 1:** Generate outline only
- Input: Topic, total duration, visual style
- Output: Full section-by-section outline with time allocation
- Single call, ~1000 tokens output

### Phase 2: Section-by-Section Generation

For each section in outline:

```typescript
interface SectionContext {
  outline: ScriptOutline;              // Always include full outline
  currentSectionIndex: number;
  runningSummary: string;              // Compressed summary so far (~500 words)
  previousSectionEnding: string;       // Last 2-3 paragraphs verbatim
  coveredTopics: string[];             // List of already-explained concepts
}
```

**API Call per section:**
- Input: Section context + section outline
- Output: Full section with sentences, image prompts, video prompts
- After generation: Update running summary, extract covered topics

### Phase 3: Summary Update (After Each Section)

```typescript
async function updateRunningSummary(
  previousSummary: string,
  newSection: GeneratedSection
): Promise<string> {
  // Call Deepseek to compress:
  // "Given the previous summary and new content, create updated summary"
  // Keep under 500 words
}
```

### Flow Diagram

```
┌──────────────────┐
│  User Input      │
│  - Topic         │
│  - Duration      │
│  - Style         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Generate Outline │ ◄── Single API call
│ (10-20 sections) │
└────────┬─────────┘
         │
         ▼
    ┌────────────────────────────────────────────┐
    │         FOR EACH SECTION                    │
    │  ┌─────────────────────────────────────┐   │
    │  │ Build Context                        │   │
    │  │ - Full outline                       │   │
    │  │ - Running summary                    │   │
    │  │ - Previous section ending            │   │
    │  │ - Covered topics list                │   │
    │  └──────────────┬──────────────────────┘   │
    │                 │                          │
    │                 ▼                          │
    │  ┌─────────────────────────────────────┐   │
    │  │ Generate Section Content            │◄──┼── API call
    │  │ - Sentences with narration          │   │
    │  │ - Image prompts                     │   │
    │  │ - Video prompts                     │   │
    │  └──────────────┬──────────────────────┘   │
    │                 │                          │
    │                 ▼                          │
    │  ┌─────────────────────────────────────┐   │
    │  │ Update Memory                        │◄──┼── API call (optional)
    │  │ - Compress into running summary     │   │
    │  │ - Extract covered topics            │   │
    │  └──────────────┬──────────────────────┘   │
    │                 │                          │
    └────────────────┼───────────────────────────┘
                     │
                     ▼
         ┌───────────────────┐
         │ Combine All       │
         │ Sections          │
         └───────────────────┘
```

### Estimated API Calls for 2-Hour Script

| Phase | Calls | Tokens/Call | Total Tokens |
|-------|-------|-------------|--------------|
| Outline | 1 | ~2,000 | 2,000 |
| Sections (15-20) | 20 | ~4,000 | 80,000 |
| Summary Updates | 20 | ~1,000 | 20,000 |
| **Total** | **41** | - | **~102,000** |

At Deepseek pricing (~$0.14/1M input, $0.28/1M output), total cost: **~$0.03-0.05** per 2-hour script.

---

## Key Implementation Recommendations

### 1. Immediate Actions

1. **Add `generateOutline()` method** to DeepseekClient
   - Takes topic, duration, style
   - Returns structured outline with section targets

2. **Add `generateSectionWithContext()` method**
   - Takes outline, section index, running summary, previous ending
   - Returns section content

3. **Add `compressSummary()` method**
   - Takes current summary + new section
   - Returns updated compressed summary

### 2. Short-term (Database Changes)

1. **Store outline separately** from generated content
   - Enables regenerating individual sections
   - Supports editing outline before generation

2. **Track generation state**
   - Which sections are complete
   - Current running summary
   - Enable pause/resume of long generations

### 3. Anti-Repetition Prompt Engineering

Include in section generation prompt:
```
PREVIOUSLY COVERED (do not re-explain):
{{coveredTopics as bullet list}}

CONTINUITY:
The previous section ended with: "{{lastParagraph}}"
Continue naturally from this point.

AVOID:
- Re-introducing concepts from the list above
- Repeating statistics or facts already mentioned
- Using the same examples as previous sections
```

---

## Research Gaps

**What we still don't know:**
- Optimal section length for video scripts (academic work focused on novels/articles)
- Best practices for image/video prompt consistency across long scripts
- Whether Deepseek specifically handles long-context generation well vs other models

**Recommended follow-up:**
- Benchmark Deepseek vs Claude for section generation quality
- Test with actual 2-hour script and measure repetition rate
- Evaluate memory compression quality over 20+ sections

---

## Sources

1. [LongWriter: Unleashing 10,000+ Word Generation](https://github.com/THUDM/LongWriter) - ICLR 2025
2. [DOME: Dynamic Hierarchical Outlining with Memory-Enhancement](https://arxiv.org/html/2412.13575) - NAACL 2025
3. [Recursively Summarizing Enables Long-Term Dialogue Memory](https://arxiv.org/abs/2308.15022) - 2023
4. [Plan-and-Write: Structure-Guided Length Control](https://arxiv.org/html/2511.01807v1) - 2025
5. [WritingPath: Outline-guided Text Generation](https://arxiv.org/html/2404.13919v1) - NAACL 2024
6. [Hierarchical Expansion for Long-Form Content](https://www.opencredo.com/blogs/how-to-use-llms-to-generate-coherent-long-form-content-using-hierarchical-expansion) - OpenCredo
7. [Context Window Management Strategies](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots) - Maxim AI
8. [Information Distortion in Hierarchical Novel Generation](https://arxiv.org/html/2505.12572v1) - 2025

---

*Generated by BMAD Method v6 - Creative Intelligence*
*Research Duration: ~45 minutes*
*Sources Consulted: 15+*
