import { expect, type Page } from '@playwright/test';
import { requireE2ECredentials } from './credentials';

const BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

/** Log in via /auth?mode=login using configured E2E credentials. */
export async function loginE2EUser(page: Page) {
  const { email, password } = requireE2ECredentials();

  await page.goto(`${BASE_URL}/auth?mode=login`);
  await page.getByLabel('Email address').fill(email);
  // Avoid getByLabel('Password') — matches the "Show password" toggle too.
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  // The form's own button: the page also has a "Sign in | Create account" switch.
  await page
    .locator('form')
    .filter({ has: page.getByRole('textbox', { name: 'Password' }) })
    .getByRole('button', { name: 'Sign in', exact: true })
    .click();

  await expect(page).toHaveURL(/dashboard|profile|create|projects|cat|onboarding/i);
}
