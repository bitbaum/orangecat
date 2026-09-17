/**
 * apiErrorMessage — reads a usable string out of any failed API response.
 *
 * The class this closes: `X.error || 'fallback'` against the standard envelope,
 * where `error` is `{ code, message }`. A non-empty object is truthy, so the
 * fallback never fired and the object reached new Error() / toast.error() /
 * setState() — rendering as the string "[object Object]", or throwing when
 * React tried to render it as a child.
 */

import { describe, it, expect } from 'vitest';
import { apiErrorMessage } from '@/lib/api/errorMessage';

describe('apiErrorMessage', () => {
  it('reads the standard envelope, which is what broke the follow toast', () => {
    const body = {
      success: false,
      error: { code: 'CONFLICT', message: 'Already following this user' },
      metadata: { timestamp: '2026-09-05T16:39:33.480Z' },
    };
    expect(apiErrorMessage(body, 'Failed to update follow status')).toBe(
      'Already following this user'
    );
    // The regression, stated plainly.
    expect(String(new Error(apiErrorMessage(body, 'fallback')).message)).not.toBe(
      '[object Object]'
    );
  });

  it('passes through routes that answer with a bare string error', () => {
    expect(apiErrorMessage({ success: false, error: 'Upload failed' }, 'fallback')).toBe(
      'Upload failed'
    );
  });

  it('reads a bare { message }, which is the supabase error shape', () => {
    expect(apiErrorMessage({ message: 'duplicate key value', code: '23505' }, 'fallback')).toBe(
      'duplicate key value'
    );
  });

  it('accepts a plain string', () => {
    expect(apiErrorMessage('Something specific', 'fallback')).toBe('Something specific');
  });

  it('falls back when there is no usable message', () => {
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback');
    expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({}, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({ success: false }, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({ error: {} }, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({ error: { code: 'X' } }, 'fallback')).toBe('fallback');
    // Whitespace-only is not a message a human can act on.
    expect(apiErrorMessage({ error: '   ' }, 'fallback')).toBe('fallback');
    expect(apiErrorMessage({ error: { message: '  ' } }, 'fallback')).toBe('fallback');
  });

  it('always returns a string, so callers can hand it to React or Error', () => {
    for (const input of [null, 0, false, [], { error: { message: 42 } }, { error: [] }]) {
      expect(typeof apiErrorMessage(input, 'fallback')).toBe('string');
    }
  });
});
