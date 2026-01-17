import { test, expect } from '@playwright/test';

test.describe('Backend API', () => {
  const API_BASE = 'http://localhost:3001';

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('projects endpoint returns array', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/projects`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('can create a new project', async ({ request }) => {
    const newProject = {
      name: 'E2E Test Project',
      description: 'Created by Playwright e2e test',
    };

    const response = await request.post(`${API_BASE}/api/projects`, {
      data: newProject,
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.name).toBe(newProject.name);
    expect(body.id).toBeDefined();
  });

  test('characters endpoint returns array', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/characters`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});
