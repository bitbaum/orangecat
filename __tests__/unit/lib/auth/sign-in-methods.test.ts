import {
  describeIdentity,
  linkableProviders,
  methodLabel,
  unlinkBlocker,
  type SignInMethod,
} from '@/lib/auth/sign-in-methods';

// An account must keep at least one way in, and the card must say why before
// the click, not after. Losing the inbox is survivable only with a second way.
const email: SignInMethod = {
  id: 'i-email',
  provider: 'email',
  oauthProvider: null,
  handle: 'g@example.org',
  createdAt: null,
  lastSignInAt: null,
};
const google: SignInMethod = {
  ...email,
  id: 'i-google',
  provider: 'google',
  oauthProvider: 'google',
};
const NAMES = { google: 'Google', github: 'GitHub', x: 'X' };

describe('describeIdentity', () => {
  it('maps a GoTrue identity, translating twitter to X and picking a handle', () => {
    expect(
      describeIdentity({
        identity_id: 'i1',
        provider: 'twitter',
        identity_data: { user_name: 'cato' },
        created_at: '2026-01-01',
        last_sign_in_at: '2026-09-01',
      })
    ).toEqual({
      id: 'i1',
      provider: 'twitter',
      oauthProvider: 'x',
      handle: 'cato',
      createdAt: '2026-01-01',
      lastSignInAt: '2026-09-01',
    });
  });

  it('labels email as Email and unknown providers by name', () => {
    expect(methodLabel(email, NAMES)).toBe('Email');
    expect(methodLabel(google, NAMES)).toBe('Google');
    expect(methodLabel({ ...google, provider: 'keycloak', oauthProvider: null }, NAMES)).toBe(
      'Keycloak'
    );
  });
});

describe('unlinkBlocker', () => {
  it('refuses to remove the only way in', () => {
    expect(unlinkBlocker(email, [email], 0)).toMatch(/only way/);
    expect(unlinkBlocker(google, [google], 0)).toMatch(/only way/);
  });

  it('allows removing a provider while email or another provider remains', () => {
    expect(unlinkBlocker(google, [email, google], 0)).toBeNull();
  });

  it('keeps email while a passkey is the only other way in', () => {
    expect(unlinkBlocker(email, [email], 1)).toMatch(/recover/);
    expect(unlinkBlocker(email, [email, google], 1)).toBeNull();
  });
});

describe('linkableProviders', () => {
  it('offers only working providers that are not yet linked', () => {
    expect(linkableProviders([email, google], ['google', 'github', 'x'])).toEqual(['github', 'x']);
    expect(linkableProviders([email], [])).toEqual([]);
  });
});
