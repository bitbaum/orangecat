/**
 * Read a human-readable message out of a failed API response.
 *
 * WHY THIS EXISTS
 * `apiError()` answers `{ success: false, error: { code, message } }` — `error`
 * is an OBJECT. 112 call sites did `X.error || 'Something failed'` and handed
 * the result to `new Error(...)`, `toast.error(...)` or `setState(...)`, which
 * produces one of two bad outcomes and never the intended one:
 *
 *   new Error({code, message})  -> err.message === '[object Object]'
 *   setError({code, message})   -> React throws "Objects are not valid as a
 *                                  React child" when the string is rendered
 *
 * The fallback after `||` never fired either, because a non-empty object is
 * truthy. So every failure showed "[object Object]" instead of the reason the
 * server took the trouble to send. A user hit exactly this on 2026-09-05
 * trying to follow someone: the server said "Already following this user" and
 * the toast said "[object Object]".
 *
 * Not every route is on the standard envelope — older ones answer
 * `{ error: 'a string' }`, and supabase hands back `{ message, code, ... }`.
 * This reads all three, so it is correct wherever it is applied and callers do
 * not have to know which kind of endpoint they are talking to.
 */

/**
 * @param payload  Parsed response body (or any thrown value).
 * @param fallback Used when the payload carries no usable message.
 */
export function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === 'string') {
    return payload.trim() || fallback;
  }
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const body = payload as {
    error?: unknown;
    message?: unknown;
    details?: unknown;
  };

  // Standard envelope: { error: { code, message } }
  const error = body.error;
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }

  // Bare shapes: { message } — supabase errors and a few hand-rolled routes.
  if (typeof body.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }

  return fallback;
}
