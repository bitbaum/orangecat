/**
 * The hand-off from /oauth/authorize to /auth. Every input is attacker-
 * craftable, so the tests are mostly about what gets DROPPED.
 */
import { describe, it, expect } from 'vitest';
import { authHandoffUrl, callbackUrl, readHandoff, safeReturnPath } from '@/lib/oauth/handoff';

const RETURN = '/oauth/authorize?client_id=solon&state=x';
const params = (url: string) => new URL(url, 'https://orangecat.ch').searchParams;

describe('authHandoffUrl', () => {
  it('always carries the return path', () => {
    expect(params(authHandoffUrl({ returnTo: RETURN })).get('from')).toBe(RETURN);
  });

  it('opens on sign-up for prompt=create, including inside a prompt list', () => {
    expect(params(authHandoffUrl({ returnTo: RETURN, prompt: 'create' })).get('mode')).toBe(
      'register'
    );
    expect(params(authHandoffUrl({ returnTo: RETURN, prompt: 'consent create' })).get('mode')).toBe(
      'register'
    );
    expect(params(authHandoffUrl({ returnTo: RETURN, prompt: 'login' })).get('mode')).toBeNull();
  });

  it('passes a plausible email, provider and client; drops junk', () => {
    const ok = params(
      authHandoffUrl({
        returnTo: RETURN,
        loginHint: 'ada@example.org',
        idpHint: 'google',
        clientId: 'solon',
      })
    );
    expect(ok.get('email')).toBe('ada@example.org');
    expect(ok.get('provider')).toBe('google');
    expect(ok.get('client')).toBe('solon');

    const bad = params(
      authHandoffUrl({
        returnTo: RETURN,
        loginHint: '<script>@x',
        idpHint: 'evil-idp',
        clientId: '../../admin',
      })
    );
    expect(bad.get('email')).toBeNull();
    expect(bad.get('provider')).toBeNull();
    expect(bad.get('client')).toBeNull();
  });
});

describe('readHandoff', () => {
  const read = (qs: string) => readHandoff(new URLSearchParams(qs));

  it('round-trips what authHandoffUrl wrote', () => {
    const url = authHandoffUrl({
      returnTo: RETURN,
      prompt: 'create',
      loginHint: 'ada@example.org',
      idpHint: 'github',
      clientId: 'solon',
    });
    expect(readHandoff(params(url))).toEqual({
      from: RETURN,
      mode: 'register',
      email: 'ada@example.org',
      provider: 'github',
      client: 'solon',
    });
  });

  it('never returns an off-site `from`', () => {
    expect(read('from=//evil.example/x').from).toBe('/dashboard');
    expect(read('from=https://evil.example').from).toBe('/dashboard');
  });
});

describe('callbackUrl', () => {
  it('carries a same-origin return path through the provider round trip', () => {
    expect(callbackUrl('https://orangecat.ch', RETURN)).toBe(
      `https://orangecat.ch/auth/callback?next=${encodeURIComponent(RETURN)}`
    );
  });

  it('drops an off-site one rather than forwarding it', () => {
    expect(callbackUrl('https://orangecat.ch', '//evil.example')).toBe(
      'https://orangecat.ch/auth/callback'
    );
    expect(safeReturnPath(null)).toBeNull();
  });
});
