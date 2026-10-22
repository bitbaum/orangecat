'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { offlineQueueService } from '@/lib/offline-queue';

/**
 * AuthProvider - Syncs Supabase auth state with Zustand store
 *
 * This component establishes the critical onAuthStateChange listener
 * that keeps client-side state synchronized with Supabase auth events.
 *
 * Key events handled:
 * - INITIAL_SESSION: Set initial auth state from stored session
 * - SIGNED_IN: User successfully authenticated
 * - SIGNED_OUT: User logged out or session expired
 * - TOKEN_REFRESHED: Access token was refreshed
 * - USER_UPDATED: User profile/metadata changed
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setInitialAuthState = useAuthStore(state => state.setInitialAuthState);
  const fetchProfile = useAuthStore(state => state.fetchProfile);
  const clear = useAuthStore(state => state.clear);
  const listenerRef = useRef<{ data: { subscription: { unsubscribe: () => void } } } | null>(null);
  const hasSyncedInitialSession = useRef(false);
  // Track fallback timers so they don't fire setState after unmount (HMR, route change).
  const pendingTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  // Cross-tab broadcast channel for instant auth-state propagation. Supabase's
  // storage-event sync eventually catches up, but there's a 100-500ms lag during
  // which other tabs show stale signed-in chrome after a sign-out. The channel
  // makes the propagation synchronous within the browser.
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Prevent duplicate listeners
    if (listenerRef.current) {
      logger.debug('AuthProvider listener already exists, skipping setup', undefined, 'Auth');
      return;
    }

    logger.info('Setting up auth state change listener', undefined, 'Auth');

    // Safety net — scheduled FIRST, before any Supabase call. If
    // INITIAL_SESSION never fires (Supabase bug, network blip) OR the listener
    // setup below throws (multi-tab navigator-lock contention, corrupted token
    // in storage), force hydrated=true after 3s so auth-gated pages resolve to
    // a sign-in CTA instead of hanging on a spinner forever. Scheduling it up
    // front means a throw in onAuthStateChange() can no longer starve it.
    const fallback = setTimeout(() => {
      pendingTimersRef.current.delete(fallback);
      const currentState = useAuthStore.getState();
      if (!currentState.hydrated) {
        logger.warn(
          'Force-setting hydrated state — INITIAL_SESSION never arrived',
          undefined,
          'Auth'
        );
        setInitialAuthState(null, null, null);
      }
    }, 3000);
    pendingTimersRef.current.add(fallback);

    // createBrowserClient's cookie adapter is the session SSOT (browser.ts).
    // A second server-sync POST delays hydration and can rewrite stale cookies
    // after a later sign-out. Accept the SDK event without a network barrier.

    // NOTE: We don't call getSession() here because:
    // 1. onAuthStateChange will fire INITIAL_SESSION event with the current session
    // 2. This prevents duplicate session checks and excessive lock acquisitions
    // 3. The INITIAL_SESSION handler below will handle any session mismatch

    // Set up the auth state change listener. Wrapped so a throw here (e.g.
    // Supabase client init failing on a locked/corrupted token) can't abort the
    // effect before the safety-net fallback above gets a chance to run.
    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        logger.debug(
          'Auth state change detected',
          {
            event,
            hasSession: !!session,
            hasUser: !!session?.user,
          },
          'Auth'
        );

        // Handle different auth events
        switch (event) {
          case 'INITIAL_SESSION':
            // Initial session load - set state with existing session
            logger.info(
              'INITIAL_SESSION event received',
              { hasSession: !!session, hasUser: !!session?.user },
              'Auth'
            );
            if (session?.user) {
              const storedUser = useAuthStore.getState().user;

              // Check for session mismatch (user ID changed)
              if (storedUser && storedUser.id !== session.user.id) {
                logger.warn(
                  'Session mismatch detected - clearing stale auth data',
                  {
                    storedUserId: storedUser.id,
                    sessionUserId: session.user.id,
                  },
                  'Auth'
                );
                clear();
              }

              // Always clear profile on initial session to prevent stale data
              setInitialAuthState(session.user, session, null);
              logger.info('Set initial auth state with user', { userId: session.user.id }, 'Auth');
              // Fetch profile in background
              fetchProfile().catch(err => {
                logger.warn('Failed to fetch profile on initial session', { error: err }, 'Auth');
              });
            } else {
              logger.info('No session found, setting null auth state', undefined, 'Auth');
              setInitialAuthState(null, null, null);
            }
            break;

          case 'SIGNED_IN':
            // User just signed in - set user and session
            if (session?.user) {
              logger.info('User signed in', { userId: session.user.id }, 'Auth');
              // Always clear profile on sign in to prevent stale data from previous user
              setInitialAuthState(session.user, session, null);
              // Fetch profile in background (only once - AuthStore signIn no longer fetches)
              // Use a small delay to ensure state is set before fetching
              const t = setTimeout(() => {
                pendingTimersRef.current.delete(t);
                fetchProfile().catch(err => {
                  logger.warn('Failed to fetch profile after sign in', { error: err }, 'Auth');
                });
              }, 100);
              pendingTimersRef.current.add(t);
            }
            break;

          case 'SIGNED_OUT':
            // User signed out or session expired
            logger.info('User signed out', undefined, 'Auth');
            // Clear any queued offline posts to prevent cross-user leakage
            clear();
            void offlineQueueService.clearQueue().catch(error => {
              logger.warn('Failed to clear offline queue on sign out', { error }, 'Auth');
            });
            // Tell every other tab in this browser to sign out immediately
            // instead of waiting for their storage-event listener to catch up.
            // The receiving side calls clear() too (see channel listener below).
            broadcastRef.current?.postMessage({ type: 'SIGNED_OUT' });
            break;

          case 'TOKEN_REFRESHED':
            // Token was refreshed - update session
            if (session?.user) {
              logger.debug('Token refreshed', { userId: session.user.id }, 'Auth');
              setInitialAuthState(session.user, session, null);
            }
            break;

          case 'USER_UPDATED':
            // User metadata or profile updated
            if (session?.user) {
              logger.debug('User updated', { userId: session.user.id }, 'Auth');
              setInitialAuthState(session.user, session, null);
              // Re-fetch profile to get latest data
              fetchProfile().catch(err => {
                logger.warn('Failed to fetch profile after user update', { error: err }, 'Auth');
              });
            }
            break;

          case 'PASSWORD_RECOVERY':
            // User is in password recovery flow
            logger.info('Password recovery event detected', undefined, 'Auth');
            // Session should contain the recovery token
            if (session?.user) {
              setInitialAuthState(session.user, session, null);
            }
            break;

          default:
            logger.warn('Unknown auth event', { event }, 'Auth');
        }
      });

      listenerRef.current = { data: { subscription } };
    } catch (error) {
      logger.error(
        'Failed to set up auth state listener — hydration fallback will resolve auth',
        { error },
        'Auth'
      );
    }

    // Handle the Remember-Me preference: if the user opted out and this is
    // a new browser session, sign them out before INITIAL_SESSION fires.
    // INITIAL_SESSION is handled once by the listener above; the cookie
    // adapter handles persistence. Do not prime or sync the session again.
    const handleRememberMePreference = async () => {
      if (hasSyncedInitialSession.current) {
        return;
      }
      hasSyncedInitialSession.current = true;

      try {
        const rememberMe = localStorage.getItem('orangecat-remember-me');
        const sessionMarker = sessionStorage.getItem('orangecat-session-marker');

        if (rememberMe === 'false' && !sessionMarker) {
          logger.info(
            'Remember-me disabled and new browser session detected — signing out',
            undefined,
            'Auth'
          );
          await supabase.auth.signOut();
          localStorage.removeItem('orangecat-remember-me');
          // SIGNED_OUT event fires from the signOut() above and clears state
          // via the listener. No setInitialAuthState here.
          return;
        }

        if (rememberMe === 'true' || sessionMarker) {
          sessionStorage.setItem('orangecat-session-marker', 'active');
        }
      } catch {
        logger.debug(
          'Could not check remember-me preference — storage not available',
          undefined,
          'Auth'
        );
      }
    };
    handleRememberMePreference().catch(error => {
      logger.warn('Remember-me handler failed on mount', { error }, 'Auth');
    });

    // Subscribe to other tabs' sign-out broadcasts. When the user signs
    // out in any tab, every tab that's open in this browser clears
    // immediately (no need to wait for Supabase's storage-event sync to
    // catch up — that already happens, this is the instant path). The
    // typeof guard handles older browsers / SSR safely.
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      try {
        const channel = new BroadcastChannel('orangecat-auth');
        channel.onmessage = event => {
          if (event.data?.type === 'SIGNED_OUT') {
            logger.info('Cross-tab SIGNED_OUT received — clearing local auth', undefined, 'Auth');
            clear();
            void offlineQueueService.clearQueue().catch(error => {
              logger.warn('Failed to clear offline queue in this tab', { error }, 'Auth');
            });
          }
        };
        broadcastRef.current = channel;
      } catch (error) {
        logger.warn('Could not open auth BroadcastChannel', { error }, 'Auth');
      }
    }

    // Capture the Set instance on entry so the cleanup runs against the
    // same instance the body's scheduling closures were adding to.
    const timers = pendingTimersRef.current;

    // Cleanup on unmount
    return () => {
      if (listenerRef.current) {
        logger.debug('Cleaning up auth state change listener', undefined, 'Auth');
        listenerRef.current.data.subscription.unsubscribe();
        listenerRef.current = null;
      }
      if (broadcastRef.current) {
        broadcastRef.current.close();
        broadcastRef.current = null;
      }
      timers.forEach(id => clearTimeout(id));
      timers.clear();
    };
  }, [setInitialAuthState, fetchProfile, clear]);

  return <>{children}</>;
}
