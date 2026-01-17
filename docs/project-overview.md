# 🎯 Project Overview - VideoGen AI Studio

VideoGen AI Studio is a state-of-the-art **AI Video Production Platform** designed to transform complex topics into cinematic long-form videos.

## 🎥 The Concept
The studio automates the entire video creation pipeline:
1. **Concept & Brainstorming**: Grounded AI research to build factual foundations.
2. **Scripting**: Multi-stage generation for scripts ranging from 1 to 180 minutes.
3. **Visualization**: Automatic generation of high-fidelity images and motion video clips.
4. **Voiceover**: High-fidelity TTS sync'd to the script.
5. **Timeline**: A professional-grade multi-track editor for final assembly.

## 🛠️ Technology Pillar
- **Frontend**: **React 19** + **Vite** (Layered Component Architecture).
- **Backend**: **Express** + **Drizzle ORM** (TypeScript Monolith).
- **Persistence**: **SQLite** (High-performance local DB).
- **Orchestration**: **Inngest** (Durable background job execution).
- **Intelligence**: **Google Gemini SDK** (Multimodal LLM integration).

## 🏗️ Repository Structure
- **`components/`**: UI logic and interactive studio elements.
- **`src/backend/`**: API endpoints, background jobs, and DB schema.
- **`services/`**: Bridges between frontend, backend, and external AI SDKs.
- **`docs/`**: Central knowledge base and user stories.
