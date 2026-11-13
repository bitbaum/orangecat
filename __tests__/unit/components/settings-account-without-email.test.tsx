// @vitest-environment jsdom
/**
 * Settings recognises an account with no email.
 *
 * An anonymous account used to read "the email address associated with your
 * account" above an empty field, and was offered a password it could never
 * sign in with. It is now asked to add an email, as the page's one filled
 * button.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { accountHasNoEmail } from '@/lib/auth/account-email';
import { SettingsEmailSection } from '@/app/(authenticated)/settings/SettingsEmailSection';

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

describe('SettingsEmailSection', () => {
  const noop = () => {};

  it('asks an account with no email to add one', () => {
    render(
      <SettingsEmailSection email="" noEmail isSubmitting={false} onChange={noop} onSubmit={noop} />
    );
    expect(screen.getByRole('heading', { name: 'Add an email' })).toBeTruthy();
    expect(screen.getByText(/only exists in this browser/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add email' })).toBeTruthy();
  });

  it('offers to change an existing email', () => {
    render(
      <SettingsEmailSection
        email="ana@example.com"
        isSubmitting={false}
        onChange={noop}
        onSubmit={noop}
      />
    );
    expect(screen.getByRole('heading', { name: 'Email address' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Update email' })).toBeTruthy();
  });
});
