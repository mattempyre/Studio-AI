# UX Design: AI-Assisted Section Expansion

**Feature:** AI-powered sentence generation for script sections
**Date:** 2026-01-17
**Version:** 1.0

---

## Overview

Enable users to expand script sections using AI, with context-aware generation based on existing section content. Supports both automatic generation and user-guided prompts.

---

## User Flows

### Flow 1: Section-Level AI Expansion

**Entry Point:** Section header "Expand with AI" button

```
[Section Header with AI Button]
         ↓ Click
[AI Expansion Popover]
         ↓
   ┌─────┴─────┐
   ↓           ↓
[Quick]    [Guided]
   ↓           ↓
[Generate]  [User enters prompt]
   ↓           ↓
[Preview generated sentences]
         ↓
   ┌─────┴─────┐
   ↓           ↓
[Accept]   [Regenerate/Edit]
   ↓
[Sentences added to section]
```

### Flow 2: Sentence-Level AI Expansion

**Entry Point:** Hover between sentences → "Add with AI" button

```
[Hover between sentences]
         ↓
[+ Add with AI button appears]
         ↓ Click
[AI Expansion Popover (anchored to position)]
         ↓
[Same flow as section-level...]
         ↓
[Sentences inserted at position]
```

---

## Wireframes

### 1. Section Header with AI Button

```
┌─────────────────────────────────────────────────────────────────────┐
│ ▼ SECTION 01  The Birth of a Bean                    5 sentences 🗑 │
│   ├────────────────────────────────────────────────────────────────│
│   │                                                                 │
│   │   [✨ Expand with AI]  ← NEW: AI trigger button                │
│   │                                                                 │
├───┴─────────────────────────────────────────────────────────────────┤
│ 01  Our story begins high in the mountains...                       │
│     PENDING  ● ● ●                                                  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│ 02  Inside each bright red cherry lies the precious seed...         │
│     PENDING  ● ● ●                                                  │
```

**Styling:**
- Button: Ghost style with sparkle icon (✨)
- Text: "Expand with AI"
- Position: Below section header, above first sentence
- Color: Primary accent with subtle glow on hover

---

### 2. Sentence-Level AI Trigger (Between Sentences)

```
│ 01  Our story begins high in the mountains...                       │
│     PENDING  ● ● ●                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                    [+ Add]  [✨ Add with AI]  ← Hover reveal        │
├─────────────────────────────────────────────────────────────────────┤
│ 02  Inside each bright red cherry lies the precious seed...         │
│     PENDING  ● ● ●                                                  │
```

**Behavior:**
- Shows on hover between sentences (alongside existing "+ Add" button)
- Compact pill button with sparkle icon
- Tooltip: "Generate sentences with AI"

---

### 3. AI Expansion Popover/Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Expand Section with AI                                      [X]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Section Context:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ "The Birth of a Bean" - 5 sentences about coffee origins,   │   │
│  │ mountains, cherries, and harvesting process.                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Generation Mode:                                                   │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │ ⚡ Quick Generate │  │ 💬 Guided        │  ← Tab toggle          │
│  │   (selected)     │  │                  │                        │
│  └──────────────────┘  └──────────────────┘                        │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Number of sentences:                                               │
│  [ 1 ]  [ 2 ]  [ 3 ]  [ 5 ]  ← Pill toggle, 2 selected            │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Position: ○ End of section  ○ After sentence #__  ← Radio options │
│                                                                     │
│                                        [Cancel]  [✨ Generate]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. Guided Mode (with Prompt Input)

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Expand Section with AI                                      [X]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Section Context: "The Birth of a Bean" - 5 sentences               │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Generation Mode:                                                   │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │ ⚡ Quick Generate │  │ 💬 Guided        │                        │
│  │                  │  │   (selected)     │                        │
│  └──────────────────┘  └──────────────────┘                        │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  What should the AI focus on?                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Add more detail about the different varieties of coffee     │   │
│  │ beans and how altitude affects flavor...                    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Placeholder: "e.g., Add more detail about X, Explain the          │
│               process of Y, Include a fun fact about Z"            │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Suggestions:  [+ Add detail] [+ Add example] [+ Add transition]   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Number of sentences: [ 1 ]  [ 2 ]  [ 3 ]  [ 5 ]                   │
│                                                                     │
│                                        [Cancel]  [✨ Generate]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Prompt Suggestions (chips):**
- "Add more detail" - Expands on existing content
- "Add example" - Adds concrete examples
- "Add transition" - Creates smooth flow between ideas
- "Add fun fact" - Injects engaging information
- "Summarize" - Creates summary sentence

---

### 5. Generation Loading State

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Generating sentences...                                     [X]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│                                                                     │
│                         ┌─────────────┐                            │
│                         │   ✨ ✨ ✨   │                            │
│                         │  Thinking   │                            │
│                         │    ....     │                            │
│                         └─────────────┘                            │
│                                                                     │
│            Analyzing section context and generating                 │
│            2 sentences based on your request...                     │
│                                                                     │
│                             [Cancel]                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 6. Preview Generated Sentences

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Generated Sentences                                         [X]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Preview (2 sentences):                                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ✨ Arabica beans, grown at higher altitudes, develop a      │   │
│  │    more complex flavor profile with delicate acidity.       │   │
│  │                                           [Edit] [Remove]   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ ✨ Meanwhile, Robusta beans thrive in lower regions and     │   │
│  │    offer a bolder, more bitter taste.                       │   │
│  │                                           [Edit] [Remove]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  Will be added: End of "The Birth of a Bean"                       │
│                                                                     │
│              [🔄 Regenerate]  [Cancel]  [✅ Accept & Add]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Preview Features:**
- Each sentence editable inline before accepting
- Individual remove button per sentence
- "Regenerate" to try again with same parameters
- "Accept & Add" inserts all sentences

---

### 7. Inline Edit in Preview

```
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ┌───────────────────────────────────────────────────────┐   │   │
│  │ │ Arabica beans, grown at higher altitudes, develop     │   │   │
│  │ │ a more complex flavor profile with notes of fruit     │   │   │
│  │ │ and a delicate acidity that coffee lovers prize.      │   │   │
│  │ └───────────────────────────────────────────────────────┘   │   │
│  │                                    [✓ Confirm] [✗ Cancel]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
```

---

## Component Specifications

### AI Expand Button (Section Header)

```tsx
interface AIExpandButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

// Styling
- Background: transparent
- Border: 1px dashed primary/40
- Text: primary color, 12px font
- Icon: Sparkles (✨) 14px
- Padding: 8px 16px
- Border-radius: 8px
- Hover: bg-primary/10, border-primary/60
- Loading: pulse animation on icon
```

### AI Expand Button (Between Sentences)

```tsx
interface AIAddButtonProps {
  afterSentenceIndex: number;
  onClick: () => void;
}

// Styling
- Background: primary/10
- Text: primary color, 10px font
- Icon: Sparkles 10px
- Padding: 4px 12px
- Border-radius: 999px (pill)
- Opacity: 0 → 1 on row hover
- Transition: opacity 200ms
```

### AI Expansion Modal/Popover

```tsx
interface AIExpansionModalProps {
  isOpen: boolean;
  onClose: () => void;
  section: BackendSection;
  insertAfterIndex?: number; // undefined = end of section
  onGenerate: (params: GenerateParams) => void;
}

interface GenerateParams {
  mode: 'quick' | 'guided';
  prompt?: string; // For guided mode
  sentenceCount: 1 | 2 | 3 | 5;
  insertPosition: 'end' | number; // number = after sentence index
}
```

### Preview Modal

```tsx
interface AIPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  generatedSentences: string[];
  section: BackendSection;
  insertPosition: 'end' | number;
  onAccept: (sentences: string[]) => void;
  onRegenerate: () => void;
  onEditSentence: (index: number, text: string) => void;
  onRemoveSentence: (index: number) => void;
}
```

---

## API Integration

### Backend Endpoint (New)

```typescript
// POST /api/v1/sections/:sectionId/ai-expand
interface AIExpandRequest {
  mode: 'quick' | 'guided';
  prompt?: string;
  sentenceCount: number;
  insertAfterSentenceId?: string; // null = end
}

interface AIExpandResponse {
  success: boolean;
  data: {
    generatedSentences: Array<{
      text: string;
      imagePrompt?: string;
      videoPrompt?: string;
    }>;
  };
}
```

### Context Sent to LLM

```typescript
interface AIExpansionContext {
  // Full section context
  sectionTitle: string;
  existingSentences: string[];

  // Project context
  projectTopic: string;
  visualStyle: string;
  targetDuration: number;

  // Generation params
  mode: 'quick' | 'guided';
  userPrompt?: string;
  requestedCount: number;
  insertPosition: number; // sentence index or -1 for end

  // Surrounding context for continuity
  previousSentence?: string;
  nextSentence?: string;
}
```

---

## User Experience Details

### Quick Generate Mode
- **Behavior:** One-click generation based on section context
- **AI Prompt (internal):** "Continue this section naturally, maintaining the same tone and style. Generate {n} sentences that flow from the existing content."
- **Best for:** Fast expansion, maintaining consistency

### Guided Mode
- **Behavior:** User provides specific instruction
- **AI Prompt (internal):** "Based on the section context and user instruction: '{prompt}', generate {n} sentences."
- **Best for:** Specific additions, creative control

### Position Selection
- **End of section (default):** Appends new sentences
- **After specific sentence:** Inserts at position, useful for filling gaps

### Sentence Count Options
- **1 sentence:** Precise additions
- **2 sentences:** Balanced (recommended default)
- **3 sentences:** Paragraph-level expansion
- **5 sentences:** Major expansion

---

## Accessibility

- Modal has `role="dialog"`, `aria-modal="true"`
- Focus trapped inside modal when open
- Escape key closes modal
- Tab order: Mode toggle → Prompt (if guided) → Count → Position → Cancel → Generate
- Screen reader: "AI Expansion dialog, generate sentences for section {name}"
- Loading state: `aria-busy="true"`, live region announces progress
- Generated sentences: Announced via `aria-live="polite"`

---

## States & Feedback

| State | Visual | User Feedback |
|-------|--------|---------------|
| Idle | Button visible | - |
| Hover | Button highlighted | Tooltip: "Expand with AI" |
| Modal open | Overlay + modal | Focus moves to modal |
| Generating | Spinner, disabled inputs | "Generating X sentences..." |
| Success | Preview with sentences | "Generated X sentences" |
| Error | Error message | "Failed to generate. Try again." |
| Editing preview | Inline textarea | Standard edit mode |
| Accepting | Brief loading | Sentences appear in section |

---

## Implementation Priority

### Phase 1: Core Flow
1. AI Expand button in section header
2. Basic modal with quick generate mode
3. Preview and accept flow
4. Backend endpoint for AI generation

### Phase 2: Enhanced Controls
5. Sentence count selector
6. Guided mode with prompt input
7. Prompt suggestion chips
8. Position selector (end vs after sentence)

### Phase 3: Polish
9. Between-sentence AI trigger
10. Inline editing in preview
11. Regenerate functionality
12. Animation and loading states

---

## Mockup Summary

```
SECTION HEADER:
┌──────────────────────────────────────────────────┐
│ ▼ SECTION 01  Title                   5 sent 🗑  │
│   [✨ Expand with AI]  ← Primary trigger         │
└──────────────────────────────────────────────────┘

BETWEEN SENTENCES (on hover):
│ Sentence 1 text...                               │
├──────────────────────────────────────────────────┤
│           [+ Add]  [✨ Add with AI]              │
├──────────────────────────────────────────────────┤
│ Sentence 2 text...                               │

MODAL FLOW:
[Trigger] → [Modal: Mode + Count + Position] → [Loading] → [Preview] → [Accept]
```

---

*Generated by BMAD Method - UX Designer*
