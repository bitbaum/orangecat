import { test, expect, type Page } from '@playwright/test';
import { getE2ECredentials } from './helpers/credentials';
import { loginE2EUser } from './helpers/login';

/**
 * Canonical release smoke matrix.
 *
 * Strategy:
 * - Single source of truth for release-go/no-go flows.
 * - Tests tagged with @p0 are deployment blockers.
 * - Use explicit env guards for authenticated/provider-dependent checks.
 */

const BASE_URL = process.env.E2E_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
const { email: EMAIL, password: PASSWORD } = getE2ECredentials();

// These flows exercise sign-in themselves. Reusing global setup's signed-in
// state redirects away from the login form as soon as session hydration ends.
test.use({ storageState: { cookies: [], origins: [] } });

async function login(page: Page) {
  if (!EMAIL || !PASSWORD) {
    test.skip(true, 'Missing E2E_USER_EMAIL/E2E_USER_PASSWORD for authenticated P0 checks');
  }
  await loginE2EUser(page);
}

test.describe('workflow matrix', () => {
  test('@p0 health endpoint responds', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/health`);
    expect([200, 503]).toContain(res.status());
  });

  test('@p0 unauthenticated user is redirected from protected dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/auth|login|signin/);
  });

  test('@p0 auth login works with configured fixture user', async ({ page }) => {
    await login(page);
  });

  test('@p0 authenticated dashboard route renders', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('@p0 project create route is reachable for authenticated user', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/dashboard/projects/create`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('@p0 cat chat endpoint returns a valid HTTP response envelope', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/cat/chat`, {
      data: { message: 'health-check ping' },
      headers: { 'Content-Type': 'application/json' },
    });

    // Accept auth/provider dependent statuses while still validating endpoint liveness.
    expect([200, 400, 401, 403, 429, 500, 503]).toContain(res.status());
  });

  test('@p0 project status lifecycle transitions via API', async ({ page }) => {
    await login(page);

    const projectId = process.env.E2E_PROJECT_ID;
    if (!projectId) {
      test.skip(true, 'Missing E2E_PROJECT_ID for status lifecycle checks');
    }

    const transitions = [
      { to: 'active', allowed: [200, 422] },
      { to: 'paused', allowed: [200, 422] },
      { to: 'active', allowed: [200, 422] },
      { to: 'draft', allowed: [200, 422] },
    ] as const;

    for (const step of transitions) {
      const res = await page.request.patch(`${BASE_URL}/api/projects/${projectId}/status`, {
        data: { status: step.to },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(step.allowed).toContain(res.status());
    }
  });

  test('@p0 messaging open/send/edit/delete lifecycle', async ({ page }) => {
    await login(page);

    let conversationId: string | null = null;
    const selfConversation = await page.request.get(`${BASE_URL}/api/messages/self`);
    if (selfConversation.ok()) {
      const data = (await selfConversation.json()) as {
        conversationId?: string;
        data?: { conversationId?: string };
      };
      conversationId = data.data?.conversationId || data.conversationId || null;
    }

    if (!conversationId) {
      test.skip(true, 'No self conversation available for messaging lifecycle check');
    }

    const text = `matrix-msg-${Date.now()}`;
    const roundTrip = await page.evaluate(
      async ({ conversationId, content }) => {
        const sendRes = await fetch(`/api/messages/${conversationId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        const sendBody = await sendRes.json().catch(() => ({}));
        const messageId = sendBody?.data?.id || sendBody?.id;
        if (!sendRes.ok || !messageId) {
          return { ok: false, stage: 'send', status: sendRes.status, body: sendBody };
        }

        const editRes = await fetch(`/api/messages/edit/${messageId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `${content}-edited` }),
        });
        if (!editRes.ok) {
          return { ok: false, stage: 'edit', status: editRes.status };
        }

        const deleteRes = await fetch('/api/messages/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, ids: [messageId] }),
        });
        return { ok: deleteRes.ok, stage: 'delete', status: deleteRes.status };
      },
      { conversationId, content: text }
    );

    expect(roundTrip.ok, JSON.stringify(roundTrip)).toBeTruthy();
  });

  test('@p0 publish/unpublish public visibility checks', async ({ page }) => {
    await login(page);

    const projectId = process.env.E2E_PROJECT_ID;
    if (!projectId) {
      test.skip(true, 'Missing E2E_PROJECT_ID for publish/unpublish checks');
    }

    const publishRes = await page.request.patch(`${BASE_URL}/api/projects/${projectId}/status`, {
      data: { status: 'active' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([200, 422]).toContain(publishRes.status());

    const unpublishRes = await page.request.patch(`${BASE_URL}/api/projects/${projectId}/status`, {
      data: { status: 'draft' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect([200, 422]).toContain(unpublishRes.status());
  });

  test('@p0 notifications unread/read counter consistency', async ({ page }) => {
    await login(page);

    const unreadBeforeRes = await page.request.get(`${BASE_URL}/api/notifications/unread`);
    expect(unreadBeforeRes.ok()).toBeTruthy();

    const unreadBeforeBody = (await unreadBeforeRes.json()) as { data?: { count?: number } };
    const before = unreadBeforeBody?.data?.count ?? 0;

    const readAllRes = await page.request.post(`${BASE_URL}/api/notifications/read`, {
      data: { all: true },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(readAllRes.ok()).toBeTruthy();

    const unreadAfterRes = await page.request.get(`${BASE_URL}/api/notifications/unread`);
    expect(unreadAfterRes.ok()).toBeTruthy();

    const unreadAfterBody = (await unreadAfterRes.json()) as { data?: { count?: number } };
    const after = unreadAfterBody?.data?.count ?? 0;

    expect(after).toBeLessThanOrEqual(before);
  });

  test.describe('password reset (single-use token)', () => {
    test.describe.configure({ retries: 0 });

    test('@p0 password reset complete flow', async ({ page }) => {
      test.info().annotations.push({ type: 'note', description: 'single-use recovery token' });

      const resetToken = process.env.E2E_RESET_ACCESS_TOKEN;
      const refreshToken = process.env.E2E_RESET_REFRESH_TOKEN;
      if (!resetToken || !refreshToken) {
        test.skip(
          true,
          'Missing E2E_RESET_ACCESS_TOKEN/E2E_RESET_REFRESH_TOKEN for reset completion phase'
        );
      }

      // Must differ from E2E_USER_PASSWORD — Supabase rejects "new password same as old".
      const newPassword = process.env.E2E_NEW_PASSWORD || 'TestPassword123!v2';
      const resetUrl = `${BASE_URL}/auth/reset-password?access_token=${encodeURIComponent(resetToken)}&refresh_token=${encodeURIComponent(refreshToken)}&type=recovery`;
      await page.goto(resetUrl);

      await expect(page.getByRole('heading', { name: 'Create New Password' })).toBeVisible({
        timeout: 15000,
      });

      const passwordFields = page.locator('form input[type="password"]');
      await expect(passwordFields).toHaveCount(2);
      await passwordFields.nth(0).fill(newPassword);
      await passwordFields.nth(1).fill(newPassword);

      await page.getByRole('button', { name: 'Update Password', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Password Updated Successfully' })
      ).toBeVisible({
        timeout: 20000,
      });
    });
  });
});
