// @vitest-environment jsdom
/**
 * A failed load on People is not an empty network. It used to leave three
 * empty lists and render "No connections yet"; the hook now says it failed,
 * and the page offers "Try again".
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePeopleConnections } from '@/app/(authenticated)/dashboard/people/components/usePeopleConnections';

const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
const fail = () => Promise.resolve(new Response('{}', { status: 500 }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('usePeopleConnections', () => {
  it('reports a failed load instead of an empty list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('/social/') ? ok({ success: true, data: { data: [] } }) : fail()
      )
    );
    const { result } = renderHook(() => usePeopleConnections('u1', true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });

  it('reports no error when every list loads, even empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('/social/')
          ? ok({ success: true, data: { data: [] } })
          : ok({ success: true, data: [] })
      )
    );
    const { result } = renderHook(() => usePeopleConnections('u1', true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toBe(false);
    expect(result.current.allUsers).toEqual([]);
  });
});
