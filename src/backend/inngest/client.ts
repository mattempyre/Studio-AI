import { Inngest, EventSchemas } from 'inngest';

// Define all event types for the application
export type StudioEvents = {
  // Test event for verifying Inngest setup
  'test/hello': {
    data: {
      message: string;
    };
  };

  // Script generation events
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

  // Audio generation events
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

  // Image generation events
  'image/generate': {
    data: {
      sentenceId: string;
      projectId: string;
      prompt: string;
      style: string;
      characterRefs?: string[];
    };
  };
  'image/completed': {
    data: {
      sentenceId: string;
      projectId: string;
      imageFile: string;
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

// Create the Inngest client with typed events
export const inngest = new Inngest({
  id: 'videogen-ai-studio',
  schemas: new EventSchemas().fromRecord<StudioEvents>(),
});
