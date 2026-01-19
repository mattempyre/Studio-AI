---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
inputDocuments:
  - _bmad-output/implementation-artifacts/4-3-prompt-display-storyboard.md
  - docs/architecture-videogen-ai-studio-2026-01-17.md
  - docs/ux-ai-section-expansion.md
  - docs/component-inventory.md
---

# UX Design Specification: Studio-AI

**Feature:** Story 4.3 - Prompt Display in Storyboard
**Author:** Matt
**Date:** 2026-01-19

---

## Executive Summary

### Project Vision

Story 4.3 adds **persistent prompt visibility** to the Storyboard component, enabling creators to review AI-generated image and video prompts before triggering bulk generation. This transforms the Storyboard from a visual preview tool into a comprehensive pre-generation review interface.

The prompts are read-only in this story - editing capability comes in Story 4-5. The focus is purely on visibility and scanability.

### Target Users

**Creators** using VideoGen AI Studio to produce AI-generated videos. They need to:
- Review what AI will generate before triggering bulk generation
- Quickly scan prompts across all scenes for consistency
- Identify missing or poor prompts before committing to generation
- Understand camera movement choices at a glance

### Key Design Challenges

1. **Information Density** - Adding prompts increases vertical space per row. Must balance visibility without overwhelming the narration text.

2. **Dual-View Consistency** - Table and Grid views have different spatial constraints. Prompts need appropriate treatment for each.

3. **Truncation UX** - Prompts can be lengthy. Need clear affordance for expansion without disrupting scan flow.

4. **Visual Hierarchy** - Prompts are secondary to narration. Must feel supportive, not competing.

### Design Opportunities

1. **At-a-Glance Review** - Clear prompt visibility enables quick quality checks before expensive generation runs.

2. **Camera Movement Badges** - Visual iconography for movement types creates scannable patterns.

3. **Consistent Design Language** - Build on existing UX patterns from the AI Section Expansion feature (muted text, icon prefixes, pill badges).

## Core User Experience

### Defining Experience

Users need dual-mode interaction: **quick-scan** for identifying missing or problematic prompts, and **deep-review** for reading and evaluating prompt quality. The design must support both seamlessly.

The primary flow is: Review prompts → Identify issues → Proceed to bulk generation or note scenes for editing.

### Platform Strategy

- **Platform:** Web application (React 19)
- **Input:** Mouse/keyboard primary, desktop workflow
- **Context:** Storyboard component within larger video creation pipeline
- **Integration:** Read-only display; editing deferred to Story 4-5

### Effortless Interactions

| Interaction | Design Goal |
|-------------|-------------|
| Spot missing prompts | Empty states visually distinct, not just absent text |
| Expand long prompts | In-place expansion without navigation |
| Understand camera movement | Icon-based badges for instant recognition |
| Compare across scenes | Vertical scanning enabled by consistent layout |

### Critical Success Moments

1. **Confidence to Generate** - User sees all prompts, confirms quality, triggers bulk generation
2. **Quick Issue Identification** - Problem scenes (empty/poor prompts) immediately visible
3. **Style Consistency Check** - Vertical scanning confirms prompts follow consistent tone/style

### Experience Principles

1. **Scan First, Read Second** - Visual patterns for quick scanning; full text for detailed review
2. **Non-Intrusive Visibility** - Prompts visible but subordinate to narration in hierarchy
3. **Progressive Disclosure** - Truncated by default, expandable on interaction
4. **View Consistency** - Same information in Table and Grid, adapted to each layout's strengths

## Desired Emotional Response

### Primary Emotional Goals

| Emotion | Purpose |
|---------|---------|
| **Confidence** | Users know exactly what will be generated before committing |
| **Control** | Full visibility into prompts without navigation |
| **Efficiency** | Quick identification of issues or missing prompts |

### Emotions to Avoid

| Emotion | Prevention Strategy |
|---------|-------------------|
| Overwhelm | Prompts visually subordinate to narration |
| Anxiety | Explicit empty states ("No prompt") vs. ambiguous absence |
| Frustration | In-place expansion, no extra clicks required |

### Emotional Journey

| Stage | Feeling |
|-------|---------|
| First Scan | Clarity - "This is organized" |
| Issue Detection | Efficiency - "I found it quickly" |
| Deep Review | Control - "Easy to expand and read" |
| Pre-Generation | Confidence - "Ready to proceed" |

### Micro-Emotion Balance

- **Confidence** over Confusion
- **Trust** over Skepticism
- **Accomplishment** over Frustration

### Emotional Design Principles

1. **Visibility Builds Confidence** - Show all prompts persistently, not on-demand
2. **Explicit Over Implicit** - Empty states labeled, not just missing
3. **Calm Hierarchy** - Muted styling keeps prompts supportive, not dominant
4. **Effortless Expansion** - One interaction to see full text

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Professional NLEs (DaVinci, Premiere, FCP):**
- Thumbnail + metadata rows pattern for dense, scannable information
- Icon-prefixed labels for quick visual parsing
- Proven layouts for production workflows

**AI Generation Tools (Midjourney, Runway):**
- Prompt always visible alongside generated content
- Clear input→output relationship builds confidence
- Truncation with expansion for long prompts

**Existing App Patterns:**
- AI Section Expansion feature establishes muted text, icon prefixes, pill badges
- Current Storyboard provides Table/Grid foundations to extend

### Transferable UX Patterns

| Pattern | Source | Application |
|---------|--------|-------------|
| Icon-prefixed metadata | AI Section Expansion | Prompt type labels |
| Muted secondary text | Design system | Subordinate prompt text |
| Pill badges | AI Section Expansion | Camera movement indicators |
| Metadata rows | Professional NLEs | Prompt sections below narration |

### Anti-Patterns to Avoid

| Avoid | Reason | Do Instead |
|-------|--------|------------|
| Hover-only visibility | Hides critical info | Always visible |
| Modal expansion | Disrupts context | In-place expansion |
| Equal visual weight | Competes with narration | Muted hierarchy |
| Empty = blank | Ambiguous state | Explicit "No prompt" |

### Design Inspiration Strategy

**Adopt:** Icon-prefixed labels, muted text hierarchy, pill badges
**Adapt:** NLE metadata rows → simplified flex layout for web
**Avoid:** Hover-dependent patterns, modals for simple expansion

## Design System Foundation

### Design System Choice

**Existing System:** React 19 + Tailwind CSS (custom tokens)

This feature extends the established design system. No new system selection needed.

### Design Tokens for Story 4.3

| Element | Tailwind Classes |
|---------|-----------------|
| Prompt Container | `bg-surface-1/50 rounded-md p-2 mt-2` |
| Type Label | `text-text-muted text-[10px] uppercase tracking-wide` |
| Prompt Text | `text-text-secondary text-sm font-mono` |
| Icon Prefix | `text-text-muted mr-1` (size 10-12) |
| Empty State | `text-text-muted italic text-sm` |
| Camera Badge | `bg-surface-2 px-2 py-0.5 rounded text-[10px]` |
| Truncation | `line-clamp-2` with click-to-expand |

### Implementation Approach

- Extend `Storyboard.tsx` directly (prefer minimal file creation)
- Extract `ScenePromptDisplay.tsx` only if complexity warrants
- Reuse component pattern across Table and Grid views
- Follow existing metadata display patterns from inspector panel

### Rationale

1. **Consistency** - Matches existing app visual language
2. **Speed** - No learning curve, tokens already defined
3. **Maintainability** - Single source of truth for styling

## Defining Core Experience

### The Defining Interaction

**"Scan prompts at a glance, confident nothing will surprise me"**

Users can see exactly what AI will generate before committing to bulk generation. This transforms Storyboard from a visual preview into a comprehensive pre-generation review interface.

### User Mental Model

Users expect prompt display to work like **subtitles**:
- Always visible without action
- Never blocking main content
- Scannable without focused attention

**Workflow:** Scroll → Scan → Spot issues → Confident to generate

### Success Criteria

| Criterion | Measure |
|-----------|---------|
| Scannable | Empty prompts identifiable without reading |
| Non-intrusive | Narration remains primary focus |
| Complete | Image, video, camera all visible |
| Expandable | Full text accessible in-place |
| Consistent | Same pattern across Table/Grid |

### Pattern Analysis

**All Established Patterns:**
- Metadata rows below content
- Icon-prefixed labels
- Text truncation with expansion
- Pill badges for tags

No novel patterns needed - pure pattern application.

### Experience Mechanics

| Phase | Design |
|-------|--------|
| Initiation | Prompts visible by default, no trigger |
| Scan | Scroll through, prompts inline |
| Review | Click truncated → expand in-place |
| Issue Detection | Empty = "No prompt generated" (explicit) |
| Completion | Confident to generate OR knows what to fix |

## Visual Design Foundation

### Color System

**Existing Dark Theme Applied:**

| Element | Token |
|---------|-------|
| Container | `bg-surface-1/50` |
| Labels | `text-text-muted` |
| Prompt Text | `text-text-secondary` |
| Empty State | `text-text-muted italic` |
| Badge BG | `bg-surface-2` |

### Typography

| Element | Specification |
|---------|--------------|
| Prompt Label | `text-[10px] font-bold uppercase tracking-wide text-text-muted` |
| Prompt Text | `text-sm font-mono text-text-secondary` |
| Empty State | `text-sm italic text-text-muted` |

**`font-mono` for prompts** distinguishes AI-generated content from human narration.

### Spacing

| Spacing | Value | Use |
|---------|-------|-----|
| Container padding | `p-2` | Prompt section |
| Section gap | `mt-2` | Below narration |
| Row gap | `gap-1.5` | Between prompt types |

---

## Wireframes

### Table View - Scene Row with Prompts

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ①  │ NARRATION SECTION                              │ IMAGE PREVIEW           │
│     │                                                 │ ┌─────────────────────┐ │
│     │  Our story begins high in the mountains of     │ │                     │ │
│     │  Ethiopia, where coffee was first discovered   │ │    [Scene Image]    │ │
│     │  by a curious goat herder named Kaldi...       │ │                     │ │
│     │                                                 │ └─────────────────────┘ │
│     │  ┌─────────────────────────────────────────────┴───────────────────────┐ │
│     │  │ PROMPT DISPLAY SECTION                                              │ │
│     │  │                                                                      │ │
│     │  │  🖼️ IMAGE PROMPT                                                    │ │
│     │  │  Cinematic wide shot of Ethiopian highlands at golden hour,         │ │
│     │  │  terraced coffee farms cascading down misty mountains...  [expand]  │ │
│     │  │                                                                      │ │
│     │  │  🎬 VIDEO PROMPT                     📹 Zoom In (Slow)              │ │
│     │  │  Gentle dolly forward through coffee plants...            [expand]  │ │
│     │  │                                                                      │ │
│     │  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Table View - Empty Prompt State

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ②  │ NARRATION SECTION                              │ IMAGE PREVIEW           │
│     │                                                 │ ┌─────────────────────┐ │
│     │  Inside each bright red cherry lies the        │ │                     │ │
│     │  precious seed that will become your morning   │ │   [Generating...]   │ │
│     │  coffee...                                      │ │                     │ │
│     │                                                 │ └─────────────────────┘ │
│     │  ┌─────────────────────────────────────────────┴───────────────────────┐ │
│     │  │ PROMPT DISPLAY SECTION                                              │ │
│     │  │                                                                      │ │
│     │  │  🖼️ IMAGE PROMPT                                                    │ │
│     │  │  No image prompt generated                                          │ │
│     │  │                                                                      │ │
│     │  │  🎬 VIDEO PROMPT                     📹 Static                      │ │
│     │  │  No video prompt generated                                          │ │
│     │  │                                                                      │ │
│     │  └──────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Grid View - Card with Prompts

```
┌───────────────────────────────────┐
│ ┌───────────────────────────────┐ │
│ │                               │ │
│ │        [Scene Image]          │ │
│ │                               │ │
│ │  ①                            │ │
│ └───────────────────────────────┘ │
│                                   │
│  🎤 NARRATION                     │
│  Our story begins high in the     │
│  mountains of Ethiopia...         │
│                                   │
│  ─────────────────────────────── │
│                                   │
│  🖼️ Cinematic wide shot of       │
│  Ethiopian highlands at golden... │
│                                   │
│  🎬 Gentle dolly forward...       │
│                                   │
│  ─────────────────────────────── │
│  📹 Zoom In    🎨 Cinematic       │
└───────────────────────────────────┘
```

### Expanded Prompt State (Click to Expand)

```
┌──────────────────────────────────────────────────────────────────┐
│  🖼️ IMAGE PROMPT                                        [collapse] │
│                                                                    │
│  Cinematic wide shot of Ethiopian highlands at golden hour,       │
│  terraced coffee farms cascading down misty mountains, ancient    │
│  forest in background, morning mist rising from valleys, warm     │
│  golden light illuminating the scene, ultra-detailed, 8K,         │
│  professional photography, National Geographic style              │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Component Specifications

**ScenePromptDisplay Component:**

```tsx
interface ScenePromptDisplayProps {
  imagePrompt: string | null;
  videoPrompt: string | null;
  cameraMovement: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}
```

**Styling Classes:**

| Element | Classes |
|---------|---------|
| Container | `bg-surface-1/50 rounded-md p-2 mt-2` |
| Prompt Row | `flex items-start gap-2 mb-1.5` |
| Icon | `text-text-muted flex-shrink-0` (size 12) |
| Label | `text-text-muted text-[10px] font-bold uppercase tracking-wide` |
| Text (truncated) | `text-text-secondary text-sm font-mono line-clamp-2` |
| Text (expanded) | `text-text-secondary text-sm font-mono` |
| Empty | `text-text-muted text-sm italic` |
| Camera Badge | `bg-surface-2 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1` |
| Expand Button | `text-text-muted text-[10px] hover:text-white cursor-pointer` |

---

## Implementation Summary

### Files to Modify

| File | Changes |
|------|---------|
| `components/Storyboard.tsx` | Add prompt display section to table rows and grid cards |

### Key Implementation Points

1. **Table View (lines ~207-257):** Add prompt display section below narration textarea
2. **Grid View (lines ~262-329):** Add prompt section between narration and footer
3. **State:** Add `expandedPrompts: Set<string>` for tracking expanded state per scene
4. **Reuse:** Same `ScenePromptDisplay` logic for both views

### Acceptance Criteria Mapping

| AC | Implementation |
|----|----------------|
| AC1: Image prompt below narration | Prompt container with icon + text |
| AC2: Video prompt displayed | Second row in prompt container |
| AC3: Visually distinct | Muted colors, smaller text, icons |
| AC4: Empty placeholder | "No prompt generated" italic text |
| AC5: Read-only | No edit controls (Story 4-5) |
| AC6: Camera movement visible | Badge with icon |
| AC7: Table and Grid views | Same component, different layout |
| AC8: Truncation + expand | `line-clamp-2` + click handler |

---

*UX Design Specification completed for Story 4.3: Prompt Display in Storyboard*
*Generated by BMAD Method - UX Designer*

