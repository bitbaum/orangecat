/**
 * The Cat chat (chatkit's ChatApp) opens, takes a message and a file, and fits
 * the screen at phone and desktop widths. Run by browser-smoke.yml against the
 * standalone production build, signed in as the E2E account (the session comes
 * from global-setup). Nothing is sent to the Cat, so a run costs no model call.
 */
import { expect, test, type Page } from '@playwright/test';

async function describePage(page: Page): Promise<string> {
  const dialogs = await page.locator('[role="dialog"], [aria-modal="true"]').allInnerTexts();
  const boxes = await page
    .locator('textarea')
    .evaluateAll(els =>
      els.map(e => `${e.getAttribute('aria-label')}|${e.getAttribute('placeholder')}`)
    );
  const body = (
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  ).slice(0, 400);
  return `url=${page.url()} dialogs=${JSON.stringify(dialogs).slice(0, 300)} textareas=${JSON.stringify(boxes)} body=${JSON.stringify(body)}`;
}

async function inspectChat(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/dashboard/cat', { waitUntil: 'domcontentloaded' });
  const composer = page.getByRole('textbox', { name: 'Message Cat…' });
  try {
    await expect(composer).toBeVisible({ timeout: 25000 });
  } catch (error) {
    // Name what the page showed instead of a bare "element(s) not found".
    throw new Error(`${(error as Error).message}\n${await describePage(page)}`);
  }
  await composer.fill('Check the chat composer layout.');
  await expect(page.getByRole('button', { name: /^send$/i })).toBeEnabled();
  await expect(page.locator('input[data-ck-source="files"]').first()).toBeAttached();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    `Cat chat overflows at ${width}px`
  ).toBe(true);
}

test('Cat chat: composer, send and attach fit a phone and a desktop', async ({ page }) => {
  await inspectChat(page, 390);
  await inspectChat(page, 1280);
});
