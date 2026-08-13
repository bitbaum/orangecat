// Playwright global setup to pre-authenticate and save storage state for tests.
// Requires environment variables: E2E_USER_EMAIL and E2E_USER_PASSWORD
// (legacy E2E_TEST_USER_* also accepted).
// If credentials are missing or login fails, setup falls back gracefully (no storageState).

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
const { loadEnvConfig } = require('@next/env');

module.exports = async () => {
  // Match Next.js local development: read .env.local without sourcing it in a
  // shell or printing any value. Explicit process environment still wins.
  loadEnvConfig(process.cwd());

  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const email =
    process.env.E2E_TEST_USER_EMAIL || process.env.E2E_USER_EMAIL || process.env.TEST_USER_EMAIL;
  const password =
    process.env.E2E_TEST_USER_PASSWORD ||
    process.env.E2E_USER_PASSWORD ||
    process.env.TEST_USER_PASSWORD;

  const authDir = path.resolve(__dirname, '..', '.auth');
  const storagePath = path.join(authDir, 'user.json');

  // Ensure auth directory exists
  fs.mkdirSync(authDir, { recursive: true });

  if (!email || !password) {
    console.warn('[global-setup] Missing test-user credentials; skipping pre-auth.');
    return;
  }

  console.log('[global-setup] Starting login flow to create storage state...');
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  });
  const page = await browser.newPage();

  try {
    await page.goto(`${baseURL}/auth?mode=login`, { waitUntil: 'domcontentloaded' });
    await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    const submit = page.locator('form button[type="submit"]').first();
    await submit.click();

    // A successful session normally redirects, but preserving the state does
    // not depend on router timing. Race the three honest terminal surfaces:
    // authenticated destination/success pin, MFA, or a readable form error.
    let result = null;
    const deadline = Date.now() + 20_000;
    while (!result && Date.now() < deadline) {
      if (/\/(dashboard|timeline|onboarding)/.test(new URL(page.url()).pathname)) {
        result = { kind: 'success' };
      } else if (await page.getByText(/Login successful! Redirecting/i).isVisible()) {
        result = { kind: 'success' };
      } else if (await page.locator('.oc-error-surface p').first().isVisible()) {
        result = {
          kind: 'error',
          message: await page.locator('.oc-error-surface p').first().innerText(),
        };
      } else if (
        await page
          .getByText(/multi-factor|verification code|authenticator/i)
          .first()
          .isVisible()
      ) {
        result = { kind: 'mfa' };
      } else {
        await page.waitForTimeout(200);
      }
    }

    if (!result) {
      throw new Error('Authentication did not reach success, MFA, or a readable error surface.');
    }

    if (result.kind === 'error') {
      throw new Error(`Authentication rejected: ${result.message}`);
    }
    if (result.kind === 'mfa') {
      throw new Error('Authentication requires MFA; an MFA-capable E2E fixture is required.');
    }

    console.log('[global-setup] Login success. Saving storage state...');

    await page.context().storageState({ path: storagePath });
    console.log(`[global-setup] Storage state saved to ${storagePath}`);
  } catch (err) {
    console.warn(
      '[global-setup] Login failed or app not running. Proceeding without storageState.'
    );
    console.warn(err?.message || err);
  } finally {
    await browser.close();
  }
};
