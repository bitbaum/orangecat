// Playwright global setup to pre-authenticate and save storage state for tests.
// Requires environment variables: E2E_USER_EMAIL and E2E_USER_PASSWORD
// (legacy E2E_TEST_USER_* also accepted).
// If credentials are missing or login fails, setup falls back gracefully (no storageState).

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

module.exports = async () => {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const email = process.env.E2E_TEST_USER_EMAIL || process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD || process.env.E2E_USER_PASSWORD;

  const authDir = path.resolve(__dirname, '..', '.auth');
  const storagePath = path.join(authDir, 'user.json');

  // Ensure auth directory exists
  fs.mkdirSync(authDir, { recursive: true });

  if (!email || !password) {
    console.warn('[global-setup] Missing E2E_USER_EMAIL/E2E_USER_PASSWORD; skipping pre-auth.');
    return;
  }

  // The sign-in page can hold two email inputs for a moment (the form is drawn
  // twice around hydration, one copy hidden), and a bare
  // `locator('input[type="email"]')` then throws a strict-mode violation.
  // That silently left every spec without a session: "bounced to sign-in"
  // for the Cat chat smoke (PR run 2026-10-27 22:42), while the same specs
  // passed on the next run. Take the visible one, and try three times.
  const attempts = 3;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(`[global-setup] Starting login flow (attempt ${attempt}/${attempts})...`);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
      await page.goto(`${baseURL}/auth?mode=login`, { waitUntil: 'domcontentloaded' });
      const emailInput = page.locator('input[type="email"]:visible').first();
      await emailInput.waitFor({ state: 'visible', timeout: 15000 });

      await emailInput.fill(email);
      await page.locator('input[type="password"]:visible').first().fill(password);
      await page.locator('form button[type="submit"]:visible').first().click();

      // Wait for a successful redirect to an authenticated route
      await page.waitForURL(/\/(dashboard|timeline|onboarding)/, { timeout: 15000 });
      console.log('[global-setup] Login success. Saving storage state...');

      await page.context().storageState({ path: storagePath });
      console.log(`[global-setup] Storage state saved to ${storagePath}`);
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[global-setup] Login attempt ${attempt} failed:`, err?.message || err);
    } finally {
      await browser.close();
    }
  }

  // Without a session every signed-in spec fails with a misleading "bounced to
  // sign-in". In CI, where the credentials exist, say so here instead.
  if (process.env.CI) {
    throw new Error(`[global-setup] Could not sign in as the E2E account: ${lastError?.message}`);
  }
  console.warn('[global-setup] Login failed or app not running. Proceeding without storageState.');
};
