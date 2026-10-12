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
let grant: Record<string, unknown> | null = null;
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      Object.assign(chain, {
        select: self,
        eq: self,
        maybeSingle: async () => ({ data: table === 'oauth_user_grants' ? grant : profile }),
      });
      return chain;
    },
    auth: { admin: { getUserById: async () => ({ data: { user: account } }) } },
  })),
}));

import { profileClaims } from '@/services/auth/oidcProfileClaims';

beforeEach(() => {
  profile = { username: 'cato', name: 'Cato', avatar_url: null, email: null };
  account = { email: 'cato@example.org', email_confirmed_at: '2025-08-26T14:40:17Z' };
  grant = null;
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

describe('profileClaims — what a person withholds from one app', () => {
  beforeEach(() => {
    profile = { username: 'cato', name: 'Cato', avatar_url: 'https://x/a.png', email: null };
  });

  it('sends name, handle and picture when nothing is withheld', async () => {
    expect(await profileClaims('u1', ['openid', 'profile'], 'solon')).toEqual({
      name: 'Cato',
      preferred_username: 'cato',
      picture: 'https://x/a.png',
    });
  });

  it('leaves a withheld claim ABSENT, not null, and keeps the rest', async () => {
    grant = { withheld_claims: ['picture', 'preferred_username'] };
    const claims = await profileClaims('u1', ['openid', 'profile'], 'solon');
    expect(claims).toEqual({ name: 'Cato' });
    expect(claims).not.toHaveProperty('picture');
    expect(claims).not.toHaveProperty('preferred_username');
  });

  it('can withhold everything and still sign the person in (no claims, sub is elsewhere)', async () => {
    grant = { withheld_claims: ['name', 'preferred_username', 'picture'] };
    expect(await profileClaims('u1', ['openid', 'profile'], 'solon')).toEqual({});
  });

  it('ignores values it does not know, so a bad row cannot hide or reveal the wrong thing', async () => {
    grant = { withheld_claims: ['email', 'nonsense', 'picture'] };
    const claims = await profileClaims('u1', ['openid', 'profile', 'email'], 'solon');
    expect(claims).not.toHaveProperty('picture');
    expect(claims.email).toBe('cato@example.org');
  });

  it('does not touch the email claim: that has its own scope', async () => {
    grant = { withheld_claims: ['name', 'preferred_username', 'picture'] };
    expect(await profileClaims('u1', ['openid', 'profile', 'email'], 'solon')).toMatchObject({
      email: 'cato@example.org',
    });
  });

  it('withholds nothing when the caller names no app', async () => {
    grant = { withheld_claims: ['picture'] };
    expect(await profileClaims('u1', ['profile'])).toHaveProperty('picture');
  });
});
