#!/usr/bin/env node
/* eslint-disable no-console -- a CLI talks through stdout */
/**
 * Passkeys, end to end, against a real deployment — with Chromium's virtual
 * authenticator standing in for a fingerprint reader.
 *
 *   BASE=https://orangecat.ch node scripts/auth/passkeys-e2e.mjs
 *
 * Steps (the same three docs/operations/passkeys.md asks a person to do):
 *   1. sign in with an emailed code (a throwaway mail.tm inbox);
 *   2. Settings → Security → Passkeys → Add a passkey → listed;
 *   3. sign out; /auth → Sign in with a passkey → signed in with nothing typed;
 *   4. remove the passkey → the list is empty again.
 *
 * Needs `playwright` (a devDependency) and a Chromium. Exit 0 = every step
 * answered as the runbook says. Skips with exit 2 when the server reports
 * passkeys_enabled: false — that is the box switch, not a bug.
 */
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const BASE = (process.env.BASE ?? 'https://orangecat.ch').replace(/\/$/, '');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const available = await (await fetch(`${BASE}/api/auth/passkeys/available`)).json();
if (available?.data?.available !== true) {
  log(
    'passkeys are switched off at the auth server — nothing to test (see docs/operations/passkeys.md)'
  );
  process.exit(2);
}

// Throwaway inbox for the code sign-in.
const MT = 'https://api.mail.tm';
async function mt(path, init = {}, token) {
  const r = await fetch(MT + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!r.ok) {
    throw new Error(`mail.tm ${path} ${r.status}`);
  }
  return r.json();
}
const domain = (await mt('/domains'))['hydra:member'][0].domain;
const address = `oc-passkey-${Date.now().toString(36)}@${domain}`;
const password = 'Pw-' + crypto.randomBytes(12).toString('base64url');
await mt('/accounts', { method: 'POST', body: JSON.stringify({ address, password }) });
const { token: mtToken } = await mt('/token', {
  method: 'POST',
  body: JSON.stringify({ address, password }),
});
async function waitForCode(after) {
  for (let i = 0; i < 60; i++) {
    const list = (await mt('/messages', {}, mtToken))['hydra:member'].filter(
      m => new Date(m.createdAt).getTime() > after
    );
    if (list.length) {
      const full = await mt(`/messages/${list[0].id}`, {}, mtToken);
      const m = (full.text || '').match(/\b(\d{6})\b/);
      if (m) {
        return m[1];
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('no code email');
}

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.split(' ') : [],
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY, bypass: 'localhost' }
    : undefined,
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(45_000);

// The virtual authenticator: a platform authenticator with resident keys and
// user verification, i.e. what Touch ID or Windows Hello look like to a page.
const cdp = await context.newCDPSession(page);
await cdp.send('WebAuthn.enable');
const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
  options: {
    protocol: 'ctap2',
    transport: 'internal',
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});

try {
  // 1. Code sign-in.
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  const sentAt = Date.now();
  const toggle = page.getByRole('button', { name: /code instead/i });
  await toggle.waitFor();
  for (
    let i = 0;
    i < 10 &&
    !(await page
      .locator('#code-email')
      .isVisible()
      .catch(() => false));
    i++
  ) {
    await toggle.click();
    await page.waitForTimeout(1000);
  }
  await page.locator('#code-email').fill(address);
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await page.locator('#code-digits').waitFor();
  await page.fill('#code-digits', await waitForCode(sentAt - 1000));
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(u => !new URL(u).pathname.startsWith('/auth'), { timeout: 60_000 });
  log('signed in with a code');

  // 2. Add a passkey.
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Add a passkey' }).click();
  await page.getByLabel('Passkey name').fill('Virtual authenticator');
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await page.getByText('Virtual authenticator').waitFor();
  const creds = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  if (creds.credentials.length !== 1) {
    throw new Error(`expected 1 credential, got ${creds.credentials.length}`);
  }
  log('passkey created and listed');

  // 3. Sign out, sign in with the passkey.
  await page.goto(`${BASE}/auth/signout`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await context.clearCookies();
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
  await page.waitForURL(u => !new URL(u).pathname.startsWith('/auth'), { timeout: 60_000 });
  log('signed in with the passkey, nothing typed');

  // 4. Remove it.
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  page.once('dialog', d => d.accept());
  await page
    .getByRole('button', { name: /Remove passkey/ })
    .first()
    .click();
  await page.getByText('No passkeys yet').waitFor();
  log('passkey removed');
  log('PASS');
} catch (e) {
  await page.screenshot({ path: 'passkeys-e2e-fail.png', fullPage: true }).catch(() => {});
  log('FAIL', e.message, page.url());
  process.exitCode = 1;
} finally {
  await browser.close();
}
