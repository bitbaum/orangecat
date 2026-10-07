// @vitest-environment jsdom
/**
 * Signing in returns you to where you were going.
 *
 * The auth page sends a fresh session to `?from=` — and this hook, which also
 * fires the moment a session appears, used to push /dashboard regardless.
 * The two raced and the dashboard won: measured on production 2026-10-07,
 * "Start instantly — no email" from /auth?from=/dashboard/cat?q=Throw%20a%20party
 * landed on /dashboard, and the Cat never got the sentence.
 */

import { renderHook } from '@testing-library/react';
import { useRedirectIfAuthenticated } from '@/hooks/useAuthRedirects';

const push = vi.fn();
let search = '';
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  usePathname: () => '/auth',
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'u1' },
    session: { access_token: 'x' },
    profile: null,
    isLoading: false,
    hydrated: true,
  }),
}));

describe('useRedirectIfAuthenticated', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends a signed-in person on to where they were going, query and all', () => {
    search = `from=${encodeURIComponent('/dashboard/cat?q=Throw a party')}`;
    renderHook(() => useRedirectIfAuthenticated());
    expect(push).toHaveBeenCalledWith('/dashboard/cat?q=Throw a party');
  });

  it('falls back to the dashboard with no `from`', () => {
    search = '';
    renderHook(() => useRedirectIfAuthenticated());
    expect(push).toHaveBeenCalledWith('/dashboard');
  });

  it('never follows `from` off the site', () => {
    search = `from=${encodeURIComponent('//evil.example/phish')}`;
    renderHook(() => useRedirectIfAuthenticated());
    expect(push).toHaveBeenCalledWith('/dashboard');
  });
});
