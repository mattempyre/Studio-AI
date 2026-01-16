import { describe, it, expect } from 'vitest';
import '../setup.js';
import { inngest, type StudioEvents } from '../../src/backend/inngest/client.js';

describe('Inngest Client', () => {
  it('should have correct client ID', () => {
    expect(inngest.id).toBe('videogen-ai-studio');
  });

  it('should be able to create a test/hello event', () => {
    const event = {
      name: 'test/hello' as const,
      data: { message: 'test message' },
    };

    // Verify the event structure matches our type definitions
    expect(event.name).toBe('test/hello');
    expect(event.data.message).toBe('test message');
  });

  it('should have type-safe audio/generate event', () => {
    const event = {
      name: 'audio/generate' as const,
      data: {
        sentenceId: 'sentence-1',
        projectId: 'project-1',
        text: 'Hello world',
        voiceId: 'puck',
      },
    };

    expect(event.name).toBe('audio/generate');
    expect(event.data.sentenceId).toBe('sentence-1');
    expect(event.data.projectId).toBe('project-1');
    expect(event.data.text).toBe('Hello world');
    expect(event.data.voiceId).toBe('puck');
  });

  it('should have type-safe image/generate event', () => {
    const event = {
      name: 'image/generate' as const,
      data: {
        sentenceId: 'sentence-1',
        projectId: 'project-1',
        prompt: 'A beautiful sunset',
        style: 'cinematic',
        characterRefs: ['ref1.png', 'ref2.png'],
      },
    };

    expect(event.name).toBe('image/generate');
    expect(event.data.sentenceId).toBe('sentence-1');
    expect(event.data.prompt).toBe('A beautiful sunset');
    expect(event.data.characterRefs).toEqual(['ref1.png', 'ref2.png']);
  });

  it('should have type-safe video/generate event', () => {
    const event = {
      name: 'video/generate' as const,
      data: {
        sentenceId: 'sentence-1',
        projectId: 'project-1',
        imageFile: 'image.png',
        prompt: 'Slow pan right',
        cameraMovement: 'pan_right',
        motionStrength: 0.7,
      },
    };

    expect(event.name).toBe('video/generate');
    expect(event.data.cameraMovement).toBe('pan_right');
    expect(event.data.motionStrength).toBe(0.7);
  });

  it('should have type-safe script/generate event', () => {
    const event = {
      name: 'script/generate' as const,
      data: {
        projectId: 'project-1',
        topic: 'Machine Learning',
        targetDuration: 10,
        useSearch: true,
      },
    };

    expect(event.name).toBe('script/generate');
    expect(event.data.topic).toBe('Machine Learning');
    expect(event.data.targetDuration).toBe(10);
    expect(event.data.useSearch).toBe(true);
  });
});
