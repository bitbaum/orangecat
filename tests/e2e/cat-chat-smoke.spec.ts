/**
 * The Cat chat (chatkit's ChatApp) opens, takes a message and a file, and fits
 * the screen at phone and desktop widths. Run by browser-smoke.yml against the
 * standalone production build, signed in as the E2E account (the session comes
 * from global-setup). Nothing is sent to the Cat, so a run costs no model call.
 */
import { expect, test, type Page } from '@playwright/test';

async function inspectChat(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/dashboard/cat', { waitUntil: 'domcontentloaded' });
  const composer = page.getByRole('textbox', { name: 'Message Cat…' });
  await expect(composer).toBeVisible({ timeout: 30000 });
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
