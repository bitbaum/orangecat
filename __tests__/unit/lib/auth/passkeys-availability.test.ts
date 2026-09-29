import { readPasskeysEnabled } from '@/lib/auth/passkeys-availability';

// The UI offers a passkey only when the auth server says it can honour one.
// Anything short of an explicit true is "off": a dead button is worse than none.
describe('readPasskeysEnabled', () => {
  it('is true only for an explicit passkeys_enabled: true', () => {
    expect(readPasskeysEnabled({ passkeys_enabled: true })).toBe(true);
  });

  it('is false for false, missing, a string, null and garbage', () => {
    expect(readPasskeysEnabled({ passkeys_enabled: false })).toBe(false);
    expect(readPasskeysEnabled({ external: { github: true } })).toBe(false);
    expect(readPasskeysEnabled({ passkeys_enabled: 'true' })).toBe(false);
    expect(readPasskeysEnabled(null)).toBe(false);
    expect(readPasskeysEnabled(undefined)).toBe(false);
    expect(readPasskeysEnabled('passkeys_enabled')).toBe(false);
  });
});
