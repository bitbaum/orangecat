// @vitest-environment jsdom
/**
 * Settings recognises an account with no email.
 *
 * An anonymous account used to read "the email address associated with your
 * account" above an empty field, and was offered a password it could never
 * sign in with. It is now asked to add an email, as the page's one filled
 * button.
 */
import { describe, expect, it } from 'vitest';
import { accountHasNoEmail } from '@/lib/auth/account-email';

describe('accountHasNoEmail', () => {
  it('is true for an anonymous account, even one carrying a placeholder', () => {
    expect(accountHasNoEmail({ is_anonymous: true, email: 'x@example.com' })).toBe(true);
  });

  it('is true when there is no address at all', () => {
    expect(accountHasNoEmail({ email: '' })).toBe(true);
    expect(accountHasNoEmail({ email: null })).toBe(true);
    expect(accountHasNoEmail({})).toBe(true);
  });

  it('is false for an account with an email, and for no user', () => {
    expect(accountHasNoEmail({ email: 'ana@example.com', is_anonymous: false })).toBe(false);
    expect(accountHasNoEmail(null)).toBe(false);
  });
});

// The email section itself is pinned in anonymous-account-sign-in-truth.test.tsx.
