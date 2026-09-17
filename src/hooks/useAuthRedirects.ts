'use client';

import { useAuthStore } from '@/stores/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isAuthenticatedRoute, getRouteContext, ROUTES } from '@/config/routes';

/**
 * Hydration ceiling. If the auth store hasn't resolved after this long,
 * every consumer of useRequireAuth is freed from the loading state so
 * pages can render a real "sign in" CTA instead of a perpetual spinner.
 * Real auth resolves in <300ms; anything past 2-3s is a sign of a
 * broken hydration path (cookie domain mismatch — orangecat.ch vs
 * www.orangecat.ch — blocked storage, third-party script blocking the
 * Supabase client init, …).
 *
 * This used to live as a local timeout in /settings/integrations only;
 * generalized 2026-06-03 so every auth-gated page (settings root,
 * /settings/ai, /settings/ai/onboarding, dashboard subpages, etc.)
 * benefits without each one re-implementing the timeout.
 */
const HYDRATION_TIMEOUT_MS = 4_000;

/**
 * Hydration ceiling timer. Returns true once auth has failed to resolve within
 * HYDRATION_TIMEOUT_MS, so consumers can stop gating on `!hydrated` forever.
 * Shared by useRequireAuth and useAuth so both hook families honor the ceiling.
 */
export function useHydrationCeiling(_hydrated: boolean, _isLoading: boolean): boolean {
  const [hydrationTimedOut, setHydrationTimedOut] = useState(false);
  // ONE absolute timer from mount — deliberately not keyed on auth state.
  // The previous version cleared + restarted the timer whenever hydrated/
  // isLoading changed, so a FLAPPING auth store (a wedged Supabase session
  // whose token refresh 400s and retries, toggling isLoading) reset the
  // ceiling forever and auth-gated pages pinned on their spinner — the
  // exact failure the ceiling exists to end. Firing after auth resolved
  // normally is harmless: consumers read real state first and the flag only
  // widens the exit. Params kept (unused) so call sites stay stable.
  useEffect(() => {
    const timer = setTimeout(() => setHydrationTimedOut(true), HYDRATION_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  return hydrationTimedOut;
}

export function useRequireAuth() {
  const { user, session, profile, isLoading, hydrated } = useAuthStore();
  const [_isConsistent, setIsConsistent] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const [checkedAuth, setCheckedAuth] = useState(false);

  // Start the hydration ceiling timer the moment we mount. If hydration
  // resolves first the timer is cancelled cleanly; otherwise the
  // consumer falls through to the !user branch and renders a sign-in CTA.
  const hydrationTimedOut = useHydrationCeiling(hydrated, isLoading);

  useEffect(() => {
    if (hydrated && !isLoading) {
      const hasInconsistentState = (user && !session) || (!user && session);

      if (hasInconsistentState) {
        const timeoutId = setTimeout(() => {
          setIsConsistent(false);
        }, 2000);
        return () => clearTimeout(timeoutId);
      } else {
        setIsConsistent(true);
        return undefined;
      }
    }
    return undefined;
  }, [user, session, isLoading, hydrated]);

  useEffect(() => {
    if ((!hydrated || isLoading) && !hydrationTimedOut) {
      return;
    }

    const isAuthenticated = !!user;

    if (!isAuthenticated) {
      // Preserve the original destination so post-login we send the user
      // back where they were trying to go. Without this, signing in from
      // /dashboard/projects lands on /dashboard regardless.
      const from = pathname && pathname !== '/' ? pathname : null;
      const redirectUrl = from
        ? `${ROUTES.AUTH}?mode=login&from=${encodeURIComponent(from)}`
        : `${ROUTES.AUTH}?mode=login`;
      router.push(redirectUrl);
    }

    setCheckedAuth(true);
  }, [user, isLoading, hydrated, router, pathname, hydrationTimedOut]);

  // isLoading stays true while hydration is in flight AND the ceiling
  // hasn't fired yet. Once timed out, isLoading flips false so pages
  // render their fallback state instead of pinning a spinner forever.
  const effectiveIsLoading = (isLoading || !hydrated || !checkedAuth) && !hydrationTimedOut;

  // Report the SAME ceiling through `hydrated`. Many auth-gated pages gate on
  // `!hydrated || isLoading` (EntityDashboardPage, settings/ai, research, …).
  // If we returned raw `hydrated`, the 4s ceiling would flip `isLoading` off
  // but `!hydrated` would keep those pages pinned on a spinner forever when
  // hydration never resolves (e.g. Supabase multi-tab lock contention, cookie
  // domain mismatch). Treating a timed-out gate as "resolved" lets the page
  // fall through to its `!user` branch — a sign-in CTA / redirect — which is
  // exactly what the ceiling was built to deliver. No happy-path change: real
  // auth resolves in <300ms, long before the 4s timer, so effectiveHydrated
  // === hydrated in the normal case.
  const effectiveHydrated = hydrated || hydrationTimedOut;

  return {
    user,
    profile,
    session,
    isLoading: effectiveIsLoading,
    hydrated: effectiveHydrated,
    /** True when the 4s hydration ceiling fired before auth resolved.
     * Pages can branch on this to show "auth seems stuck — sign in" UX. */
    hydrationTimedOut,
    // The EFFECTIVE flags, for the same reason the two above are computed:
    // this line used to read raw `hydrated` / `isLoading`, so it opted itself
    // out of the ceiling that every other field honours.
    //
    // What that cost, measured on /timeline in production: the page renders
    // `isLoading ? spinner : !isAuthenticated ? spinner : content`. After 4s
    // the ceiling cleared the FIRST gate and the second one — reading raw
    // state — stayed false forever, so the page sat on "Redirecting to
    // login..." indefinitely. It never redirected either, because the redirect
    // only fires when there is no `user`, and there was one. Observed live:
    // 122 seconds of skeleton, zero network requests, zero long tasks — the
    // app was not slow, it was waiting for a gate that could no longer open.
    //
    // `!!user` is unchanged and still does the real work: a timed-out ceiling
    // can only report authenticated for someone who already has a user object.
    isAuthenticated: !!user && effectiveHydrated && !effectiveIsLoading,
  };
}

export function useRedirectIfAuthenticated() {
  const { user, session, isLoading, hydrated, profile } = useAuthStore();
  const [_isConsistent, setIsConsistent] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (hydrated && !isLoading) {
      const hasInconsistentState = (user && !session) || (!user && session);

      if (hasInconsistentState) {
        const timeoutId = setTimeout(() => {
          setIsConsistent(false);
        }, 2000);
        return () => clearTimeout(timeoutId);
      } else {
        setIsConsistent(true);
        return undefined;
      }
    }
    return undefined;
  }, [user, session, isLoading, hydrated]);

  useEffect(() => {
    if (!hydrated || isLoading) {
      return;
    }

    const isAuthenticated = !!user;

    if (
      isAuthenticated &&
      pathname &&
      pathname !== '/' &&
      !isAuthenticatedRoute(pathname) &&
      getRouteContext(pathname) !== 'public' &&
      getRouteContext(pathname) !== 'universal'
    ) {
      router.push(ROUTES.DASHBOARD.HOME);
    }
  }, [user, session, isLoading, hydrated, router, pathname, profile]);

  return {
    isLoading: isLoading || !hydrated,
    hydrated,
    isAuthenticated: !!user && hydrated && !isLoading,
  };
}
