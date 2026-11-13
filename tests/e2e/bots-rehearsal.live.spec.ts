/**
 * The five bot demos, against the live site, as one rehearsal.
 *
 * Runs as a brand-new person: a pseudonymous account minted at the start
 * ("Start instantly"), so no fixture secret and no shared history. Every
 * step says what it gives the person, so a red step names the value lost.
 *
 * It spends the new account's free turns (about nine). It is started by a
 * person, from the Live rehearsal workflow or by hand, never on a timer:
 * fleet rule 2026-09-25, a free-tier key is spent only when someone asks.
 *
 *   E2E_BASE_URL=https://orangecat.ch pnpm exec playwright test \
 *     tests/e2e/bots-rehearsal.live.spec.ts --project=chromium
 *
 * Screenshots land in test-results/ through Playwright's own attachments.
 */
import path from 'node:path';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

// One page, one person, in file order; a red demo does not hide the ones after it.
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });
test.setTimeout(10 * 60 * 1000);

interface Turn {
  role: 'user' | 'bot';
  speaker: string;
  text: string;
  failed: boolean;
}

const turns = (page: Page): Promise<Turn[]> =>
  page.locator('.ck-turn').evaluateAll(els =>
    els.map(e => ({
      role: e.className.includes('ck-turn-user') ? ('user' as const) : ('bot' as const),
      speaker: (e.querySelector('.ck-speaker')?.textContent || '').trim(),
      text: ((e.querySelector('.ck-bubble') || e) as HTMLElement).innerText
        .replace(/\n{2,}/g, '\n')
        .trim(),
      failed: Boolean(e.querySelector('.ck-failed')),
    }))
  );

async function send(page: Page, text: string, file?: string) {
  if (file) {
    await page.locator('input[data-ck-source="files"]').first().setInputFiles(file);
    await page.waitForTimeout(2000);
  }
  const box = page.locator('textarea').first();
  await box.fill(text);
  await box.press('Enter');
}

/** Wait until the thread has stopped moving: no live turn, and no new line for 8 s. */
async function settle(page: Page, minTurns: number, timeoutMs = 240_000): Promise<number> {
  const t0 = Date.now();
  let last = -1;
  let stableSince = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    await page.waitForTimeout(2000);
    const live = await page.locator('.ck-live, .ck-dots').count();
    const n = await page.locator('.ck-turn').count();
    if (n !== last) {
      last = n;
      stableSince = Date.now();
    }
    if (!live && n >= minTurns && Date.now() - stableSince > 8000) {
      return n;
    }
  }
  return last;
}

async function openNew(page: Page, item: string) {
  await page.goto(`${baseURL}/companions/talk`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.locator('nav button[aria-label="New bot"]').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('menuitem', { name: item }).click();
  await page.waitForTimeout(1200);
}

const bodyText = async (page: Page) =>
  (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const confirmOf = (page: Page) =>
  page.getByRole('button', { name: /Allow and confirm|^Confirm$/ }).first();

async function waitForCard(page: Page): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(2000);
    if ((await confirmOf(page).count()) > 0) {
      return true;
    }
  }
  return false;
}

/**
 * One retry on a gateway error. A deploy that lands during a run restarts
 * the app for a few seconds (seen 2026-11-01 at 16:50Z: one PUT answered
 * 502 while #1515 rolled out, and 400 a minute later). One retry, logged,
 * tells that apart from a route that is really down.
 */
async function call(
  label: string,
  send: () => Promise<{ status(): number }>
): Promise<{ status(): number }> {
  const first = await send();
  if (![502, 503, 504].includes(first.status())) {
    return first;
  }
  console.log(`${label}: ${first.status()} from the gateway, retrying once in 5 s`);
  await new Promise(r => setTimeout(r, 5000));
  return send();
}

async function shot(page: Page, name: string) {
  await test.info().attach(name, {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
}

/** A new person: the pseudonymous start, which needs no email (the create-account side). */
async function startInstantly(page: Page) {
  await page.goto(`${baseURL}/auth?mode=register`, { waitUntil: 'networkidle' });
  await page
    .locator('button, a')
    .filter({ hasText: /Start instantly/ })
    .first()
    .click();
  await page.waitForURL(url => !/\/auth/.test(url.pathname), { timeout: 45_000 });
}

test.describe('bots rehearsal (live)', () => {
  let page: Page;
  let api: APIRequestContext;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    page = await context.newPage();
    page.setDefaultTimeout(45_000);
    api = context.request;
    await startInstantly(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('1. one door: the list is Bots and the Cat is its first row', async () => {
    await page.goto(`${baseURL}/companions/talk`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const h1 = (
      await page
        .locator('nav h1')
        .first()
        .innerText()
        .catch(() => '')
    ).trim();
    const rows = page.locator('nav a').filter({ hasText: /·/ });
    const firstRow = (
      await rows
        .first()
        .innerText()
        .catch(() => '')
    ).replace(/\s+/g, ' ');
    await shot(page, '1-list');
    // Value: one list, one word, and the bot that can act on OrangeCat is the first thing seen.
    expect(h1).toBe('Bots');
    expect(firstRow).toMatch(/^Cat · money, pages and your account/);
  });

  test('2. the shelf: a ready bot reads a real letter and keeps the thread', async () => {
    await openNew(page, 'New bot');
    const shelfRows = await page
      .getByRole('button', {
        name: /Letter Reader|Pitch Coach|Day Planner|Writing Partner|Study Buddy/,
      })
      .count();
    expect(shelfRows).toBe(5);
    await page
      .getByRole('button', { name: /^Letter Reader/ })
      .first()
      .click();
    await page.waitForURL(/with=(?!fleet|cat)/, { timeout: 45_000 });
    await page.waitForTimeout(2000);
    let t = await turns(page);
    // Value: no naming, no "what are you for": one tap and the bot says what to send it.
    expect(t[0]?.text || '').toMatch(/Send me a letter/);
    expect(await bodyText(page)).not.toMatch(/What should I help you with/);

    await send(
      page,
      'My employer wants me to sign this. What does it mean for me?',
      fixture('clause.txt')
    );
    const n = await settle(page, t.length + 2);
    t = await turns(page);
    const answer = t.at(-1)?.text || '';
    await shot(page, '2-letter');
    // Value: a real document explained in plain words in one message, with the lines that matter named.
    expect(t.at(-1)?.failed).toBe(false);
    expect(answer.length).toBeGreaterThan(200);
    expect(answer).toMatch(/non-?compete|24|month|penalt/i);
    // Trust: no figure beyond the document's own.
    const invented =
      /\b\d{1,3}(?:[.,]\d{3})+\b|\b1 ?M\b/.test(answer) &&
      !/50[ ,.]?000|24|78[ ,.]?000/.test(answer);
    expect(invented).toBe(false);

    await send(
      page,
      'Draft a two-line reply to my employer asking for a shorter duration and no EU part.'
    );
    await settle(page, n + 2);
    t = await turns(page);
    // Value: the second message builds on the first without re-attaching anything.
    expect(t.at(-1)?.failed).toBe(false);
    expect(t.at(-1)?.text || '').toMatch(/shorter|12|month|EU|Switzerland/i);
  });

  test('3. a group: each specialist keeps to its own lane', async () => {
    await openNew(page, 'New group chat');
    for (const name of ['Diplodoctor', 'Causius']) {
      await page.getByRole('checkbox', { name: new RegExp(`^${name}`) }).click();
    }
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.waitForURL(/room=/, { timeout: 45_000 });
    await page.waitForTimeout(2000);
    await send(
      page,
      "I work in Zürich and my employer wants a doctor's note from the first day I'm off sick. I just have a bad cold. Is that normal here, and do I even need to see a doctor for a cold?"
    );
    await settle(page, 3);
    const t = await turns(page);
    const speakers = [
      ...new Set(t.filter(x => x.role === 'bot').map(x => x.speaker.split('·')[0].trim())),
    ];
    await shot(page, '3-group');
    // Value: one question with two halves, answered by the right two specialists, each in its lane.
    expect(speakers).toContain('Causius');
    expect(speakers).toContain('Diplodoctor');
  });

  test('4. hands: a bot proposes an event, the tap creates it, and a plain ask gets no card', async () => {
    await openNew(page, 'New bot');
    await page
      .getByRole('button', { name: /^Day Planner/ })
      .first()
      .click();
    await page.waitForURL(/with=(?!fleet|cat)/, { timeout: 45_000 });
    await page.waitForTimeout(2000);
    let t = await turns(page);

    await send(
      page,
      'Today: finish the tax form, call the landlord about the heating, buy a birthday present for Ana.'
    );
    const n = await settle(page, t.length + 2);
    t = await turns(page);
    // Value: a bot asked for a plan gives a plan. Hands appear only when something is asked to be set up.
    expect(await page.getByRole('button', { name: /Confirm/ }).count()).toBe(0);
    expect(t.at(-1)?.failed).toBe(false);

    await send(
      page,
      'Set up the dentist as an event: Monday 3 November 2026 at 09:00, Bahnhofstrasse 1, Zürich. Title "Dentist".'
    );
    await settle(page, n + 2);
    const hasCard = await waitForCard(page);
    t = await turns(page);
    const said = t.at(-1)?.text || '';
    await shot(page, '4-card');
    // Value: the bot says what it will set up and asks before anything exists: one tap, no form.
    expect(hasCard).toBe(true);
    expect(said).not.toMatch(/```|"action"/);

    await confirmOf(page).click();
    await page.waitForTimeout(6000);
    const text = await bodyText(page);
    await shot(page, '4-done');
    // Value: approve once and it exists, with a link to it.
    expect(await confirmOf(page).count()).toBe(0);
    expect(text).toMatch(/Open|Done|created|Event/);
    const open = page.getByRole('link', { name: 'Open' }).first();
    expect(await open.count()).toBe(1);
    const href = await open.getAttribute('href');
    await page.goto(href!.startsWith('http') ? href! : baseURL + href!, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);
    expect(await bodyText(page)).toMatch(/Dentist/);
  });

  test('5. a connector: the bot asks Loki, honestly, twice', async () => {
    await openNew(page, 'New bot');
    await page
      .getByRole('button', { name: /^Writing Partner/ })
      .first()
      .click();
    await page.waitForURL(/with=(?!fleet|cat)/, { timeout: 45_000 });
    await page.waitForTimeout(2000);
    const question = 'Ask Loki which of my sites are live right now.';

    await send(page, question);
    // Value: the bot does not know what is live and does not pretend to; it names the one who does.
    expect(await waitForCard(page)).toBe(true);
    await shot(page, '5-first-card');
    await confirmOf(page).click();
    let text = '';
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2000);
      text = await bodyText(page);
      if (
        /not linked to a Loki account|Loki did not answer|(?:is|are) live\b/i.test(
          text.split(question).join('')
        ) &&
        (await confirmOf(page).count()) === 0
      ) {
        break;
      }
    }
    await shot(page, '5-outcome');
    // Value: no invented answer. This account was never in Loki, so the outcome is the one step, in words.
    expect(text).toMatch(/not linked to a Loki account/i);
    expect(text).toMatch(/Sign in to Loki/i);
    expect(text).not.toMatch(/\[object Object\]/);

    // Value: what the bot did stays in the thread. Reload, and the outcome is a line of it.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const kept = await turns(page);
    expect(kept.some(t => t.role === 'bot' && /not linked to a Loki account/i.test(t.text))).toBe(
      true
    );

    await send(page, question);
    // Value: the hand does not go away after one use, and the second card starts clean.
    expect(await waitForCard(page)).toBe(true);
    await shot(page, '5-second-card');
    const cardText = await confirmOf(page)
      .locator('xpath=ancestor::div[contains(@class,"rounded")][1]')
      .innerText();
    expect(cardText).toMatch(/Ask Loki/);
    expect(cardText).not.toMatch(/Loki did not answer/);
    await page.getByRole('button', { name: 'Reject', exact: true }).first().click();
  });

  test('6. a routine: set, shown honestly, agreed by the API, stopped', async () => {
    await page.getByRole('button', { name: 'Details' }).first().click();
    await page.waitForTimeout(1200);
    const row = page.getByRole('button', { name: /Writes first, every day/ });
    // Value: one row, under the bot, in the place its other settings live.
    expect(await row.count()).toBe(1);
    await row.click();
    await page.waitForTimeout(800);
    await page.locator('input[type="time"]').fill('08:15');
    await page.locator('textarea').last().fill('Good morning. Give me my three things for today.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForTimeout(3000);
    expect(await bodyText(page)).toMatch(/Writes first every day at 08:15/);
    await page.getByRole('button', { name: /Writes first every day at 08:15/ }).click();
    await page.waitForTimeout(800);
    const shown = await bodyText(page);
    await shot(page, '6-routine');
    // Value: no silent failure; the bot says why it will not write yet and where to fix it.
    expect(shown).toMatch(/Runs on your own key/);
    expect(shown).toMatch(/Add your key/);

    const id = new URL(page.url()).searchParams.get('with');
    const got = await call('routine GET', () =>
      api.get(`${baseURL}/api/ai-assistants/${id}/routine`)
    );
    const json = (await (got as import('@playwright/test').APIResponse).json()) as {
      data?: { routine?: { timeLocal?: string }; canRun?: boolean };
    };
    expect(got.status()).toBe(200);
    expect(json.data?.routine?.timeLocal).toBe('08:15');
    expect(json.data?.canRun).toBe(false);
    const bad = await call('routine PUT 25:00', () =>
      api.put(`${baseURL}/api/ai-assistants/${id}/routine`, {
        data: { prompt: 'x', timeLocal: '25:00', zone: 'Europe/Zurich' },
      })
    );
    expect(bad.status()).toBe(400);
    const foreign = await call('routine GET foreign', () =>
      api.get(`${baseURL}/api/ai-assistants/00000000-0000-4000-8000-000000000000/routine`)
    );
    expect(foreign.status()).toBe(404);

    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.waitForTimeout(2500);
    const after = await bodyText(page);
    expect(after).toMatch(/Writes first, every day/);
    expect(after).not.toMatch(/every day at 08:15/);
  });

  test('7. the edges the API must hold', async () => {
    // A direct call to a bot's hand never answers without the card.
    const direct = await call('execute direct', () =>
      api.post(`${baseURL}/api/cat/actions/execute`, {
        data: { actionId: 'ask_loki', parameters: { question: 'x' } },
      })
    );
    expect([400, 401, 403, 404, 405]).toContain(direct.status());
    // A room needs two members and known starters, and is nobody else's.
    const oneMember = await call('room one member', () =>
      api.post(`${baseURL}/api/ai-assistants/rooms`, {
        data: { members: [{ fleetSlug: 'causius' }] },
      })
    );
    expect(oneMember.status()).toBe(400);
    const badStarter = await call('bad starter', () =>
      api.post(`${baseURL}/api/ai-assistants/talk`, { data: { title: 'X', starter: 'nope' } })
    );
    expect(badStarter.status()).toBe(400);
    const foreignRoom = await call('foreign room', () =>
      api.get(`${baseURL}/api/ai-assistants/rooms/00000000-0000-4000-8000-000000000000`)
    );
    expect(foreignRoom.status()).toBe(404);
  });

  test('8. what a person sets for a bot: model, rules, memory, library', async () => {
    type Res = import('@playwright/test').APIResponse;
    const id = new URL(page.url()).searchParams.get('with');
    expect(id).toBeTruthy();

    // Model: a new person has no key of their own, so the shared pool picks,
    // and the answer says so instead of offering a choice that does nothing.
    const models = (await call('models GET', () =>
      api.get(`${baseURL}/api/ai-assistants/models`)
    )) as Res;
    expect(models.status()).toBe(200);
    expect(((await models.json()) as { data?: { source?: string } }).data?.source).toBe('pool');

    // Rules: saved as written, with the time zone; a zone nobody knows is refused.
    const rules = 'Never send anything to anyone without asking me first.';
    const put = (await call('rules PUT', () =>
      api.put(`${baseURL}/api/ai-assistants/rules`, {
        data: { rules, timeZone: 'Europe/Zurich' },
      })
    )) as Res;
    expect(put.status()).toBe(200);
    expect(((await put.json()) as { data?: unknown }).data).toEqual({
      rules,
      timeZone: 'Europe/Zurich',
    });
    const badZone = await call('rules PUT bad zone', () =>
      api.put(`${baseURL}/api/ai-assistants/rules`, {
        data: { rules, timeZone: 'Mars/Olympus' },
      })
    );
    expect(badZone.status()).toBe(400);
    const cleared = await call('rules PUT clear', () =>
      api.put(`${baseURL}/api/ai-assistants/rules`, { data: { rules: '', timeZone: null } })
    );
    expect(cleared.status()).toBe(200);

    // Memory: a person adds a line, corrects it, and forgets it.
    type Mem = { id: string; content: string };
    const memories = async (r: Res) =>
      ((await r.json()) as { data?: { memories?: Mem[] } }).data?.memories ?? [];
    const added = (await call('memory POST', () =>
      api.post(`${baseURL}/api/ai-assistants/${id}/memories/write`, {
        data: { content: 'Rehearsal: prefers short answers.' },
      })
    )) as Res;
    expect(added.status()).toBe(200);
    const first = (await memories(added)).find(m => m.content.includes('prefers short answers'));
    expect(first).toBeTruthy();
    const corrected = (await call('memory PATCH', () =>
      api.patch(`${baseURL}/api/ai-assistants/${id}/memories/write`, {
        data: { id: first!.id, content: 'Rehearsal: prefers long answers.' },
      })
    )) as Res;
    expect(corrected.status()).toBe(200);
    const after = await memories(corrected);
    expect(after.some(m => m.content.includes('prefers long answers'))).toBe(true);
    expect(after.some(m => m.id === first!.id)).toBe(false);
    const forgotten = await call('memory DELETE all', () =>
      api.delete(`${baseURL}/api/ai-assistants/${id}/memories?all=true`)
    );
    expect(forgotten.status()).toBe(200);

    // Library: the caller's own, a list, never an error for an empty one.
    const library = (await call('library GET', () =>
      api.get(`${baseURL}/api/ai-assistants/${id}/library`)
    )) as Res;
    expect(library.status()).toBe(200);
    expect(
      Array.isArray(((await library.json()) as { data?: { items?: unknown } }).data?.items)
    ).toBe(true);
  });
});
