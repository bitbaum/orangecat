/**
 * "What you can do" is in the app's navigation, but its route is public, so a
 * signed-in person who opened it lost the sidebar and the tab bar until they
 * found their way back (auth-firstrun #12). Signed in, it keeps the app shell.
 */
import { describe, expect, it } from 'vitest';
import { getRouteSurface, getShellSurface, ROUTES } from '@/config/routes';

describe('getShellSurface', () => {
  it('keeps the app shell on "What you can do" for a signed-in person', () => {
    expect(getShellSurface(ROUTES.WHAT_YOU_CAN_DO, true)).toBe('app');
  });

  it('leaves it a public page for a visitor', () => {
    expect(getShellSurface(ROUTES.WHAT_YOU_CAN_DO, false)).toBe('public');
  });

  it('changes nothing else', () => {
    for (const path of ['/', '/about', '/auth', '/dashboard', '/discover']) {
      expect(getShellSurface(path, true)).toBe(getRouteSurface(path));
      expect(getShellSurface(path, false)).toBe(getRouteSurface(path));
    }
  });
});
