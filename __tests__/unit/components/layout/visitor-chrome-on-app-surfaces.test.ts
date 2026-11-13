/**
 * A signed-out visitor on an app surface (Discover, a public listing) gets the
 * site's way around: the footer is drawn for them, and a create form they
 * reach sends them to make an account rather than to the sign-in fields.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({}) }));
vi.mock('@/hooks/useShellPathname', () => ({ useShellPathname: () => '/' }));

import { showsSiteFooter } from '@/components/layout/Footer';
import { signInModeFor } from '@/config/routes';

describe('showsSiteFooter', () => {
  const visitor = { signedIn: false, settled: true };

  it('draws the footer for a visitor on public pages and app surfaces', () => {
    expect(showsSiteFooter('public', visitor)).toBe(true);
    expect(showsSiteFooter('app', visitor)).toBe(true);
  });

  it('never for a signed-in person, and never on the sign-in screen', () => {
    expect(showsSiteFooter('public', { signedIn: true, settled: true })).toBe(false);
    expect(showsSiteFooter('app', { signedIn: true, settled: true })).toBe(false);
    expect(showsSiteFooter('auth', visitor)).toBe(false);
  });

  it('waits for auth to settle on an app surface, so it never flashes', () => {
    expect(showsSiteFooter('app', { signedIn: false, settled: false })).toBe(false);
    // A public page draws it from the first (server) render, as before.
    expect(showsSiteFooter('public', { signedIn: false, settled: false })).toBe(true);
  });
});

describe('signInModeFor', () => {
  it('sends a visitor bounced from a create form to make an account', () => {
    expect(signInModeFor('/dashboard/store/create', true)).toBe('register');
    expect(signInModeFor('/create', true)).toBe('register');
    expect(signInModeFor('/create/product', false)).toBe('register');
  });

  it('sends a browser that has held a session to sign in', () => {
    expect(signInModeFor('/dashboard', true)).toBe('login');
    expect(signInModeFor('/settings/creators', true)).toBe('login');
  });

  it('sends a first visit to make an account', () => {
    expect(signInModeFor('/dashboard', false)).toBe('register');
  });
});
