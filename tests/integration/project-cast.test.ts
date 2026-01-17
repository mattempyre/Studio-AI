import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from '../helpers/app.js';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
    app = await createTestApp();
});

describe('Project Cast API', () => {
    let projectId: string;
    let characterId1: string;
    let characterId2: string;

    beforeEach(async () => {
        // Create a project
        const projectResponse = await request(app)
            .post('/api/v1/projects')
            .send({ name: 'Cast Test Project' });
        projectId = projectResponse.body.data.id;

        // Create characters
        const char1Response = await request(app)
            .post('/api/v1/characters')
            .send({ name: 'Cast Char 1', description: 'Test Description 1' });
        characterId1 = char1Response.body.data.id;

        const char2Response = await request(app)
            .post('/api/v1/characters')
            .send({ name: 'Cast Char 2' });
        characterId2 = char2Response.body.data.id;
    });

    describe('POST /api/v1/projects/:id/cast', () => {
        it('should add a character to project cast', async () => {
            const response = await request(app)
                .post(`/api/v1/projects/${projectId}/cast`)
                .send({ characterId: characterId1 });

            expect(response.status).toBe(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();

            // Verify persistence
            const getResponse = await request(app)
                .get(`/api/v1/projects/${projectId}`)
                .expect(200);

            expect(getResponse.body.data.cast).toHaveLength(1);
            expect(getResponse.body.data.cast[0].id).toBe(characterId1);
            // Verify full character details are returned
            expect(getResponse.body.data.cast[0].name).toBe('Cast Char 1');
            expect(getResponse.body.data.cast[0].description).toBe('Test Description 1');
        });

        it('should prevent adding duplicate character', async () => {
            // Setup: Add character first
            await request(app).post(`/api/v1/projects/${projectId}/cast`).send({ characterId: characterId1 });

            const response = await request(app)
                .post(`/api/v1/projects/${projectId}/cast`)
                .send({ characterId: characterId1 })
                .expect(400); // Or 200 with added: false? Implementation returns 400 if already in cast.

            // Checking implementation in Step 133:
            // const existing = await db.select().from(projectCast)...
            // if (existing.length > 0) return res.status(400).json(...)
            // So 400 is correct.

            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('DUPLICATE');
        });

        it('should return 404 if project does not exist', async () => {
            await request(app)
                .post('/api/v1/projects/nonexistent/cast')
                .send({ characterId: characterId2 })
                .expect(404);
        });

        it('should return 404 if character does not exist', async () => {
            await request(app)
                .post(`/api/v1/projects/${projectId}/cast`)
                .send({ characterId: 'nonexistent-char' })
                .expect(404);
        });
    });

    describe('POST /api/v1/projects/:id/cast/batch', () => {
        it('should add multiple characters to cast', async () => {
            // Create new project for cleanliness
            const pRes = await request(app).post('/api/v1/projects').send({ name: 'Batch Project' });
            const pId = pRes.body.data.id;

            // Add char1 and char2
            const response = await request(app)
                .post(`/api/v1/projects/${pId}/cast/batch`)
                .send({ characterIds: [characterId1, characterId2] })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.data.added).toHaveLength(2);

            // Verify
            const getResponse = await request(app).get(`/api/v1/projects/${pId}`);
            expect(getResponse.body.data.cast).toHaveLength(2);
        });

        it('should handle partial duplicates in batch', async () => {
            // Create project and add char1
            const pRes = await request(app).post('/api/v1/projects').send({ name: 'Batch Partial Project' });
            const pId = pRes.body.data.id;
            await request(app).post(`/api/v1/projects/${pId}/cast`).send({ characterId: characterId1 });

            // Add char1 and char2 (char1 is duplicate)
            const response = await request(app)
                .post(`/api/v1/projects/${pId}/cast/batch`)
                .send({ characterIds: [characterId1, characterId2] })
                .expect(201);

            expect(response.body.data.added).toHaveLength(1); // Only char2 added
            expect(response.body.data.added).toContain(characterId2);
            expect(response.body.data.skipped).toContain(characterId1);

            // Verify total is 2
            const getResponse = await request(app).get(`/api/v1/projects/${pId}`);
            expect(getResponse.body.data.cast).toHaveLength(2);
        });
    });

    describe('DELETE /api/v1/projects/:id/cast/:characterId', () => {
        it('should remove a character from cast', async () => {
            // Setup: Add character first
            await request(app).post(`/api/v1/projects/${projectId}/cast`).send({ characterId: characterId1 });

            // Setup: Use projectId from first suite which has char1
            await request(app)
                .delete(`/api/v1/projects/${projectId}/cast/${characterId1}`)
                .expect(204);

            // Verify removal
            const getResponse = await request(app).get(`/api/v1/projects/${projectId}`);
            expect(getResponse.body.data.cast).toHaveLength(0);
        });

        it('should return 404 if character not in cast (or project/char not found)', async () => {
            // char1 is already removed
            await request(app)
                .delete(`/api/v1/projects/${projectId}/cast/${characterId1}`)
                .expect(404);
        });
    });
});
