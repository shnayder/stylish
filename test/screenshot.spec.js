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

    // Ensure textarea is focused, then select text programmatically
    await textarea.focus();
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

test.describe('Pen Flow - Generate Draft and Variations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#writing-text');
  });

  test('generate draft requires context', async ({ page }) => {
    // Clear context
    await page.locator('#setting-input').fill('');

    // Set up dialog handler for the alert
    page.on('dialog', dialog => dialog.accept());

    // Click Generate Draft with empty context
    await page.locator('#generate-draft-btn').click();

    // Button should still be enabled (no generation started)
    await expect(page.locator('#generate-draft-btn')).toBeEnabled();
  });

  test('generate draft shows loading state', async ({ page }) => {
    // Intercept LLM calls to control timing
    await page.route('**/v1/chat/completions', route => {
      // Delay response to observe loading state
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: '{"tone":"contemplative","technique":"sensory","pacing":"slow"}\n\nThe valley opened before them.' } }],
            usage: { prompt_tokens: 100, completion_tokens: 50 }
          })
        });
      }, 500);
    });

    // Click Generate Draft
    await page.locator('#generate-draft-btn').click();

    // Should show loading state
    await expect(page.locator('#generate-draft-btn')).toHaveText('Generating...');
    await expect(page.locator('#generate-draft-btn')).toBeDisabled();

    // Wait for generation to complete
    await expect(page.locator('#generate-draft-btn')).toHaveText('Generate Draft', { timeout: 5000 });
    await expect(page.locator('#generate-draft-btn')).toBeEnabled();

    // Text should now be in the textarea
    const text = await page.locator('#writing-text').inputValue();
    expect(text).toContain('The valley opened before them.');
  });

  test('variations flow creates annotation card on selection action', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    await textarea.fill('The valley opened before them, a hidden fold in the mountains.');

    // Intercept LLM calls for variations
    await page.route('**/v1/chat/completions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: '1. The gorge stretched wide before them\n2. The canyon revealed itself below\n3. The ravine opened its mouth\n4. The valley spread beneath their feet\n5. The dell lay hidden among the peaks' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50 }
        })
      });
    });

    // Select text and trigger Variations
    await textarea.focus();
    await textarea.evaluate((el) => { el.setSelectionRange(4, 20); });
    await textarea.dispatchEvent('mouseup');
    await expect(page.locator('#selection-menu')).toHaveClass(/visible/, { timeout: 2000 });
    await page.locator('#sel-variations').click();

    // A variations card should appear in the annotations area
    const card = page.locator('.inline-variations');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('.annotation-type.variations')).toHaveText('Variations');

    // Should show variation options
    await expect(card.locator('.variation-option')).toHaveCount(5, { timeout: 5000 });

    // Each should have a "Use" button
    await expect(card.locator('.variation-option .action-btn').first()).toBeVisible();

    await page.screenshot({
      path: 'test/screenshots/variations-card.png',
      fullPage: true
    });
  });

  test('variations "Use" replaces selected text', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    await textarea.fill('The valley opened before them.');

    await page.route('**/v1/chat/completions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: '1. The gorge stretched wide\n2. The canyon appeared\n3. The ravine opened\n4. The dell lay hidden\n5. The chasm gaped' } }],
          usage: { prompt_tokens: 100, completion_tokens: 30 }
        })
      });
    });

    // Select "valley opened" (index 4-18)
    await textarea.focus();
    await textarea.evaluate((el) => { el.setSelectionRange(4, 18); });
    await textarea.dispatchEvent('mouseup');
    await expect(page.locator('#selection-menu')).toHaveClass(/visible/, { timeout: 2000 });
    await page.locator('#sel-variations').click();

    // Wait for variations
    const card = page.locator('.inline-variations');
    await expect(card.locator('.variation-option')).toHaveCount(5, { timeout: 5000 });

    // Click "Use" on first variation
    await card.locator('.variation-option .action-btn').first().click();

    // Card should be removed
    await expect(card).not.toBeVisible();

    // Text should be updated
    const newText = await textarea.inputValue();
    expect(newText).toContain('The gorge stretched wide');
  });

  test('variations card can be closed', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    await textarea.fill('Some sample text here.');

    await page.route('**/v1/chat/completions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: '1. Alternative one\n2. Alternative two\n3. Alternative three\n4. Alternative four\n5. Alternative five' } }],
          usage: { prompt_tokens: 50, completion_tokens: 30 }
        })
      });
    });

    await textarea.focus();
    await textarea.evaluate((el) => { el.setSelectionRange(5, 11); });
    await textarea.dispatchEvent('mouseup');
    await expect(page.locator('#selection-menu')).toHaveClass(/visible/, { timeout: 2000 });
    await page.locator('#sel-variations').click();

    const card = page.locator('.inline-variations');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Close the card
    await card.locator('#close-variations').click();
    await expect(card).not.toBeVisible();
  });

  test('variations handles LLM error gracefully', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    await textarea.fill('Some text to vary.');

    await page.route('**/v1/chat/completions', route => {
      route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await textarea.focus();
    await textarea.evaluate((el) => { el.setSelectionRange(0, 9); });
    await textarea.dispatchEvent('mouseup');
    await expect(page.locator('#selection-menu')).toHaveClass(/visible/, { timeout: 2000 });
    await page.locator('#sel-variations').click();

    // Card should appear with error message
    const card = page.locator('.inline-variations');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('.annotation-card-body')).toContainText('Failed', { timeout: 5000 });
  });
});

test.describe('Mirror Flow - Reaction Threads', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#writing-text');
  });

  test('react creates a mirror thread card', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    await textarea.fill('The valley opened before them, a hidden fold in the mountains.');

    // Mock LLM for coach response
    await page.route('**/v1/chat/completions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: 'What specifically about this phrase catches your attention? Is it the word "fold", the visual imagery, or the rhythm of the sentence?' } }],
          usage: { prompt_tokens: 100, completion_tokens: 40 }
        })
      });
    });

    // Select text and trigger React
    await textarea.focus();
    await textarea.evaluate((el) => { el.setSelectionRange(31, 62); });
    await textarea.dispatchEvent('mouseup');
    await expect(page.locator('#selection-menu')).toHaveClass(/visible/, { timeout: 2000 });
    await page.locator('#sel-react').click();

    // A mirror thread card should appear
    const card = page.locator('.mirror-thread');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('.annotation-type.mirror')).toHaveText('React');

    // Should show coach's opening message
    await expect(card.locator('.thread-message.coach')).toBeVisible({ timeout: 5000 });

    // Should have input field and action buttons
    await expect(card.locator('.thread-input textarea')).toBeVisible();
    await expect(card.locator('[data-action="crystallize"]')).toBeVisible();

    await page.screenshot({
      path: 'test/screenshots/mirror-thread.png',
      fullPage: true
    });
  });

  test('mirror thread supports multi-turn conversation', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    await textarea.fill('The warm lamplight spilled across the stone floor.');

    let callCount = 0;
    await page.route('**/v1/chat/completions', route => {
      callCount++;
      const responses = [
        'What bothers you about "warm lamplight"? Is it a cliche, or is it the specific word choice?',
        'I see — you find it too cozy and generic. Would something more specific work better, like a particular color or quality of light?'
      ];
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: responses[Math.min(callCount - 1, responses.length - 1)] } }],
          usage: { prompt_tokens: 100, completion_tokens: 40 }
        })
      });
    });

    // Open a mirror thread
    await textarea.focus();
    await textarea.evaluate((el) => { el.setSelectionRange(4, 18); });
    await textarea.dispatchEvent('mouseup');
    await expect(page.locator('#selection-menu')).toHaveClass(/visible/, { timeout: 2000 });
    await page.locator('#sel-react').click();

    const card = page.locator('.mirror-thread');
    await expect(card.locator('.thread-message.coach')).toBeVisible({ timeout: 5000 });

    // Type a response
    const threadInput = card.locator('.thread-input textarea');
    await threadInput.fill('It feels like a cliche — every cozy scene has warm lamplight.');
    await card.locator('[data-action="send"]').click();

    // Should show user message and then coach reply
    await expect(card.locator('.thread-message.user')).toBeVisible({ timeout: 2000 });
    await expect(card.locator('.thread-message.coach').nth(1)).toBeVisible({ timeout: 5000 });
  });

  test('mirror thread can be closed', async ({ page }) => {
    const textarea = page.locator('#writing-text');
    await textarea.fill('Some text to react to.');

    await page.route('**/v1/chat/completions', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          choices: [{ message: { content: 'What catches your eye here?' } }],
          usage: { prompt_tokens: 50, completion_tokens: 10 }
        })
      });
    });

    await textarea.focus();
    await textarea.evaluate((el) => { el.setSelectionRange(0, 9); });
    await textarea.dispatchEvent('mouseup');
    await expect(page.locator('#selection-menu')).toHaveClass(/visible/, { timeout: 2000 });
    await page.locator('#sel-react').click();

    const card = page.locator('.mirror-thread');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Close via Done button
    await card.locator('[data-action="close-thread"]').first().click();
    await expect(card).not.toBeVisible();
  });
});

test.describe('Lens Flow - Evaluation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#writing-text');
  });

  test('evaluate requires text', async ({ page }) => {
    // Dismiss alert
    page.on('dialog', dialog => dialog.accept());

    // Click evaluate with empty textarea
    await page.locator('#evaluate-btn').click();

    // No annotation card should appear
    const card = page.locator('.lens-results');
    await expect(card).not.toBeVisible();
  });

  test('evaluate requires style rules', async ({ page }) => {
    // Dismiss alert
    page.on('dialog', dialog => dialog.accept());

    // Add text but no rules
    await page.locator('#writing-text').fill('The valley opened before them.');
    await page.locator('#evaluate-btn').click();

    // No annotation card should appear
    const card = page.locator('.lens-results');
    await expect(card).not.toBeVisible();
  });

  test('evaluate shows loading state then results', async ({ page }) => {
    // First, inject a style rule into the app state
    await page.evaluate(() => {
      // Access the module's state to add a rule
      localStorage.setItem('style-guide', JSON.stringify([{
        id: 'test-rule-1',
        principle: 'Avoid warm/cozy cliches in setting descriptions',
        categories: ['diction'],
        avoid: ['warm lamplight', 'cozy glow'],
        prefer: ['specific light qualities']
      }]));
    });
    // Reload to pick up the rule
    await page.reload();
    await page.waitForSelector('#writing-text');

    // Mock the resolution pipeline LLM calls
    let callIdx = 0;
    await page.route('**/v1/chat/completions', route => {
      callIdx++;
      if (callIdx === 1) {
        // Category match
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: '["diction"]' } }],
            usage: { prompt_tokens: 100, completion_tokens: 10 }
          })
        });
      } else {
        // Evaluation
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: JSON.stringify([
              { ruleId: 'test-rule-1', assessment: 'violates', note: 'Uses "warm lamplight" which is a setting cliche.' }
            ]) } }],
            usage: { prompt_tokens: 100, completion_tokens: 30 }
          })
        });
      }
    });

    await page.locator('#writing-text').fill('The warm lamplight spilled across the ancient stone floor.');
    await page.locator('#evaluate-btn').click();

    // Should show loading state
    await expect(page.locator('#evaluate-btn')).toHaveText('Evaluating...');

    // Wait for results
    const card = page.locator('.lens-results');
    await expect(card).toBeVisible({ timeout: 10000 });

    await page.screenshot({
      path: 'test/screenshots/lens-evaluation.png',
      fullPage: true
    });
  });

  test('lens dismiss fades the annotation', async ({ page }) => {
    // Inject a rule and mock evaluation
    await page.evaluate(() => {
      localStorage.setItem('style-guide', JSON.stringify([{
        id: 'test-rule-1',
        principle: 'Test rule',
        categories: ['diction'],
        avoid: [],
        prefer: []
      }]));
    });
    await page.reload();
    await page.waitForSelector('#writing-text');

    let callIdx = 0;
    await page.route('**/v1/chat/completions', route => {
      callIdx++;
      if (callIdx === 1) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: '["diction"]' } }],
            usage: { prompt_tokens: 50, completion_tokens: 10 }
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: JSON.stringify([
              { ruleId: 'test-rule-1', assessment: 'violates', note: 'Violates the test rule.' }
            ]) } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 }
          })
        });
      }
    });

    await page.locator('#writing-text').fill('Some text to evaluate.');
    await page.locator('#evaluate-btn').click();

    const card = page.locator('.lens-results');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Click dismiss on the annotation
    const dismissBtn = card.locator('[data-action="dismiss"]').first();
    await expect(dismissBtn).toBeVisible({ timeout: 5000 });
    await dismissBtn.click();

    // Annotation should be faded
    const annotation = card.locator('.lens-annotation').first();
    await expect(annotation).toHaveCSS('opacity', '0.4');
    await expect(dismissBtn).toBeDisabled();
  });

  test('lens card can be closed', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('style-guide', JSON.stringify([{
        id: 'test-rule-1',
        principle: 'Test rule',
        categories: ['diction'],
        avoid: [],
        prefer: []
      }]));
    });
    await page.reload();
    await page.waitForSelector('#writing-text');

    let callIdx = 0;
    await page.route('**/v1/chat/completions', route => {
      callIdx++;
      if (callIdx === 1) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: '["diction"]' } }],
            usage: { prompt_tokens: 50, completion_tokens: 10 }
          })
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            choices: [{ message: { content: JSON.stringify([
              { ruleId: 'test-rule-1', assessment: 'follows', note: 'Looks good.' }
            ]) } }],
            usage: { prompt_tokens: 50, completion_tokens: 20 }
          })
        });
      }
    });

    await page.locator('#writing-text').fill('Some text.');
    await page.locator('#evaluate-btn').click();

    const card = page.locator('.lens-results');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Close the card
    await card.locator('#close-lens').click();
    await expect(card).not.toBeVisible();
  });
});
