/**
 * Auth Error Handling
 */

import type { AuthError } from '../types';

// GoTrue answers a throttle with 429 and one of these codes. Its own words
// ("Request rate limit reached", "email rate limit exceeded") are not for a
// person, so the code decides, never the prose.
const RATE_LIMIT_CODES = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
]);

// A slow auth request is ended by whichever clock fires first: the race in
// operations.ts ("Authentication request timed out"), or the 20 s fetch
// wrapper in lib/supabase/browser.ts aborting the request, which supabase-js
// passes on in the browser's words ("signal is aborted without reason",
// "The operation was aborted.", "Fetch is aborted"). Both are a timeout to
// the person.
const TIMED_OUT = /time(d)?\s?out|abort/i;

/**
 * Enhanced error handling with timeout detection for authentication operations
 */
export const handleAuthError = (error: unknown, _operation: string): AuthError => {
  const err = error as { name?: string; message?: string; status?: number; code?: string };

  if (
    err.name === 'AbortError' ||
    err.code === 'request_timeout' ||
    TIMED_OUT.test(err.message ?? '')
  ) {
    return {
      name: 'TimeoutError',
      message: 'Request timed out. Please check your internet connection or try again later.',
      status: 408,
    } as AuthError;
  }

  if (err.status === 429 || (err.code !== undefined && RATE_LIMIT_CODES.has(err.code))) {
    return {
      name: 'RateLimitError',
      message: 'Too many attempts right now. Please wait a few minutes, then try again.',
      status: 429,
    } as AuthError;
  }

  if (err.message?.includes('fetch')) {
    return {
      name: 'NetworkError',
      message:
        'Unable to connect to authentication service. Please check your internet connection.',
      status: 0,
    } as AuthError;
  }

  return error as AuthError;
};
