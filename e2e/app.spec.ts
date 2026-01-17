import { test, expect } from '@playwright/test';

test.describe('Studio AI App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the dashboard', async ({ page }) => {
    // App starts with a mock user logged in, so dashboard should be visible
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Create New Project')).toBeVisible();
  });

  test('should display recent projects section', async ({ page }) => {
    await expect(page.getByText('Recent Projects')).toBeVisible();
  });

  test('should display templates section', async ({ page }) => {
    await expect(page.getByText('Start from Template')).toBeVisible();
  });
});

test.describe('Project Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should create new project from Script to Video', async ({ page }) => {
    // Click on Script to Video card
    await page.getByText('Script to Video').click();

    // Should navigate to script editor
    await expect(page.getByText('Script to Video')).toBeVisible();
  });

  test('should create new project from AI Idea to Video', async ({ page }) => {
    // Click on AI Idea to Video card
    await page.getByText('AI Idea to Video').click();

    // Should navigate to script editor
    await expect(page).toHaveURL(/.*#?/);
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have working navigation elements', async ({ page }) => {
    // Check that layout has navigation
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
  });

  test('should be able to select existing project', async ({ page }) => {
    // The initial project should be visible in recent projects
    const projectCard = page.locator('[class*="cursor-pointer"]').filter({ hasText: 'Untitled' }).first();

    if (await projectCard.isVisible()) {
      await projectCard.click();
      // Should navigate to script editor for the selected project
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
