/**
 * Middleware must not run on Next's own internal routes — including the dev
 * HMR websocket.
 *
 * The matcher excluded `_next/static` and `_next/image` but not `_next/hmr`, so
 * the websocket UPGRADE request was routed through middleware. The handshake
 * then fails (`ERR_INVALID_HTTP_RESPONSE`), and with it the dev client: pages
 * served by `next dev` render but never hydrate. Every button is dead, and
 * nothing says why — the bundle loads, 44 chunks, zero console errors, no
 * hydration warning.
 *
 * Measured on the same server, same page, one line apart:
 *
 *   before   a counter button reads "canary 0" and stays "canary 0"
 *   after    it reads "canary 1"
 *
 * Production was never affected (there is no HMR socket there), which is why
 * this could sit unnoticed: the deployed site hydrates fine while local
 * development silently cannot be clicked. It cost this session a wrong
 * diagnosis — a component was blamed for not opening when nothing on the page
 * could open.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(process.cwd(), 'src/middleware.ts'), 'utf8');

/** The single matcher pattern Next is configured with. */
function matcherPattern(): string {
  const m = SOURCE.match(/matcher:\s*\[\s*(?:\/\*[\s\S]*?\*\/\s*)?'([^']+)'/);
  if (!m) {
    throw new Error('could not find the matcher pattern in src/middleware.ts');
  }
  return m[1]!;
}

/** Next matches a path against the pattern anchored end to end. */
function matches(path: string): boolean {
  return new RegExp(`^${matcherPattern()}$`).test(path);
}

describe('middleware matcher', () => {
  it('parses to a real pattern (a regex that matched nothing would pass everything below)', () => {
    expect(matcherPattern().length).toBeGreaterThan(10);
    expect(matcherPattern()).toContain('_next');
  });

  it('never runs on the dev HMR websocket', () => {
    // The one that broke: middleware on an upgrade request kills the handshake,
    // and with it hydration for every page served by `next dev`.
    expect(matches('/_next/hmr')).toBe(false);
  });

  it('never runs on any Next internal route', () => {
    for (const path of [
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/_next/webpack-hmr',
      '/_next/turbopack-hmr',
      '/_next/anything-invented-later',
    ]) {
      expect(matches(path)).toBe(false);
    }
  });

  it('still runs on the pages it exists for', () => {
    // The exclusion must not be so broad that auth and locale handling stop.
    expect(matches('/dashboard')).toBe(true);
    expect(matches('/profiles/catomean')).toBe(true);
    expect(matches('/wallets/abc-123')).toBe(true);
  });

  it('still skips API routes and static files', () => {
    expect(matches('/api/wallets')).toBe(false);
    expect(matches('/favicon.ico')).toBe(false);
  });
});
