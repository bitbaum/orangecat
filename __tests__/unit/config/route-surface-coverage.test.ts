/**
 * Route classification has two layers that must agree: where a page lives in
 * the source tree, and how `getRouteSurface` classifies its URL. Nothing
 * enforces that automatically, so a page can sit under `(authenticated)` and
 * still be served the public marketing shell — no sidebar, no mobile nav, a
 * footer it shouldn't have. That is exactly what happened to /receive.
 *
 * This test walks the actual app directory and holds the two layers together.
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { getRouteSurface } from '@/config/routes';

const APP_DIR = join(process.cwd(), 'src', 'app');

/** Top-level URL segments owned by the (authenticated) route group. */
function authenticatedTopLevelRoutes(): string[] {
  const dir = join(APP_DIR, '(authenticated)');
  if (!existsSync(dir)) {
    return [];
  }
  return (
    readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      // Route groups "(x)" and private folders "_x" don't contribute URL segments.
      .filter(e => !e.name.startsWith('(') && !e.name.startsWith('_'))
      // Dynamic segments can't be classified as a literal prefix.
      .filter(e => !e.name.startsWith('['))
      .map(e => `/${e.name}`)
  );
}

describe('route surface classification', () => {
  it('classifies every (authenticated) route as an app surface', () => {
    const routes = authenticatedTopLevelRoutes();
    expect(routes.length).toBeGreaterThan(0);

    const misclassified = routes.filter(r => getRouteSurface(r) !== 'app');
    expect(misclassified).toEqual([]);
  });

  it('keeps the public payer page public — it needs no account', () => {
    expect(getRouteSurface('/pay/lena')).toBe('public');
  });

  it('classifies both money surfaces as app', () => {
    expect(getRouteSurface('/receive')).toBe('app');
    expect(getRouteSurface('/send')).toBe('app');
  });

  it('still routes auth and marketing correctly', () => {
    expect(getRouteSurface('/auth')).toBe('auth');
    expect(getRouteSurface('/about')).toBe('public');
    expect(getRouteSurface('/dashboard')).toBe('app');
  });
});
