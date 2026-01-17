# 🧩 Component Inventory - VideoGen AI Studio

The VideoGen AI Studio UI is built using **React 19** with a focus on high-performance, complex state management.

## 🏗️ Core Studio Components

### 📝 Script Editor (V2)
- **Folder**: `components/ScriptEditorV2/`
- **Purpose**: A tree-based editor for long-form script management.
- **Key Features**: Section dragging, character assignment, AI expansion triggers.

### 🎬 Storyboard & Preview
- **Files**: `Storyboard.tsx`, `VideoPreview.tsx`, `VoiceOver.tsx`
- **Purpose**: Visual asset management and timeline playback.
- **Key Features**: Live preview player for Gemini/Veo generated media.

### 👤 Character System
- **Folder**: `components/CharacterLibrary/`
- **Purpose**: UI for managing the "Cast" of a project.
- **Key Features**: Reference image uploads and LoRA style selection.

## 🛠️ Management & Settings
- **`Dashboard.tsx`**: Main project management view with project grid.
- **`Layout.tsx`**: High-level application shell with sidebar and navigation.
- **`ProjectSettings/`**: Modal system for global project configuration (Topic, Duration, Style).
- **`ThemeSelector.tsx`**: Custom UI theme switcher.

## 🤖 AI Interaction Modals
- **`AIExpansionModal.tsx`**: The guided interface for AI script expansion.
- **`AIPreviewModal.tsx`**: Snapshot previewer for generated script segments.

## 🧱 Atoms & Utilities
- **`Icons.tsx`**: Centralized Lucide icon mapping.
- **`Auth.tsx`**: User session and API key management.
- **`Sidebar/`**: Navigation and project selection components.
