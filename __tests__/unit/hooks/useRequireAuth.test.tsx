// @vitest-environment jsdom
/**
 * The hydration ceiling has to reach every gate, including `isAuthenticated`.
 *
 * `useRequireAuth` exposes `isLoading` and `hydrated` as EFFECTIVE values: once
 * a 4s ceiling fires, they resolve so a page stops waiting on an auth store
 * that is never going to answer. `isAuthenticated` was computed from the RAW
 * store instead, so it opted itself out of the ceiling.
 *
 * On /timeline that produced an infinite spinner. The page renders
 * `isLoading ? spinner : !isAuthenticated ? spinner : content`; the ceiling
 * cleared the first gate after 4s and the second stayed shut forever. It never
 * redirected either — the redirect only fires when there is no user, and there
 * was one. Measured live before the fix: 122 seconds of skeleton, zero network
 * requests, zero long tasks. The app was not slow; it was waiting on a gate
 * that could no longer open.
 *
 * The two cases below are the whole contract: a wedged store with a user must
 * eventually let the page render, and a wedged store WITHOUT one must not.
 */

import { renderHook, act } from '@testing-library/react';
import { useRequireAuth } from '@/hooks/useAuthRedirects';

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/timeline',
}));

let storeState: Record<string, unknown> = {};
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => storeState,
}));

function wedged(overrides: Record<string, unknown> = {}) {
  // What a stuck Supabase session looks like: never hydrated, never resolves.
  storeState = {
    user: { id: 'u1' },
    session: { access_token: 'x' },
    profile: null,
    isLoading: true,
    hydrated: false,
    ...overrides,
  };
}

describe('useRequireAuth hydration ceiling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets a signed-in user through once the ceiling fires', () => {
    wedged();
    const { result } = renderHook(() => useRequireAuth());

    // Before the ceiling: still waiting, which is correct.
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      vi.advanceTimersByTime(4100);
    });

    // After it: the page must be able to render rather than sit on a spinner.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hydrated).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.hydrationTimedOut).toBe(true);
  });

  it('does not claim authentication for someone with no user', () => {
    wedged({ user: null, session: null });
    const { result } = renderHook(() => useRequireAuth());

    act(() => {
      vi.advanceTimersByTime(4100);
    });

    // The ceiling widens the exit; it must never invent a session.
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('reports authentication normally when auth resolves in time', () => {
    storeState = {
      user: { id: 'u1' },
      session: { access_token: 'x' },
      profile: { id: 'u1' },
      isLoading: false,
      hydrated: true,
    };
    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.hydrationTimedOut).toBe(false);
  });
});
