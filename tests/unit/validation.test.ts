import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  updateProjectSchema,
  createCharacterSchema,
  updateCharacterSchema,
  createSectionSchema,
  createSentenceSchema,
} from '../../src/backend/validation/schemas.js';

describe('Project Validation Schemas', () => {
  describe('createProjectSchema', () => {
    it('should validate a valid project', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test Project',
        topic: 'AI Video Generation',
        targetDuration: 10,
        visualStyle: 'cinematic',
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createProjectSchema.safeParse({
        topic: 'AI Video Generation',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].path).toContain('name');
      }
    });

    it('should reject empty name', () => {
      const result = createProjectSchema.safeParse({
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject name longer than 255 characters', () => {
      const result = createProjectSchema.safeParse({
        name: 'a'.repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it('should reject targetDuration less than 1', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test',
        targetDuration: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject targetDuration greater than 120', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test',
        targetDuration: 121,
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional fields as undefined', () => {
      const result = createProjectSchema.safeParse({
        name: 'Test Project',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateProjectSchema', () => {
    it('should allow partial updates', () => {
      const result = updateProjectSchema.safeParse({
        name: 'Updated Name',
      });
      expect(result.success).toBe(true);
    });

    it('should allow empty object', () => {
      const result = updateProjectSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should still validate field constraints', () => {
      const result = updateProjectSchema.safeParse({
        targetDuration: 200,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Character Validation Schemas', () => {
  describe('createCharacterSchema', () => {
    it('should validate a valid character', () => {
      const result = createCharacterSchema.safeParse({
        name: 'Alex',
        description: 'A tech enthusiast',
        referenceImages: ['https://example.com/image.jpg'],
      });
      expect(result.success).toBe(true);
    });

    it('should require name', () => {
      const result = createCharacterSchema.safeParse({
        description: 'A tech enthusiast',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid image URLs', () => {
      const result = createCharacterSchema.safeParse({
        name: 'Alex',
        referenceImages: ['not-a-url'],
      });
      expect(result.success).toBe(false);
    });

    it('should accept empty referenceImages array', () => {
      const result = createCharacterSchema.safeParse({
        name: 'Alex',
        referenceImages: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('updateCharacterSchema', () => {
    it('should allow partial updates', () => {
      const result = updateCharacterSchema.safeParse({
        description: 'Updated description',
      });
      expect(result.success).toBe(true);
    });
  });
});

describe('Section Validation Schemas', () => {
  describe('createSectionSchema', () => {
    it('should validate a valid section', () => {
      const result = createSectionSchema.safeParse({
        projectId: 'proj123',
        title: 'Introduction',
        order: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should require projectId', () => {
      const result = createSectionSchema.safeParse({
        title: 'Introduction',
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should require title', () => {
      const result = createSectionSchema.safeParse({
        projectId: 'proj123',
        order: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative order', () => {
      const result = createSectionSchema.safeParse({
        projectId: 'proj123',
        title: 'Introduction',
        order: -1,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('Sentence Validation Schemas', () => {
  describe('createSentenceSchema', () => {
    it('should validate a valid sentence', () => {
      const result = createSentenceSchema.safeParse({
        sectionId: 'sec123',
        text: 'This is a test sentence.',
        order: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should validate with optional fields', () => {
      const result = createSentenceSchema.safeParse({
        sectionId: 'sec123',
        text: 'This is a test sentence.',
        order: 0,
        imagePrompt: 'A beautiful landscape',
        cameraMovement: 'zoom_in',
        motionStrength: 0.7,
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid cameraMovement', () => {
      const result = createSentenceSchema.safeParse({
        sectionId: 'sec123',
        text: 'Test',
        order: 0,
        cameraMovement: 'invalid_movement',
      });
      expect(result.success).toBe(false);
    });

    it('should reject motionStrength outside 0-1 range', () => {
      const result = createSentenceSchema.safeParse({
        sectionId: 'sec123',
        text: 'Test',
        order: 0,
        motionStrength: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it('should accept all valid cameraMovement values', () => {
      const movements = ['static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'orbit', 'truck'];
      movements.forEach((movement) => {
        const result = createSentenceSchema.safeParse({
          sectionId: 'sec123',
          text: 'Test',
          order: 0,
          cameraMovement: movement,
        });
        expect(result.success).toBe(true);
      });
    });
  });
});
