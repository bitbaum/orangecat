'use client';

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';

// Environment variables (must be present; no client-side fallbacks)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast to avoid leaking placeholder keys or silently using wrong project
  const message =
    'Supabase client misconfigured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).';
  if (process.env.NODE_ENV === 'development') {
    throw new Error(message);
  }
  // In production, throw to prevent shipping a broken auth client
  throw new Error(message);
}

// Validate URL format early. Any https origin is fine — the API has been
// self-hosted (supabase.orangecat.ch) since the 2026-06 Hetzner migration.
if (!supabaseUrl.startsWith('https://')) {
  throw new Error('Supabase URL format looks incorrect. Expected an https:// URL');
}

// Auth-session storage: intentionally NOT overridden. @supabase/ssr's
// createBrowserClient defaults to a COOKIE adapter so the browser and the
// server (src/lib/supabase/server.ts + middleware) share ONE cookie-based
// session. The previous `storage: safeStorage` (localStorage) override broke
// that: password/anonymous logins only wrote localStorage, so server routes and
// middleware couldn't see the session until the /api/auth/sync band-aid fired,
// and nothing cleaned the server-set cookies on sign-out — they accumulated
// across login cycles + project-ref changes until the Cookie header overflowed
// (HTTP 431). Using the cookie default unifies the session and lets the client
// own the cookie lifecycle (set on login, refresh in place, clear on sign-out).

// Create the browser client with optimized configuration for authentication
// Control debug logging via environment variable (default: only in development)
const enableAuthDebug =
  process.env.NEXT_PUBLIC_SUPABASE_DEBUG === 'true' ||
  (process.env.NEXT_PUBLIC_SUPABASE_DEBUG !== 'false' && process.env.NODE_ENV === 'development');

const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // No `storage` override → @supabase/ssr cookie adapter (shared with server).
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Fixed: Aligned timeout with auth operations
    flowType: 'pkce',
    debug: enableAuthDebug, // Controlled by NEXT_PUBLIC_SUPABASE_DEBUG env var
    // Passkeys (WebAuthn). The client throws on every passkey call without this
    // flag; whether the SERVER has them on is a separate question the UI asks
    // through lib/auth/passkeys-availability before offering a button.
    experimental: { passkey: true },
  },
  // Fixed: Increased timeout to match auth operations (20s)
  global: {
    fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 20000);

      // Combine with existing signal if present
      const combinedSignal = timeoutController.signal;
      if (options.signal) {
        // If there's an existing signal, abort our timeout when the existing signal aborts
        options.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          timeoutController.abort();
        });
      }

      return fetch(url, {
        ...options,
        signal: combinedSignal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    },
  },
  // Add database configuration
  db: {
    schema: 'public',
  },
  // Realtime configuration (disable if not needed to reduce connection overhead)
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
  },
});

// Add connection test in development (non-blocking)
if (process.env.NODE_ENV === 'development') {
  const testConnection = async () => {
    try {
      const { error } = await supabase.from(DATABASE_TABLES.PROFILES).select('id').limit(1);
      if (error) {
        logger.warn('Supabase connection test failed', { errorMessage: error.message }, 'Supabase');
      } else {
        logger.info('Supabase connection test successful', undefined, 'Supabase');
      }
    } catch {
      // Silently fail connection test - don't block app startup
    }
  };
  // Run test after a delay to avoid blocking initialization
  setTimeout(testConnection, 1000);
}

// Export the client instance directly - createBrowserClient handles internal caching
export default supabase;

// Provide a factory function for testing/mocking purposes
export const createSupabaseClient = () =>
  createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      debug: enableAuthDebug, // Controlled by NEXT_PUBLIC_SUPABASE_DEBUG env var
    },
    global: {
      fetch: (url: RequestInfo | URL, options: RequestInit = {}) => {
        // Create timeout controller
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 20000);

        // Combine with existing signal if present
        const combinedSignal = timeoutController.signal;
        if (options.signal) {
          // If there's an existing signal, abort our timeout when the existing signal aborts
          options.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            timeoutController.abort();
          });
        }

        return fetch(url, {
          ...options,
          signal: combinedSignal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 2,
      },
    },
  });

export { supabase }; // Legacy named export for backward compatibility
