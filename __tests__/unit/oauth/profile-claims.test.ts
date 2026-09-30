/**
 * The email claim relying parties receive (Solon, Loki) comes from the
 * account, not from profiles.email: that column is copied once at sign-up and
 * never follows a later add or change, so an account with a confirmed email
 * was sent to Solon with none and turned away (2026-09-30).
 */
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

let profile: Record<string, unknown> | null = null;
let account: Record<string, unknown> | null = null;
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, { select: self, eq: self, maybeSingle: async () => ({ data: profile }) });
    return {
      from: () => chain,
      auth: { admin: { getUserById: async () => ({ data: { user: account } }) } },
    };
  }),
}));

import { profileClaims } from '@/services/auth/oauthProvider';

beforeEach(() => {
  profile = { username: 'cato', name: 'Cato', avatar_url: null, email: null };
  account = { email: 'cato@example.org', email_confirmed_at: '2025-08-26T14:40:17Z' };
});

describe('profileClaims', () => {
  it("sends the account's email when the profile copy is empty", async () => {
    const claims = await profileClaims('u1', ['openid', 'profile', 'email']);
    expect(claims).toMatchObject({ email: 'cato@example.org', email_verified: true });
  });

  it('prefers the account over a stale profile copy', async () => {
    profile = { ...profile, email: 'old@example.org' };
    expect((await profileClaims('u1', ['email'])).email).toBe('cato@example.org');
  });

  it('falls back to the profile copy, unverified, when the account has none', async () => {
    account = { email: '', email_confirmed_at: null };
    profile = { ...profile, email: 'copy@example.org' };
    expect(await profileClaims('u1', ['email'])).toMatchObject({
      email: 'copy@example.org',
      email_verified: false,
    });
  });

  it('sends no email without the email scope', async () => {
    const claims = await profileClaims('u1', ['openid', 'profile']);
    expect(claims).not.toHaveProperty('email');
    expect(claims.preferred_username).toBe('cato');
  });
});
