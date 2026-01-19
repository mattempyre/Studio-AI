import { Inngest, EventSchemas } from 'inngest';

// Define all event types for the application
export type StudioEvents = {
  // Test event for verifying Inngest setup
  'test/hello': {
    data: {
      message: string;
    };
  };

  // Script generation events (short-form, <10 min)
  'script/generate': {
    data: {
      projectId: string;
      topic: string;
      targetDuration: number;
      useSearch: boolean;
    };
  };
  'script/completed': {
    data: {
      projectId: string;
      sectionCount: number;
      sentenceCount: number;
    };
  };

  // Long-form script generation events (10+ min, up to 3 hours)
  'script/generate-long': {
    data: {
      projectId: string;
      outlineId?: string; // If using existing outline (from-outline mode)
      topic: string;
      targetDurationMinutes: number;
      visualStyle: string;
      mode: 'auto' | 'from-outline';
    };
  };
  'script/outline-generated': {
    data: {
      projectId: string;
      outlineId: string;
      sectionCount: number;
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
  'script/long-completed': {
    data: {
      projectId: string;
      outlineId: string;
      totalSections: number;
      totalSentences: number;
      totalDurationMinutes: number;
    };
  };

  // Audio generation events (per-sentence)
  'audio/generate': {
    data: {
      sentenceId: string;
      projectId: string;
      text: string;
      voiceId: string;
    };
  };
  'audio/completed': {
    data: {
      sentenceId: string;
      projectId: string;
      audioFile: string;
      duration: number;
    };
  };

  // Section-level audio generation (batch mode with Whisper alignment)
  'audio/generate-section': {
    data: {
      sectionId: string;
      projectId: string;
      voiceId: string;
      sentenceTexts: Array<{
        sentenceId: string;
        text: string;
        order: number;
      }>;
    };
  };
  'audio/section-completed': {
    data: {
      sectionId: string;
      projectId: string;
      audioFile: string;
      totalDuration: number;
      sentenceTimings: Array<{
        sentenceId: string;
        startMs: number;
        endMs: number;
      }>;
    };
  };

  // Retroactive audio alignment (align existing audio to sentences using Whisper)
  'audio/retroactive-align': {
    data: {
      sectionId: string;
      projectId: string;
      audioFile: string; // Path to existing section audio file
      sentenceTexts: Array<{
        sentenceId: string;
        text: string;
        order: number;
      }>;
    };
  };
  'audio/retroactive-align-completed': {
    data: {
      sectionId: string;
      projectId: string;
      sentenceCount: number;
    };
  };

  // Image prompt generation events
  'prompts/generate-image': {
    data: {
      projectId: string;
      sentenceIds?: string[];  // Optional: specific sentences to generate prompts for
      force?: boolean;         // If true, regenerate even if prompt exists
    };
  };
  'prompts/generate-image-completed': {
    data: {
      projectId: string;
      total: number;
      generated: number;
    };
  };

  // Video prompt generation events
  'prompts/generate-video': {
    data: {
      projectId: string;
      sentenceIds?: string[];  // Optional: specific sentences to generate prompts for
      force?: boolean;         // If true, regenerate even if prompt exists
    };
  };
  'prompts/generate-video-completed': {
    data: {
      projectId: string;
      total: number;
      generated: number;
    };
  };

  // Image generation events
  'image/generate': {
    data: {
      sentenceId: string;
      projectId: string;
      prompt: string;
      style?: string;                 // Legacy: visual style ID (for backwards compatibility)
      modelId?: string;               // New: generation model ID from database
      styleId?: string;               // New: visual style ID from database
      characterRefs?: string[];       // Character IDs from project cast
      useImageToImage?: boolean;      // Use img2img workflow with character reference
      seed?: number;
      steps?: number;
      cfg?: number;
    };
  };
  'image/completed': {
    data: {
      sentenceId: string;
      projectId: string;
      imageFile: string;
    };
  };

  // Image editing events (inpainting)
  'image/edit': {
    data: {
      sentenceId: string;
      projectId: string;
      sourceImagePath: string;      // Path to original image to edit
      editPrompt: string;           // Prompt describing desired changes
      editMode: 'full' | 'inpaint'; // Full image edit or selective (masked) edit
      maskImageBase64?: string;     // Base64 PNG with red channel mask (for inpaint mode)
      seed?: number;
      steps?: number;
    };
  };
  'image/edit-completed': {
    data: {
      sentenceId: string;
      projectId: string;
      imageFile: string;            // Path to edited image
    };
  };

  // Batch image generation (model-aware batching to minimize model reloads)
  'image/generate-batch': {
    data: {
      batchId: string;               // Unique batch identifier
      projectId: string;
      modelId: string;               // All sentences in batch use same model
      styleId: string;               // All sentences in batch use same style
      sentences: Array<{
        sentenceId: string;
        prompt: string;
        characterRefs?: string[];    // Per-sentence character references
        useImageToImage?: boolean;
        seed?: number;
      }>;
    };
  };
  'image/batch-completed': {
    data: {
      batchId: string;
      projectId: string;
      completed: number;
      failed: number;
      results: Array<{
        sentenceId: string;
        status: 'completed' | 'failed';
        imageFile?: string;
        error?: string;
      }>;
    };
  };

  // Video generation events
  'video/generate': {
    data: {
      sentenceId: string;
      projectId: string;
      imageFile: string;
      prompt: string;
      cameraMovement: string;
      motionStrength: number;
    };
  };
  'video/completed': {
    data: {
      sentenceId: string;
      projectId: string;
      videoFile: string;
    };
  };

  // Bulk generation events
  'project/generate-all': {
    data: {
      projectId: string;
    };
  };

  // Export events
  'export/start': {
    data: {
      projectId: string;
    };
  };
  'export/completed': {
    data: {
      projectId: string;
      exportFile: string;
    };
  };
};

// Get dev server URL from environment for local development
const isDev = process.env.NODE_ENV !== 'production';
const baseUrl = process.env.INNGEST_DEV_SERVER || 'http://localhost:8288';

// Create the Inngest client with typed events
export const inngest = new Inngest({
  id: 'videogen-ai-studio',
  schemas: new EventSchemas().fromRecord<StudioEvents>(),
  // In development, tell Inngest to send events to the local dev server
  // baseUrl is required for inngest.send() to know where to deliver events
  ...(isDev && { isDev: true, baseUrl }),
});
