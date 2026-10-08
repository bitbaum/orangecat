/**
 * A redirect is never built from the incoming request's URL.
 *
 * Behind Caddy the app sees itself as http://localhost:4003, so
 * `NextResponse.redirect(new URL(path, request.url))` sends a reader to
 * https://localhost:4003/… — a dead page. It works on a laptop and in every
 * unit test, which is why it shipped: the investor room's "Open the deck"
 * did exactly this on 2026-10-08. Build absolute redirects from SITE_URL.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe('redirects use SITE_URL', () => {
  it('no source builds a redirect URL from req.url / request.url', () => {
    const offenders = files(join(process.cwd(), 'src')).filter(f =>
      // Up to the end of the statement, not the first ")": the path argument
      // is usually a call itself — ROUTES.ROOM(token) — and a pattern that
      // stopped at its ")" never matched the line it exists for.
      /redirect\(\s*new URL\([^;\n]{0,200}?\b(req|request)\.(url|nextUrl)\b/.test(
        readFileSync(f, 'utf8')
      )
    );
    expect(offenders).toEqual([]);
  });
});
