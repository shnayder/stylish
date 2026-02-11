import { test, expect } from '@playwright/test';

test.describe('Writing Style Explorer - Text-Centered UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to initialize — writing surface should be visible
    await page.waitForSelector('#writing-text');
  });

  test('initial page load shows text-centered layout', async ({ page }) => {
    // Take full page screenshot
    await page.screenshot({
      path: 'test/screenshots/full-page.png',
      fullPage: true
    });

    // Verify main sections are present
    await expect(page.locator('h1')).toHaveText('Writing Style Explorer');

    // Context panel
    await expect(page.locator('#context-panel')).toBeVisible();
    await expect(page.locator('#setting-input')).toBeVisible();
    await expect(page.locator('#scene-input')).toBeVisible();

    // Writing surface
    await expect(page.locator('#writing-text')).toBeVisible();
    await expect(page.locator('#generate-draft-btn')).toBeVisible();
    await expect(page.locator('#evaluate-btn')).toBeVisible();

    // Style guide panel
    await expect(page.locator('#style-guide-panel')).toBeVisible();

    // No tabs (old UI removed)
    await expect(page.locator('.tab-bar')).toHaveCount(0);
  });

  test('context panel is collapsible', async ({ page }) => {
    const panel = page.locator('#context-panel');
    const settingInput = page.locator('#setting-input');

    // Initially visible
    await expect(settingInput).toBeVisible();

    // Click header to collapse
    await page.locator('#context-toggle').click();
    await expect(panel).toHaveClass(/collapsed/);

    // Click again to expand
    await page.locator('#context-toggle').click();
    await expect(panel).not.toHaveClass(/collapsed/);
    await expect(settingInput).toBeVisible();
  });

  test('writing surface has textarea and toolbar', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    const generateBtn = page.locator('#generate-draft-btn');
    const evaluateBtn = page.locator('#evaluate-btn');

    await expect(textarea).toBeVisible();
    await expect(generateBtn).toBeVisible();
    await expect(evaluateBtn).toBeVisible();

    // Textarea should be empty initially (or have restored text)
    await textarea.screenshot({
      path: 'test/screenshots/writing-surface.png'
    });
  });

  test('selection menu appears on text selection', async ({ page }) => {
    const textarea = page.locator('#writing-text');

    // Type some text
    await textarea.fill('The valley opened before them, a hidden fold in the mountains.');

    // Select some text
    await textarea.click();
    await page.keyboard.down('Shift');
    await page.keyboard.press('Home');
    await page.keyboard.press('Home'); // Go to beginning
    await page.keyboard.up('Shift');

    // Use evaluate to select text programmatically
    await textarea.evaluate((el) => {
      el.setSelectionRange(4, 20);
    });
    await textarea.dispatchEvent('mouseup');

    // Wait for selection menu to appear
    const selMenu = page.locator('#selection-menu');
    await expect(selMenu).toHaveClass(/visible/, { timeout: 2000 });

    // Verify menu has all three action buttons
    await expect(page.locator('#sel-react')).toBeVisible();
    await expect(page.locator('#sel-variations')).toBeVisible();
    await expect(page.locator('#sel-evaluate')).toBeVisible();

    await selMenu.screenshot({
      path: 'test/screenshots/selection-menu.png'
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

  test('style guide panel is collapsible', async ({ page }) => {
    const panel = page.locator('#style-guide-panel');

    // Initially visible
    await expect(panel).toBeVisible();
    await expect(page.locator('#manage-rules-btn')).toBeVisible();

    // Click header to collapse
    await page.locator('#style-guide-toggle').click();
    await expect(panel).toHaveClass(/collapsed/);

    // Click again to expand
    await page.locator('#style-guide-toggle').click();
    await expect(panel).not.toHaveClass(/collapsed/);
  });

  test('manage rules opens full style guide view', async ({ page }) => {
    const manageBtn = page.locator('#manage-rules-btn');
    const fullView = page.locator('#style-guide-full-view');

    // Initially hidden
    await expect(fullView).not.toHaveClass(/visible/);

    // Click Manage Rules
    await manageBtn.click();
    await expect(fullView).toHaveClass(/visible/);

    await fullView.screenshot({
      path: 'test/screenshots/full-style-guide.png'
    });

    // Close with back button
    await page.locator('#close-full-guide').click();
    await expect(fullView).not.toHaveClass(/visible/);
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

  test('annotations area is initially empty', async ({ page }) => {
    const annotationsArea = page.locator('#annotations-area');
    // Should exist but be empty
    await expect(annotationsArea).toBeAttached();
    const children = await annotationsArea.locator('> *').count();
    expect(children).toBe(0);
  });
});
