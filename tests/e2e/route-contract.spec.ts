import { test, expect } from '@playwright/test';

/**
 * What a signed-out visitor gets at each top-level address.
 *
 * Read-only: every check is a GET, so it runs against CI's local server and
 * against https://orangecat.ch alike (E2E_BASE_URL).
 *
 * This replaces six specs that ran nowhere and had drifted: they expected
 * /loans, /circles and /assets to ask for a sign-in, but /loans and /circles
 * became Discover tabs and /assets moved under the dashboard. Nobody noticed
 * because nothing ran them. CI now runs this file on every push to main.
 *
 * Every check reads the HTTP status. The old ones only asked whether a <body>
 * was visible, which a 404 page also has: /fundraising, /fund-us, /donate and
 * /browse had all become 404s while those checks stayed green.
 */

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';

// These are signed-out checks. Global setup may have saved a signed-in
// session; start from none.
test.use({ storageState: { cookies: [], origins: [] } });

const PUBLIC_PAGES = [
  '/',
  '/discover',
  '/about',
  '/blog',
  '/how-it-works',
  '/faq',
  '/privacy',
  '/terms',
  '/technology',
  '/docs',
  '/community',
];

/** Old addresses that must still land somewhere real. */
const LEGACY_REDIRECTS: Array<[from: string, to: RegExp]> = [
  ['/loans', /\/discover\?type=loans$/],
  ['/circles', /\/discover\?type=circles$/],
];

/** Signed-in pages, and where the sign-in sends the person back to. */
const PROTECTED: Array<[path: string, returnTo: string]> = [
  ['/dashboard', '/dashboard'],
  ['/timeline', '/timeline'],
  ['/settings', '/settings'],
  ['/messages', '/messages'],
  ['/assets', '/dashboard/assets'],
];

test.describe('route contract (signed out)', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} renders`, async ({ page }) => {
      const res = await page.goto(baseURL + path);
      expect(res?.status(), `${path} status`).toBeLessThan(400);
      await expect(page.locator('main, #main-content').first()).toBeVisible();
    });
  }

  for (const [from, to] of LEGACY_REDIRECTS) {
    test(`${from} lands on ${to.source}`, async ({ page }) => {
      const res = await page.goto(baseURL + from);
      expect(res?.status(), `${from} final status`).toBeLessThan(400);
      expect(page.url()).toMatch(to);
    });
  }

  for (const [path, returnTo] of PROTECTED) {
    test(`${path} asks for sign-in and returns to ${returnTo}`, async ({ page }) => {
      await page.goto(baseURL + path);
      const url = new URL(page.url());
      expect(url.pathname).toBe('/auth');
      expect(url.searchParams.get('mode')).toBe('login');
      expect(url.searchParams.get('from')).toBe(returnTo);
    });
  }

  test('/api/health answers', async ({ request }) => {
    const res = await request.get(baseURL + '/api/health');
    expect([200, 503]).toContain(res.status());
  });
});
