// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useOwnSearchThings } from '@/hooks/useOwnSearchThings';
const auth = vi.hoisted(() => ({ userId: 'a' as string | null }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: auth.userId ? { id: auth.userId } : null }),
}));
const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
const publicReply = (id: string) => ({
  ok: true,
  json: async () => ({ data: { hits: [{ id, title: id }], total: 1, suggestion: null } }),
});
afterEach(() => {
  clients.splice(0).forEach(c => c.clear());
  vi.unstubAllGlobals();
  auth.userId = 'a';
});
it('reports a failed search and retries the same query successfully', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce(publicReply('Cato'));
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useGlobalSearch('cqto'), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.results).toEqual([]);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.results[0]?.id).toBe('Cato'));
  expect(result.current.error).toBeNull();
  expect(
    fetcher.mock.calls.map(([url]) =>
      new URL(String(url), 'https://review.test').searchParams.get('q')
    )
  ).toEqual(['cqto', 'cqto']);
});
it('treats malformed success responses as failures, rather than no results', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { hits: [] } }) })
  );
  const { result } = renderHook(() => useGlobalSearch('cqto'), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.error).toBeTruthy());
});
it('drops a late response for an older public query', async () => {
  let finishOld!: (value: unknown) => void;
  const fetcher = vi
    .fn()
    .mockReturnValueOnce(
      new Promise(resolve => {
        finishOld = resolve;
      })
    )
    .mockResolvedValueOnce(publicReply('new'));
  vi.stubGlobal('fetch', fetcher);
  const { result, rerender } = renderHook(({ q }) => useGlobalSearch(q), {
    initialProps: { q: 'old' },
    wrapper: wrapper(),
  });
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  rerender({ q: 'new' });
  await waitFor(() => expect(result.current.results[0]?.id).toBe('new'));
  await act(async () => {
    finishOld(publicReply('old'));
  });
  expect(result.current.results[0]?.id).toBe('new');
});
it('isolates private suggestions immediately by account and clears them on sign out', async () => {
  let finishB!: (value: unknown) => void;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { things: [{ id: 'private-a', title: 'Private A' }] } }),
      })
      .mockReturnValueOnce(
        new Promise(resolve => {
          finishB = resolve;
        })
      )
  );
  const { result, rerender } = renderHook(() => useOwnSearchThings(true), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.things[0]?.id).toBe('private-a'));
  auth.userId = 'b';
  rerender();
  expect(result.current.things).toEqual([]);
  await act(async () => {
    finishB({
      ok: true,
      json: async () => ({ data: { things: [{ id: 'private-b', title: 'Private B' }] } }),
    });
  });
  await waitFor(() => expect(result.current.things[0]?.id).toBe('private-b'));
  auth.userId = null;
  rerender();
  expect(result.current.things).toEqual([]);
});
it('does not search when the palette is closed or the query is too short', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useGlobalSearch('c', false), { wrapper: wrapper() });
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBeNull();
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 120));
  });
  expect(fetcher).not.toHaveBeenCalled();
});
