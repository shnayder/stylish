import { test, expect } from '@playwright/test';

test.describe('Writing Style Explorer - Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize
    await page.waitForSelector('#alternatives');
  });

  test('initial page load shows all sections', async ({ page }) => {
    // Take full page screenshot
    await page.screenshot({
      path: 'test/screenshots/full-page.png',
      fullPage: true
    });

    // Verify main sections are present
    await expect(page.locator('h1')).toHaveText('Writing Style Explorer');
    await expect(page.locator('#setting-input')).toBeVisible();
    await expect(page.locator('#style-input')).toBeVisible();
    await expect(page.locator('#scene-input')).toBeVisible();
    await expect(page.locator('#alternatives')).toBeVisible();
    await expect(page.locator('#style-categories')).toBeVisible();
    await expect(page.locator('#all-reactions')).toBeVisible();
  });

  test('alternatives grid shows initial alternatives', async ({ page }) => {
    // Check that alternatives are rendered
    const alternatives = page.locator('.alternative');
    await expect(alternatives).toHaveCount(4);

    // Screenshot of alternatives section
    await page.locator('.alternatives-grid').screenshot({
      path: 'test/screenshots/alternatives-grid.png'
    });
  });

  test('settings panel opens and closes', async ({ page }) => {
    const settingsToggle = page.locator('#settings-toggle');
    const settingsPanel = page.locator('#settings-panel');

    // Initially hidden
    await expect(settingsPanel).not.toHaveClass(/visible/);

    // Click to open
    await settingsToggle.click();
    await expect(settingsPanel).toHaveClass(/visible/);

    await settingsPanel.screenshot({
      path: 'test/screenshots/settings-panel-open.png'
    });

    // Click outside to close
    await page.click('body', { position: { x: 10, y: 10 } });
    await expect(settingsPanel).not.toHaveClass(/visible/);
  });

  test('style palette allows selection', async ({ page }) => {
    // Click on a style option
    const firstOption = page.locator('.style-option').first();
    await firstOption.click();

    // Check it's selected
    await expect(firstOption).toHaveClass(/selected/);

    // Check selection count is updated
    await expect(page.locator('#style-selection-count')).toHaveText('1 selected');

    // Generate button should be enabled
    await expect(page.locator('#generate-from-styles')).toBeEnabled();

    await page.locator('.style-palette').screenshot({
      path: 'test/screenshots/style-palette-selected.png'
    });
  });

  test('text selection shows popup', async ({ page }) => {
    // Select text in the first alternative
    const descriptionText = page.locator('.description-text').first();

    // Triple-click to select a paragraph
    await descriptionText.click({ clickCount: 3 });

    // Wait for popup to appear
    const popup = page.locator('#selection-popup');
    await expect(popup).toHaveClass(/visible/, { timeout: 1000 });

    await popup.screenshot({
      path: 'test/screenshots/selection-popup.png'
    });
  });

  test('style guide section expands and collapses', async ({ page }) => {
    const header = page.locator('#style-guide-header');
    const content = page.locator('#style-guide-content');

    // Initially collapsed
    await expect(content).not.toHaveClass(/expanded/);

    // Click to expand
    await header.click();
    await expect(content).toHaveClass(/expanded/);

    await page.locator('.style-guide').screenshot({
      path: 'test/screenshots/style-guide-expanded.png'
    });

    // Click to collapse
    await header.click();
    await expect(content).not.toHaveClass(/expanded/);
  });

  test('responsive layout at different widths', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.screenshot({
      path: 'test/screenshots/viewport-desktop.png',
      fullPage: true
    });

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({
      path: 'test/screenshots/viewport-tablet.png',
      fullPage: true
    });

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({
      path: 'test/screenshots/viewport-mobile.png',
      fullPage: true
    });
  });
});
