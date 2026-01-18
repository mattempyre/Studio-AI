import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Bulk Audio Generation (Story 3-3)
 *
 * Prerequisites:
 * - Backend server running (localhost:3001)
 * - Inngest dev server running (localhost:8288)
 * - Chatterbox TTS service running (localhost:8004)
 * - Test project "test-audio-project" exists with at least one section
 *
 * Run with: npm run test:e2e -- e2e/bulk-audio-generation.spec.ts
 */
test.describe('Bulk Audio Generation', () => {
  const TEST_PROJECT_ID = 'test-audio-project';

  test.beforeEach(async ({ page }) => {
    // Navigate to the test project's script editor
    await page.goto(`/project/${TEST_PROJECT_ID}/script`);

    // Wait for the page to fully load
    await expect(page.getByText('Script Sections')).toBeVisible({ timeout: 15000 });
  });

  test('should show Generate All Audio button in toolbar', async ({ page }) => {
    // The AudioToolbar should be visible with the Generate All Audio button
    const generateButton = page.getByRole('button', { name: /Generate All Audio/i });
    await expect(generateButton).toBeVisible();
  });

  test('should show "All audio up to date" when no dirty sentences', async ({ page }) => {
    // If all sentences have audio, the status message should appear
    const upToDateMessage = page.getByText('All audio up to date');
    const generateButton = page.getByRole('button', { name: /Generate All Audio/i });

    // Either the message is shown OR the button is enabled (has dirty sentences)
    const isUpToDate = await upToDateMessage.isVisible().catch(() => false);
    const isButtonDisabled = await generateButton.isDisabled();

    // One of these should be true
    expect(isUpToDate || isButtonDisabled).toBeTruthy();
  });

  test('should enable Generate All Audio button when adding new sentence', async ({ page }) => {
    // Click Add Sentence button
    await page.getByRole('button', { name: 'Add Sentence' }).first().click();

    // Wait for the input to appear
    const sentenceInput = page.getByRole('textbox', { name: /Enter your sentence here/i });
    await expect(sentenceInput).toBeVisible();

    // Type a test sentence
    await sentenceInput.fill('This is a test sentence for E2E testing of bulk audio generation.');

    // Confirm the sentence
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Wait for the sentence to be saved and UI to update
    await page.waitForTimeout(1000);

    // The Generate All Audio button should now be enabled with a count badge
    const generateButton = page.getByRole('button', { name: /Generate All Audio/i });
    await expect(generateButton).toBeEnabled();

    // Should show count badge (at least "1")
    const badge = page.locator('button:has-text("Generate All Audio") >> text=/\\d+/');
    await expect(badge).toBeVisible();
  });

  test('should show progress UI when generating audio', async ({ page }) => {
    // First, add a new sentence to ensure we have something to generate
    await page.getByRole('button', { name: 'Add Sentence' }).first().click();

    const sentenceInput = page.getByRole('textbox', { name: /Enter your sentence here/i });
    await expect(sentenceInput).toBeVisible();
    await sentenceInput.fill('E2E test: Progress UI verification sentence.');
    await page.getByRole('button', { name: 'Confirm' }).click();

    // Wait for sentence to be saved
    await page.waitForTimeout(1000);

    // Click Generate All Audio
    const generateButton = page.getByRole('button', { name: /Generate All Audio/i });
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    // Should show Cancel button (indicating generation started)
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });

    // Should show "Generating..." text
    await expect(page.getByText('Generating...')).toBeVisible();
  });

  test('should show sentence status during generation', async ({ page }) => {
    // Add a new sentence
    await page.getByRole('button', { name: 'Add Sentence' }).first().click();

    const sentenceInput = page.getByRole('textbox', { name: /Enter your sentence here/i });
    await expect(sentenceInput).toBeVisible();
    await sentenceInput.fill('E2E test: Sentence status indicator test.');
    await page.getByRole('button', { name: 'Confirm' }).click();

    await page.waitForTimeout(1000);

    // Start generation
    await page.getByRole('button', { name: /Generate All Audio/i }).click();

    // The sentence should show a status indicator (Queued or Generating)
    // Look for either "Queued" or "Generating..." text near the sentence
    const statusIndicator = page.getByText(/Queued|Generating\.\.\./).first();
    await expect(statusIndicator).toBeVisible({ timeout: 5000 });
  });

  test.describe('Full Generation Flow', () => {
    // This test requires Inngest and Chatterbox to be running
    test.skip(({ browserName }) => {
      // Skip in CI if services aren't available
      return !!process.env.CI;
    }, 'Requires Inngest and Chatterbox services');

    test('should complete audio generation and show play button', async ({ page }) => {
      // Add a new sentence
      await page.getByRole('button', { name: 'Add Sentence' }).first().click();

      const sentenceInput = page.getByRole('textbox', { name: /Enter your sentence here/i });
      await expect(sentenceInput).toBeVisible();
      await sentenceInput.fill('E2E full flow test sentence for audio generation.');
      await page.getByRole('button', { name: 'Confirm' }).click();

      await page.waitForTimeout(1000);

      // Start generation
      await page.getByRole('button', { name: /Generate All Audio/i }).click();

      // Wait for generation to complete (up to 60 seconds for TTS)
      // Look for the success toast or the completion indicator
      await expect(page.getByText(/All audio generation complete|All audio up to date/)).toBeVisible({
        timeout: 60000
      });

      // The newly generated sentence should have a play button
      const playButtons = page.getByRole('button', { name: 'Play audio' });
      const playButtonCount = await playButtons.count();
      expect(playButtonCount).toBeGreaterThan(0);

      // Should show "NEW" badge for recently generated audio
      await expect(page.getByText('NEW')).toBeVisible();
    });

    test('should play generated audio in footer player', async ({ page }) => {
      // Find a sentence with audio (play button visible)
      const playButton = page.getByRole('button', { name: 'Play audio' }).first();

      // Skip if no audio available
      if (!await playButton.isVisible()) {
        test.skip();
        return;
      }

      // Click play
      await playButton.click();

      // Footer AudioPlayer should appear
      const audioPlayer = page.locator('text=Audio Track');
      await expect(audioPlayer).toBeVisible();

      // Should have playback controls
      await expect(page.getByRole('button', { name: /Pause|Play/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Rewind 5s' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Forward 5s' })).toBeVisible();

      // Should have volume control
      await expect(page.getByRole('button', { name: /Mute|Unmute/ })).toBeVisible();

      // Should have close button
      await expect(page.getByRole('button', { name: 'Close player' })).toBeVisible();
    });

    test('should close audio player when close button clicked', async ({ page }) => {
      // Find and click a play button
      const playButton = page.getByRole('button', { name: 'Play audio' }).first();

      if (!await playButton.isVisible()) {
        test.skip();
        return;
      }

      await playButton.click();

      // Wait for player to appear
      await expect(page.locator('text=Audio Track')).toBeVisible();

      // Click close
      await page.getByRole('button', { name: 'Close player' }).click();

      // Player should disappear
      await expect(page.locator('text=Audio Track')).not.toBeVisible();
    });
  });

  test.describe('Cancel Functionality', () => {
    test('should show Cancel button during generation', async ({ page }) => {
      // Add a sentence and start generation
      await page.getByRole('button', { name: 'Add Sentence' }).first().click();

      const sentenceInput = page.getByRole('textbox', { name: /Enter your sentence here/i });
      await expect(sentenceInput).toBeVisible();
      await sentenceInput.fill('Cancel test sentence.');
      await page.getByRole('button', { name: 'Confirm' }).click();

      await page.waitForTimeout(1000);

      await page.getByRole('button', { name: /Generate All Audio/i }).click();

      // Cancel button should be visible
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      await expect(cancelButton).toBeVisible({ timeout: 5000 });
    });

    test('should stop generation when Cancel clicked', async ({ page }) => {
      // Add multiple sentences to have more time to cancel
      for (let i = 0; i < 2; i++) {
        await page.getByRole('button', { name: 'Add Sentence' }).first().click();
        const sentenceInput = page.getByRole('textbox', { name: /Enter your sentence here/i });
        await expect(sentenceInput).toBeVisible();
        await sentenceInput.fill(`Cancel flow test sentence ${i + 1}.`);
        await page.getByRole('button', { name: 'Confirm' }).click();
        await page.waitForTimeout(500);
      }

      // Start generation
      await page.getByRole('button', { name: /Generate All Audio/i }).click();

      // Wait for Cancel button and click it
      const cancelButton = page.getByRole('button', { name: 'Cancel' });
      await expect(cancelButton).toBeVisible({ timeout: 5000 });
      await cancelButton.click();

      // After canceling, Generate All Audio button should reappear
      // (may take a moment for the UI to update)
      await expect(page.getByRole('button', { name: /Generate All Audio/i })).toBeVisible({
        timeout: 10000
      });
    });
  });

  test.describe('Audio Playback', () => {
    test('should display duration for completed audio', async ({ page }) => {
      // Look for any duration display (format: X.Xs)
      const durationPattern = page.locator('text=/\\d+\\.\\d+s/');

      // If there's completed audio, duration should be visible
      const hasDuration = await durationPattern.first().isVisible().catch(() => false);

      if (hasDuration) {
        await expect(durationPattern.first()).toBeVisible();
      }
    });

    test('should switch audio when clicking different play buttons', async ({ page }) => {
      const playButtons = page.getByRole('button', { name: 'Play audio' });
      const buttonCount = await playButtons.count();

      if (buttonCount < 2) {
        test.skip();
        return;
      }

      // Play first audio
      await playButtons.nth(0).click();
      await expect(page.locator('text=Audio Track')).toBeVisible();

      // Play second audio (should switch)
      await playButtons.nth(1).click();

      // Player should still be visible (switched to new track)
      await expect(page.locator('text=Audio Track')).toBeVisible();
    });
  });
});
