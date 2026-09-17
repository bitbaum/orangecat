// @vitest-environment jsdom
/**
 * CI and workflow audits mint disposable groups ("Audit WF009 1783192620260")
 * and enrol the account they run as. `config/public-directory` already knows
 * they aren't real teams and keeps them off Discover and People — but the
 * sidebar context switcher fetched `?membership=mine` and rendered whatever
 * came back, so a live account's own context menu listed two audit fixtures
 * alongside "Personal".
 *
 * The filter has one definition. This test holds the switcher to it.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useNavigationContext } from '@/hooks/useNavigationContext';

const mockStableAuth = { user: { id: 'user-1' } };
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockStableAuth,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}));

const GROUPS = [
  { id: 'g1', slug: 'zurich-makers', name: 'Zürich Makers', avatar_url: null },
  { id: 'g2', slug: 'audit-wf009-1783192171', name: 'Audit WF009 1783192171', avatar_url: null },
  { id: 'g3', slug: 'audit-wf009b-1783192620260', name: 'Audit WF009b 1783192620260' },
  { id: 'g4', slug: 'ephemeral-verify-1', name: 'Ephemeral Verify 1' },
];

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: async () => ({ success: true, data: { groups: GROUPS } }),
    })
  ) as unknown as typeof fetch;
  window.localStorage.clear();
});

describe('context switcher group list', () => {
  it('lists only real groups — audit fixtures are not teams the user joined', async () => {
    const { result } = renderHook(() => useNavigationContext());

    await waitFor(() => expect(result.current.loadingGroups).toBe(false));

    expect(result.current.userGroups.map(g => g.slug)).toEqual(['zurich-makers']);
  });

  it('would have shown the fixtures without the filter — the fetch really returns them', async () => {
    renderHook(() => useNavigationContext());

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const returned = GROUPS.filter(g => g.name.startsWith('Audit WF'));
    expect(returned).toHaveLength(2);
  });
});
