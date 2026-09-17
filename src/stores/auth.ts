'use client';

import { logger } from '@/utils/logger';
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';
import {
  signIn as authSignIn,
  signUp as authSignUp,
  signOut as authSignOut,
} from '@/services/supabase/auth';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface AuthState {
  // data
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  // ui state
  isLoading: boolean;
  error: string | null;
  hydrated: boolean;
  authError: string | null;
  // actions
  setInitialAuthState: (
    user: User | null,
    session: Session | null,
    profile: Profile | null
  ) => void;
  clear: () => void;
  signOut: () => Promise<{ error: Error | null }>;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<{
    data: { user: User | null; session: Session | null } | null;
    error: Error | null;
  }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{
    data: { user: User | null; session: Session | null } | null;
    error: Error | null;
  }>;
  updateProfile: (profileData: Partial<Profile>) => Promise<{ error: string | null }>;
  setError: (error: string | null) => void;
  setAuthError: (error: string | null) => void;
  fetchProfile: () => Promise<{ error: string | null }>;
}

const STORAGE_KEY = 'orangecat-auth-storage';

// Defensive storage wrapper: avoid runtime crashes when persisted JSON is malformed
const safeSessionStateStorage: StateStorage = {
  getItem: key => {
    try {
      const value = sessionStorage.getItem(key);
      if (!value) {
        return null;
      }

      // Validate JSON before Zustand parser runs
      JSON.parse(value);
      return value;
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // ignore cleanup failure
      }
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // ignore storage write failures in restricted browser modes
    }
  },
  removeItem: key => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore storage cleanup failures
    }
  },
};

// Request deduplication: Track in-flight profile fetch
let inFlightProfileFetch: Promise<{ error: string | null }> | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // ==================== STATE ====================
      user: null,
      session: null,
      profile: null,
      isLoading: false,
      error: null,
      hydrated: false,
      authError: null,

      // ==================== ACTIONS ====================
      setInitialAuthState: (
        user: User | null,
        session: Session | null,
        profile: Profile | null
      ) => {
        const currentState = get();

        // If user ID changed, clear old profile to prevent showing stale data
        if (currentState.user?.id && user?.id && currentState.user.id !== user.id) {
          logger.debug(
            'User ID changed - clearing stale profile',
            { oldUserId: currentState.user.id, newUserId: user.id },
            'Auth'
          );
          // Clear profile first to prevent flash of old data
          set({ profile: null });
        }

        // If explicitly passing null profile, ensure it's cleared
        // This prevents persisted stale profile from showing
        const finalProfile =
          profile || (user && currentState.user?.id === user.id ? currentState.profile : null);

        set({ user, session, profile: finalProfile, hydrated: true, isLoading: false });
      },

      clear: () => {
        set({
          user: null,
          session: null,
          profile: null,
          error: null,
          authError: null,
          isLoading: false,
        });
      },

      setError: (error: string | null) => set({ error }),
      setAuthError: (authError: string | null) => set({ authError }),

      fetchProfile: async () => {
        // Deduplicate concurrent requests - if already fetching, return same promise
        if (inFlightProfileFetch) {
          logger.debug('Deduplicating profile fetch - using in-flight request', undefined, 'Auth');
          return inFlightProfileFetch;
        }

        const currentState = get();
        if (!currentState.user?.id) {
          return { error: 'No authenticated user' };
        }

        // Create and store the fetch promise
        inFlightProfileFetch = (async () => {
          try {
            const response = await fetch(API_ROUTES.PROFILE);
            const result = await response.json();

            if (!response.ok) {
              return { error: apiErrorMessage(result, 'Failed to fetch profile') };
            }

            if (result.success && result.data) {
              set({ profile: result.data });
              return { error: null };
            } else {
              return { error: 'Profile not found' };
            }
          } catch (error) {
            logger.error('Failed to fetch profile:', error);
            return { error: 'Failed to fetch profile' };
          } finally {
            // Clear the in-flight promise after a small delay to allow near-simultaneous calls to deduplicate
            setTimeout(() => {
              inFlightProfileFetch = null;
            }, 100);
          }
        })();

        return inFlightProfileFetch;
      },

      signOut: async () => {
        set({ isLoading: true, authError: null });
        try {
          // Use centralized auth service instead of direct Supabase call
          const { error } = await authSignOut();

          if (error) {
            set({ authError: error.message, isLoading: false });
            return { error: new Error(error.message) };
          }

          // Clean up remember me preference
          try {
            localStorage.removeItem('orangecat-remember-me');
            sessionStorage.removeItem('orangecat-session-marker');
          } catch {
            // Storage may not be available
          }

          get().clear();
          set({ isLoading: false, authError: null });
          return { error: null };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Sign out failed';
          set({ authError: errMsg, isLoading: false });
          return { error: new Error(errMsg) };
        }
      },

      signIn: async (email, password, rememberMe = true) => {
        const currentState = get();
        if (currentState.isLoading) {
          return { data: null, error: new Error('Sign in already in progress') };
        }

        set({ isLoading: true, authError: null, error: null });

        try {
          // Use centralized auth service instead of direct Supabase call
          // This provides timeout handling, error handling, and logging
          const result = await authSignIn({ email, password });

          if (result.error) {
            set({ authError: result.error.message, isLoading: false });
            return { data: null, error: new Error(result.error.message) };
          }

          if (result.data?.user && result.data?.session) {
            // Store remember me preference for session persistence
            try {
              localStorage.setItem('orangecat-remember-me', rememberMe ? 'true' : 'false');
              // Set a session marker so we can detect new browser sessions
              sessionStorage.setItem('orangecat-session-marker', 'active');
            } catch {
              // Storage may not be available (e.g., private browsing)
            }

            set({
              user: result.data.user,
              session: result.data.session,
              isLoading: false,
              authError: null,
              error: null,
            });

            // Don't fetch profile here - AuthProvider will handle it via onAuthStateChange
            // This prevents duplicate profile fetches during login

            return { data: result.data, error: null };
          } else {
            set({ authError: 'No user data received', isLoading: false });
            return { data: null, error: new Error('No user data received') };
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Sign in failed';
          set({ authError: errMsg, isLoading: false });
          return { data: null, error: new Error(errMsg) };
        }
      },

      signUp: async (email, password) => {
        const currentState = get();
        if (currentState.isLoading) {
          return { data: null, error: new Error('Sign up already in progress') };
        }

        set({ isLoading: true, authError: null, error: null });

        try {
          // Use centralized auth service instead of direct Supabase call
          // This provides timeout handling, error handling, and logging
          const result = await authSignUp({ email, password });

          if (result.error) {
            set({ authError: result.error.message, isLoading: false });
            return { data: null, error: new Error(result.error.message) };
          }

          // Handle successful sign up - check if we have a session
          if (result.data?.user && result.data?.session) {
            set({
              user: result.data.user,
              session: result.data.session,
              isLoading: false,
              authError: null,
              error: null,
            });

            // Fetch profile after successful auth
            await get().fetchProfile();

            return { data: result.data, error: null };
          } else {
            // Sign up successful but no immediate session (email confirmation required)
            set({ isLoading: false, authError: null, error: null });
            return { data: result.data, error: null };
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Sign up failed';
          set({ authError: errMsg, isLoading: false });
          return { data: null, error: new Error(errMsg) };
        }
      },

      updateProfile: async (profileData: Partial<Profile>) => {
        const currentState = get();
        if (!currentState.user?.id) {
          return { error: 'No authenticated user' };
        }

        try {
          set({ isLoading: true });

          const response = await fetch(API_ROUTES.PROFILE, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(profileData),
          });

          const result = await response.json();

          if (!response.ok) {
            set({ isLoading: false });
            return { error: apiErrorMessage(result, 'Failed to update profile') };
          }

          // Refetch profile to get updated data
          const fetchResult = await get().fetchProfile();
          set({ isLoading: false });

          return fetchResult;
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : 'Update profile failed';
          set({ isLoading: false });
          return { error: errMsg };
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeSessionStateStorage),
      partialize: state => ({
        // Only persist user and session - NOT profile to prevent stale data
        // Profile is always fetched fresh on login to ensure accuracy
        user: state.user,
        session: state.session,
        hydrated: state.hydrated,
        // Explicitly exclude profile from persistence
      }),
      skipHydration: false,
      // Migration function to clear stale profile data
      migrate: (persistedState: unknown, _version: number) => {
        // Clear any persisted profile to prevent stale data
        const state = persistedState as Partial<AuthState> & Record<string, unknown>;
        if (state && state.profile) {
          state.profile = null;
        }
        return state as unknown;
      },
    }
  )
);
