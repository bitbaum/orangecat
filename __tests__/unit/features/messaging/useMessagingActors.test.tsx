// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMessagingActors } from '@/features/messaging/hooks/useMessagingActors';
const auth = vi.hoisted(() => ({ userId: 'account-a' as string | null }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }),
}));
const personal = {
  actor_id: 'actor-a',
  actor_type: 'user',
  name: 'Review personal',
  avatar_url: null,
  is_personal: true,
};
const group = {
  actor_id: 'actor-b',
  actor_type: 'group',
  name: 'Review group',
  avatar_url: null,
  is_personal: false,
};
const response = (actors: unknown[]) => ({
  ok: true,
  json: async () => ({ success: true, data: { actors } }),
});
afterEach(() => {
  vi.unstubAllGlobals();
  auth.userId = 'account-a';
});
describe('Messaging identity API contract', () => {
  it('reads the API envelope for personal and group identities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response([personal, group])));
    const { result } = renderHook(() => useMessagingActors());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.personalActor).toEqual(personal);
    expect(result.current.groupActors).toEqual([group]);
    expect(result.current.error).toBeNull();
  });
  it('reports a failed request and recovers through retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce(response([personal]))
    );
    const { result } = renderHook(() => useMessagingActors());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.personalActor).toEqual(personal));
    expect(result.current.error).toBeNull();
  });
  it('does not silently treat an invalid envelope as an empty identity list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ actors: [personal] }) })
    );
    const { result } = renderHook(() => useMessagingActors());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.actors).toEqual([]);
  });
  it('ignores an old account response and clears identities on sign out', async () => {
    let resolveOld!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockReturnValueOnce(
          new Promise(resolve => {
            resolveOld = resolve;
          })
        )
        .mockResolvedValueOnce(response([group]))
    );
    const { result, rerender } = renderHook(() => useMessagingActors());
    auth.userId = 'account-b';
    rerender();
    await waitFor(() => expect(result.current.actors).toEqual([group]));
    await act(async () => {
      resolveOld(response([personal]));
    });
    expect(result.current.actors).toEqual([group]);
    auth.userId = null;
    rerender();
    expect(result.current.actors).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
