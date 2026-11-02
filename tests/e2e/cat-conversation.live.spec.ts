/** Real model calls against the deployed Cat; selected explicitly by workflow dispatch. */
import { expect, test } from '@playwright/test';
import { requireE2ECredentials } from './helpers/credentials';

test('Cat answers an attention request and leads into an investor room', async ({
  page,
}, testInfo) => {
  test.setTimeout(180000);
  requireE2ECredentials();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard/cat', { waitUntil: 'domcontentloaded' });
  const composer = page.getByRole('textbox', { name: 'Message Cat…' });
  await expect(composer, 'The real signed-in Cat must be available').toBeVisible({
    timeout: 25000,
  });
  // Use the real temporary-chat control so the probe cannot teach durable memories.
  await page.getByRole('button', { name: 'More for this chat' }).click();
  await page.getByText('Temporary chat', { exact: true }).click();

  for (const message of ['What needs my attention?', 'I wanna see and use investor room']) {
    await composer.fill(message);
    const responsePromise = page.waitForResponse(
      response =>
        response.url().endsWith('/api/cat/chat') && response.request().method() === 'POST',
      { timeout: 60000 }
    );
    await page.getByRole('button', { name: /^send$/i }).click();
    const response = await responsePromise;
    expect(response.ok(), 'Chat must accept the real request').toBe(true);
    const answer = page.locator('.ck-turn-answer').last();
    // Chromium may discard fetch-stream bodies. Observe the completed message
    // the person actually sees: live turns have Stop, finished turns have Copy.
    await expect(answer.getByRole('button', { name: /^copy$/i })).toBeVisible({ timeout: 90000 });
    await expect(page.locator('.ck-stop')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^send$/i })).toBeVisible({ timeout: 60000 });
    await expect(answer).not.toContainText(
      /not in your data|couldn.t reach an AI model|cut off by a connection error|couldn.t put together a reply/i
    );
    await expect(answer.locator('.ck-failed')).toHaveCount(0);
    await expect(answer).not.toBeEmpty();
  }

  const answer = page.locator('.ck-turn-answer').last();
  const roomLink = answer
    .locator(
      'a[href^="/projects/"][href$="/room"], a[href="/dashboard/projects"], a[href="/dashboard/projects/create"]'
    )
    .first();
  await expect(roomLink, 'The investor-room request must lead to a real destination').toBeVisible();
  const href = await roomLink.getAttribute('href');
  expect(href).toMatch(/^\/(?:projects\/[a-zA-Z0-9-]+\/room|dashboard\/projects(?:\/create)?)$/);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.screenshot({ path: testInfo.outputPath(`cat-conversation-${width}.png`) });
  }
  await roomLink.click();
  await expect(page).toHaveURL(url => url.pathname === href);
  await expect(page.getByText('This page could not be found.')).toHaveCount(0);
});
