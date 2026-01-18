import { describe, it, expect, beforeEach } from 'vitest';
import { db, projects, characters, sections, sentences, projectCast } from '../../src/backend/db/index.js';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

describe('Database Operations', () => {
  describe('Projects Table', () => {
    it('should insert a project', async () => {
      const id = nanoid();
      await db.insert(projects).values({
        id,
        name: 'Test Project',
        topic: 'AI Video',
        targetDuration: 10,
        visualStyle: 'cinematic',
        status: 'draft',
      });

      const results = await db.select().from(projects).where(eq(projects.id, id));
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.name).toBe('Test Project');
      expect(result?.targetDuration).toBe(10);
    });

    it('should update a project', async () => {
      const id = nanoid();
      await db.insert(projects).values({
        id,
        name: 'Original Name',
      });

      await db.update(projects)
        .set({ name: 'Updated Name' })
        .where(eq(projects.id, id));

      const results = await db.select().from(projects).where(eq(projects.id, id));
      expect(results[0]?.name).toBe('Updated Name');
    });

    it('should delete a project', async () => {
      const id = nanoid();
      await db.insert(projects).values({
        id,
        name: 'To Delete',
      });

      await db.delete(projects).where(eq(projects.id, id));

      const results = await db.select().from(projects).where(eq(projects.id, id));
      expect(results[0]).toBeUndefined();
    });

    it('should apply default values', async () => {
      const id = nanoid();
      await db.insert(projects).values({
        id,
        name: 'Defaults Test',
      });

      const results = await db.select().from(projects).where(eq(projects.id, id));
      const result = results[0];
      expect(result?.targetDuration).toBe(8);
      expect(result?.visualStyle).toBe('cinematic');
      expect(result?.voiceId).toBe('Emily');
      expect(result?.status).toBe('draft');
    });
  });

  describe('Characters Table', () => {
    it('should insert a character', async () => {
      const id = nanoid();
      await db.insert(characters).values({
        id,
        name: 'Alex',
        description: 'A tech enthusiast',
      });

      const results = await db.select().from(characters).where(eq(characters.id, id));
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.name).toBe('Alex');
    });

    it('should store reference images as JSON', async () => {
      const id = nanoid();
      const images = ['https://example.com/1.jpg', 'https://example.com/2.jpg'];

      await db.insert(characters).values({
        id,
        name: 'Alex',
        referenceImages: images,
      });

      const results = await db.select().from(characters).where(eq(characters.id, id));
      expect(results[0]?.referenceImages).toEqual(images);
    });
  });

  describe('Sections Table', () => {
    it('should insert a section linked to project', async () => {
      const projectId = nanoid();
      const sectionId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test Project' });
      await db.insert(sections).values({
        id: sectionId,
        projectId,
        title: 'Introduction',
        order: 0,
      });

      const results = await db.select().from(sections).where(eq(sections.id, sectionId));
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.projectId).toBe(projectId);
    });

    it('should cascade delete sections when project is deleted', async () => {
      const projectId = nanoid();
      const sectionId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test Project' });
      await db.insert(sections).values({
        id: sectionId,
        projectId,
        title: 'Introduction',
        order: 0,
      });

      await db.delete(projects).where(eq(projects.id, projectId));

      const results = await db.select().from(sections).where(eq(sections.id, sectionId));
      expect(results[0]).toBeUndefined();
    });
  });

  describe('Sentences Table', () => {
    it('should insert a sentence linked to section', async () => {
      const projectId = nanoid();
      const sectionId = nanoid();
      const sentenceId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test Project' });
      await db.insert(sections).values({ id: sectionId, projectId, title: 'Intro', order: 0 });
      await db.insert(sentences).values({
        id: sentenceId,
        sectionId,
        text: 'This is a test sentence.',
        order: 0,
      });

      const results = await db.select().from(sentences).where(eq(sentences.id, sentenceId));
      const result = results[0];
      expect(result).toBeDefined();
      expect(result?.text).toBe('This is a test sentence.');
    });

    it('should apply default values for sentence', async () => {
      const projectId = nanoid();
      const sectionId = nanoid();
      const sentenceId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test' });
      await db.insert(sections).values({ id: sectionId, projectId, title: 'Intro', order: 0 });
      await db.insert(sentences).values({
        id: sentenceId,
        sectionId,
        text: 'Test',
        order: 0,
      });

      const results = await db.select().from(sentences).where(eq(sentences.id, sentenceId));
      const result = results[0];
      expect(result?.cameraMovement).toBe('static');
      expect(result?.motionStrength).toBe(0.5);
      expect(result?.status).toBe('pending');
      expect(result?.isAudioDirty).toBe(true);
      expect(result?.isImageDirty).toBe(true);
      expect(result?.isVideoDirty).toBe(true);
    });

    it('should cascade delete sentences when section is deleted', async () => {
      const projectId = nanoid();
      const sectionId = nanoid();
      const sentenceId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test' });
      await db.insert(sections).values({ id: sectionId, projectId, title: 'Intro', order: 0 });
      await db.insert(sentences).values({ id: sentenceId, sectionId, text: 'Test', order: 0 });

      await db.delete(sections).where(eq(sections.id, sectionId));

      const results = await db.select().from(sentences).where(eq(sentences.id, sentenceId));
      expect(results[0]).toBeUndefined();
    });
  });

  describe('Project Cast Table', () => {
    it('should link character to project', async () => {
      const projectId = nanoid();
      const characterId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test Project' });
      await db.insert(characters).values({ id: characterId, name: 'Alex' });
      await db.insert(projectCast).values({ projectId, characterId });

      const result = await db.select().from(projectCast)
        .where(eq(projectCast.projectId, projectId));
      expect(result.length).toBe(1);
      expect(result[0].characterId).toBe(characterId);
    });

    it('should cascade delete cast when project is deleted', async () => {
      const projectId = nanoid();
      const characterId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test' });
      await db.insert(characters).values({ id: characterId, name: 'Alex' });
      await db.insert(projectCast).values({ projectId, characterId });

      await db.delete(projects).where(eq(projects.id, projectId));

      const result = await db.select().from(projectCast)
        .where(eq(projectCast.projectId, projectId));
      expect(result.length).toBe(0);
    });

    it('should cascade delete cast when character is deleted', async () => {
      const projectId = nanoid();
      const characterId = nanoid();

      await db.insert(projects).values({ id: projectId, name: 'Test' });
      await db.insert(characters).values({ id: characterId, name: 'Alex' });
      await db.insert(projectCast).values({ projectId, characterId });

      await db.delete(characters).where(eq(characters.id, characterId));

      const result = await db.select().from(projectCast)
        .where(eq(projectCast.characterId, characterId));
      expect(result.length).toBe(0);
    });
  });
});
