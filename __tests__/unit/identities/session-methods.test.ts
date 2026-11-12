import { describe, it, expect } from 'vitest';
import { sessionMethods } from '@/lib/auth/session-methods';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** A client whose cookie session carries an access token with these claims. */
function clientWith(claims: unknown | null): AnySupabaseClient {
  const token =
    claims === null ? null : `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`;
  return {
    auth: {
      getSession: async () => ({ data: { session: token ? { access_token: token } : null } }),
    },
  } as unknown as AnySupabaseClient;
}

describe('sessionMethods reads how a session was signed in', () => {
  it('returns the amr methods in GoTrue’s object form', async () => {
    const amr = [
      { method: 'otp', timestamp: 1 },
      { method: 'token_refresh', timestamp: 2 },
    ];
    expect(await sessionMethods(clientWith({ amr }))).toEqual(['otp', 'token_refresh']);
  });

  it('accepts the plain-string form too', async () => {
    expect(await sessionMethods(clientWith({ amr: ['password'] }))).toEqual(['password']);
  });

  it('is empty, the closed side, when there is nothing it can trust', async () => {
    expect(await sessionMethods(clientWith(null))).toEqual([]);
    expect(await sessionMethods(clientWith({}))).toEqual([]);
    expect(await sessionMethods(clientWith({ amr: 'otp' }))).toEqual([]);
    expect(await sessionMethods(clientWith({ amr: [{ method: 7 }, null] }))).toEqual([]);
    const broken = {
      auth: { getSession: async () => ({ data: { session: { access_token: 'not-a-jwt' } } }) },
    };
    expect(await sessionMethods(broken as unknown as AnySupabaseClient)).toEqual([]);
  });
});
