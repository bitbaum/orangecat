/**
 * Auth smoke test
 * Verifies that public home redirects authenticated users to /dashboard
 * and that unauthenticated users see the public client.
 *
 * This is a lightweight guard for “fast login” regressions.
 */

import { redirect } from 'next/navigation';

import type { Mock } from 'vitest';

describe('auth smoke', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders public home when not authenticated', async () => {
    // jest.isolateModulesAsync has no vitest equivalent; beforeEach's
    // vi.resetModules() plus vi.doMock give each test a fresh module graph.
    await (async () => {
      vi.doMock('next/navigation', () => ({
        redirect: vi.fn(),
      }));
      vi.doMock('@/lib/supabase/server', () => ({
        createServerClient: () =>
          Promise.resolve({
            auth: {
              getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
            },
          }),
      }));

      const { default: Home } = await import('@/app/page');
      await Home();
      const { redirect } = await import('next/navigation');
      expect(redirect as Mock).not.toHaveBeenCalled();
    })();
  });

  it('redirects to dashboard when authenticated', async () => {
    await (async () => {
      vi.doMock('next/navigation', () => ({
        redirect: vi.fn(),
      }));
      vi.doMock('@/lib/supabase/server', () => ({
        createServerClient: () =>
          Promise.resolve({
            auth: {
              getUser: vi.fn().mockResolvedValue({ data: { user: { id: '123' } } }),
            },
            from: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { onboarding_completed: true },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
      }));

      const { default: Home } = await import('@/app/page');
      await Home();
      const { redirect } = await import('next/navigation');
      expect(redirect as Mock).toHaveBeenCalled();
    })();
  });
});
