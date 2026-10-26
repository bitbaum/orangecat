import { expect, test, type Page } from '@playwright/test';
import { getE2ECredentials } from './helpers/credentials';
import { loginE2EUser } from './helpers/login';

test.use({ storageState: { cookies: [], origins: [] } });

async function inspectChat(page: Page, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/dashboard/cat');
  const composer = page.getByRole('textbox', { name: 'Message Cat…' });
  await expect(composer).toBeVisible();
  await composer.fill('Check the chat composer layout.');
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    `Cat chat overflows at ${width}px`
  ).toBe(true);
}

test('Cat chat keeps the shared ChatKit composer usable on phone and desktop', async ({ page }) => {
  const credentials = getE2ECredentials();
  test.skip(!credentials.email || !credentials.password, 'Requires the CI E2E fixture account');
  await loginE2EUser(page);
  await inspectChat(page, 390);
  await inspectChat(page, 1280);
});
