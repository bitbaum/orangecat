/** Explicit live probes: one real project-room chat edit, then the same Cat action engine. */
import { expect, test, type Page } from '@playwright/test';
import { requireE2ECredentials } from './helpers/credentials';
import { API_ROUTES } from '../../src/config/api-routes';
import { ROUTES } from '../../src/config/routes';

async function api(page: Page, path: string, method = 'GET', data?: unknown) {
  return page.evaluate(
    async ({ path, method, data }) => {
      const response = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      return { status: response.status, body: await response.json() };
    },
    { path, method, data }
  );
}

test('a project room can be edited in Cat, reviewed, confirmed and used in the UI', async ({
  page,
}, testInfo) => {
  test.setTimeout(360000);
  requireE2ECredentials();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ROUTES.DASHBOARD.HOME, { waitUntil: 'domcontentloaded' });
  const created = await api(page, API_ROUTES.PROJECTS.BASE, 'POST', {
    title: `Cat room check ${Date.now()}`,
    description: 'A temporary owned fixture for checking investor-room chat and UI.',
    currency: 'CHF',
    status: 'draft',
  });
  expect(created.status).toBe(201);
  const id = created.body.data.id as string;
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  const headline = 'A sourced room story from the Cat live check';
  try {
    await page.goto(ROUTES.PROJECTS.ROOM(id), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Investor room', exact: true })).toBeVisible();
    const before = await api(page, API_ROUTES.PROJECTS.ROOM(id));
    expect(before.status).toBe(200);

    // The project reference comes from the current page, not a UUID typed into chat.
    await page.getByRole('button', { name: 'Ask Cat about this page' }).click();
    const chat = page.getByRole('dialog', { name: 'Cat', exact: true });
    await chat.getByRole('button', { name: 'More for this chat' }).click();
    await chat.getByText('Temporary chat', { exact: true }).click();
    const composer = chat.getByRole('textbox', { name: 'Message Cat…' });
    await composer.fill(
      `Read this project's investor room, then save exactly this headline: "${headline}". Leave all other room fields unchanged.`
    );
    await chat.getByRole('button', { name: /^send$/i }).click();
    const card = chat.locator('.border-l-status-warning').filter({ hasText: id });
    await expect(card).toHaveCount(1, { timeout: 90000 });
    await card.getByText('Details', { exact: true }).click();
    await expect(card).toContainText(headline);
    await expect(card).not.toContainText('[object Object]');
    await page.screenshot({ path: testInfo.outputPath('room-chat-review-390.png') });
    await card.getByRole('button', { name: /^(Allow and confirm|Confirm)$/ }).click();
    await expect
      .poll(
        async () => (await api(page, API_ROUTES.PROJECTS.ROOM(id))).body.data.content.headline,
        { timeout: 20000 }
      )
      .toBe(headline);
    const after = await api(page, API_ROUTES.PROJECTS.ROOM(id));
    expect(after.body.data.content.sections).toEqual(before.body.data.content.sections);
    expect(after.body.data.content.documents).toEqual(before.body.data.content.documents);
    await chat.getByRole('button', { name: 'Close Cat', exact: true }).click();

    // Other writes use the very same Cat executor/confirmation route, with no invitations sent.
    async function confirmedAction(actionId: string, parameters: Record<string, unknown>) {
      const proposed = await api(page, API_ROUTES.CAT.ACTIONS, 'POST', {
        actionId,
        parameters: { project_id: id, ...parameters },
      });
      expect(proposed.status).toBe(200);
      const action = proposed.body.data;
      if (action.status === 'pending_confirmation') {
        const confirmed = await api(
          page,
          `${API_ROUTES.CAT.ACTIONS}/${action.pendingActionId}`,
          'POST'
        );
        expect(confirmed.status).toBe(200);
        expect(confirmed.body.data.status).toBe('completed');
        return confirmed.body.data.data;
      }
      expect(action.status).toBe('completed');
      return action.data;
    }

    const deck = await confirmedAction('generate_investor_deck', {});
    expect(deck.deck.slides.length).toBeGreaterThan(0);
    const recipient = await confirmedAction('create_investor_room_link', {
      label: 'Room check recipient',
    });
    expect(recipient.url).toContain(ROUTES.ROOM(recipient.link.token));
    // Owner preview is excluded from investor-open notifications.
    await page.goto(recipient.url, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main')).toContainText(headline);
    await page.goto(ROUTES.PROJECTS.ROOM(id), { waitUntil: 'domcontentloaded' });
    await confirmedAction('revoke_investor_room_link', { link_id: recipient.link.id });
    const final = await api(page, API_ROUTES.PROJECTS.ROOM(id));
    expect(
      final.body.data.links.find((link: { id: string }) => link.id === recipient.link.id).revoked_at
    ).toBeTruthy();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true
      );
      await page.screenshot({ path: testInfo.outputPath(`room-owner-${width}.png`) });
    }
  } finally {
    // Only this test-created project is deleted; its room and recipient links cascade.
    const pending = await api(page, API_ROUTES.CAT.ACTIONS);
    for (const action of pending.body.data?.pendingActions ?? []) {
      if (action.parameters?.project_id === id)
        await api(page, `${API_ROUTES.CAT.ACTIONS}/${action.id}`, 'DELETE');
    }
    const removed = await api(page, API_ROUTES.PROJECTS.BY_ID(id), 'DELETE');
    expect(removed.status).toBe(200);
  }
});
