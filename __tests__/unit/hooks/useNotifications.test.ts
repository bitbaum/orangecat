// @vitest-environment jsdom
/**
 * Regression test for the notifications double-fetch.
 *
 * Bug: `offset` was state AND a dependency of `fetchNotifications`, which is
 * itself a dependency of the load effect. The first reset-fetch called
 * `setOffset(limit)`, changing `fetchNotifications`'s reference, which re-ran
 * the effect and fetched page 1 a second time on every mount / filter change.
 *
 * Fix: `offset` became a ref, removing it from the callback deps. These tests
 * lock in "exactly one list fetch on mount" and "filter change refetches once".
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useNotifications } from '@/hooks/useNotifications';
import { API_ROUTES } from '@/config/api-routes';

// Stable references — real useAuth returns a stable user across renders, so the
// mock must too (a fresh object each render would itself retrigger the effect).
const mockStableAuth = { user: { id: 'user-1' } };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockStableAuth,
}));
vi.mock('@/hooks/useNotificationsRealtime', () => ({
  useNotificationsRealtime: vi.fn(),
}));
vi.mock('@/hooks/useNotificationsMutations', () => ({
  useNotificationsMutations: () => ({
    markAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    clearRead: vi.fn(),
  }),
}));

const listUrl = (url: string) => url.startsWith(API_ROUTES.NOTIFICATIONS.BASE + '?');

function mockFetch() {
  return vi.fn((url: string) => {
    if (url === API_ROUTES.NOTIFICATIONS.UNREAD) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: { count: 0 } }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: { notifications: [], total: 0 } }),
    });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useNotifications — no double-fetch', () => {
  it('fetches the notifications list exactly once on mount', async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    renderHook(() => useNotifications());

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([url]) => listUrl(url as string)).length).toBeGreaterThan(
        0
      );
    });
    // Give any erroneous re-fetch effect a chance to fire before asserting.
    await new Promise(r => setTimeout(r, 50));

    const listCalls = fetchMock.mock.calls.filter(([url]) => listUrl(url as string));
    expect(listCalls).toHaveLength(1);
  });

  it('refetches the list once when the filter changes', async () => {
    const fetchMock = mockFetch();
    global.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = renderHook(({ filter }) => useNotifications({ filter }), {
      initialProps: { filter: 'all' },
    });

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => listUrl(url as string)).length).toBe(1)
    );

    rerender({ filter: 'unread' });

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => listUrl(url as string)).length).toBe(2)
    );
    await new Promise(r => setTimeout(r, 50));
    expect(fetchMock.mock.calls.filter(([url]) => listUrl(url as string))).toHaveLength(2);
  });
});
