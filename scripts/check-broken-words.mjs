#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check:broken-words — no word is drawn across two lines.
 *
 * A word may wrap onto the next line; it may never be cut in two. Substrata's
 * answer table read "Te / rm" and "Di / re / ct / or / y" at 390px
 * (2026-10-22), and reading the CSS finds none of that: it is a LAYOUT fact,
 * real glyphs in a real font at a real width. So this gate opens the screens
 * the owner looks at most in a real browser, at a phone's narrowest width, the
 * reference phone and a desktop, and measures every word. The measurement is
 * `@bitbaum/chatkit/audit` → `findBrokenWords`, the fleet's one definition of a
 * cut word (words beside - / . @ : _ and over 24 characters are exempt — a URL
 * or an identifier has to break somewhere).
 *
 * Screens: the landing page, the Cat chat page (the chatkit surface) and the
 * money surface (/receive, /send, /requests, /pay/<username>). The signed-in
 * ones open with E2E_USER_EMAIL / E2E_USER_PASSWORD, the same credentials the
 * P0 matrix uses; without them those pages are reported as not opened, never
 * as passed. Widths: 320, 390, 1440.
 *
 * Fails listing page, width and the words. A page that does not answer 2xx,
 * or bounces to sign-in, fails too — an audit of a 404 is not an audit.
 *
 * Run (needs a server; not part of `pnpm run verify`, which runs no browser —
 * CI runs it in the build-and-smoke job against the standalone server):
 *   pnpm run dev -p 3020
 *   BASE_URL=http://localhost:3020 pnpm run check:broken-words
 * Options: PAY_USERNAME (default cato), CHROMIUM_PATH (an executable to use
 * instead of Playwright's own download), BROKEN_WORDS_SCREENSHOTS=1 (writes
 * .tmp/broken-words/<page>-<width>.png for every failure).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { BROKEN_WORDS_SOURCE } from '@bitbaum/chatkit/audit';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const WIDTHS = [320, 390, 1440];
const PAY_USERNAME = process.env.PAY_USERNAME ?? 'cato';
const EMAIL = process.env.E2E_USER_EMAIL ?? process.env.E2E_TEST_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD ?? process.env.E2E_TEST_USER_PASSWORD;
const SHOTS = process.env.BROKEN_WORDS_SCREENSHOTS === '1';
const SHOT_DIR = join(process.cwd(), '.tmp', 'broken-words');

/** Every screen the gate opens. `signedIn` pages need the E2E credentials. */
const PAGES = [
  { path: '/', signedIn: false },
  { path: `/pay/${PAY_USERNAME}`, signedIn: false },
  { path: '/dashboard/cat', signedIn: true },
  { path: '/receive', signedIn: true },
  { path: '/send', signedIn: true },
  { path: '/requests', signedIn: true },
];

/** Let the page finish: network quiet, fonts in, hydration done. */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  // Client-only screens hydrate after the network goes quiet; auth-gated
  // ones swap a spinner for content. Wait until nothing is spinning.
  await page
    .waitForFunction(() => document.querySelectorAll('.animate-spin').length === 0, null, {
      timeout: 15_000,
    })
    .catch(() => {});
  await page.waitForTimeout(500);
}

/** Same steps as tests/e2e/helpers/login.ts, without @playwright/test. */
async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/auth?mode=login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email address').fill(EMAIL);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  await page.close();
}

async function audit(context, path, width) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
  try {
    const response = await page.goto(`${BASE_URL}${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    const status = response?.status() ?? 0;
    if (status < 200 || status >= 300) {
      return { error: `answered ${status}` };
    }
    await settle(page);
    const landed = new URL(page.url()).pathname;
    if (landed.startsWith('/auth')) {
      return { error: `bounced to sign-in (${landed})` };
    }
    const words = await page.evaluate(`(${BROKEN_WORDS_SOURCE})(document.body)`);
    if (words.length > 0 && SHOTS) {
      mkdirSync(SHOT_DIR, { recursive: true });
      const slug = path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-') || 'landing';
      await page.screenshot({ path: join(SHOT_DIR, `${slug}-${width}.png`), fullPage: true });
    }
    return { words };
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
  });
  const failures = [];
  const skipped = [];
  let audited = 0;
  try {
    const context = await browser.newContext();
    const canSignIn = Boolean(EMAIL && PASSWORD);
    if (canSignIn) {
      await signIn(context);
    }
    for (const { path, signedIn } of PAGES) {
      if (signedIn && !canSignIn) {
        skipped.push(path);
        continue;
      }
      for (const width of WIDTHS) {
        const result = await audit(context, path, width);
        audited += 1;
        if (result.error) {
          failures.push(`${path} @ ${width}px: ${result.error}`);
        } else if (result.words.length > 0) {
          const list = result.words.map(w => `"${w}"`).join(', ');
          failures.push(`${path} @ ${width}px: ${list}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (skipped.length > 0) {
    console.warn(
      `check:broken-words — NOT opened (set E2E_USER_EMAIL / E2E_USER_PASSWORD): ${skipped.join(', ')}`
    );
  }
  if (failures.length > 0) {
    console.error(
      `check:broken-words — ${failures.length} screen(s) failed (page @ width: words cut, or why it did not open):`
    );
    for (const f of failures) console.error(`  ${f}`);
    if (SHOTS) console.error(`  screenshots in ${SHOT_DIR}`);
    process.exit(1);
  }
  const pages = PAGES.length - skipped.length;
  console.log(
    `check:broken-words passed — ${pages} page(s) × ${WIDTHS.join('/')}px (${audited} screens) at ${BASE_URL}, no word cut across lines.`
  );
}

main().catch(error => {
  console.error('check:broken-words could not run:', error.message);
  process.exit(1);
});
