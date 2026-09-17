/**
 * Getting an unauthenticated visitor to the thing they clicked.
 *
 * Three faults shared one root — the sign-in round trip.
 *
 *   1. `BookEntityButton` rendered "Book this" for logged-out visitors. The
 *      dialog POSTs to /api/bookings, which is behind withAuth, so they filled
 *      the form in and got "Authentication required" as a red toast. A visible
 *      CTA on a dead end.
 *   2. `TimelineView` sent people to `/auth?redirect=…`. The auth page reads
 *      `from` (see useAuthForm.ts) and nothing reads `redirect`, so signing in
 *      always landed on /dashboard instead of coming back.
 *   3. The anonymous-sign-in branch took `from` straight into router.replace()
 *      while the session branch three lines up guarded it as "attacker-
 *      suppliable via the URL" — an open redirect in one of two paths.
 *
 * The test that matters most is the third block: it pins the PARAM NAME
 * repo-wide, so a fourth surface cannot invent its own and quietly lose the
 * return path again.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const AUTH_FORM = read('src/app/auth/useAuthForm.ts');
const BOOK_BUTTON = read('src/components/bookings/BookEntityButton.tsx');

describe('the auth page reads `from`', () => {
  it('resolves the return path from the `from` search param', () => {
    expect(AUTH_FORM).toContain("searchParams?.get('from')");
  });

  it('never reads a `redirect` param — the name callers used to send', () => {
    expect(AUTH_FORM).not.toContain("get('redirect')");
  });

  it('guards the return path in BOTH branches, not just the session one', () => {
    // `from` is attacker-suppliable. A same-origin check in one branch and not
    // the other is an open redirect through whichever branch was forgotten.
    const guards = AUTH_FORM.match(/startsWith\('\/'\) && !\w+\.startsWith\('\/\/'\)/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(2);
  });
});

describe('the book button offers a way forward when signed out', () => {
  it('takes an isSignedIn prop', () => {
    expect(BOOK_BUTTON).toContain('isSignedIn');
  });

  it('defaults to signed-in so an omitted prop cannot hide the button', () => {
    expect(BOOK_BUTTON).toContain('isSignedIn = true');
  });

  it('links to sign-in with the `from` param rather than opening a dialog', () => {
    expect(BOOK_BUTTON).toContain('/auth?from=');
    expect(BOOK_BUTTON).toContain('encodeURIComponent');
  });

  it('both bookable detail configs pass the flag through', () => {
    for (const rel of [
      'src/components/public/detail-configs/service.tsx',
      'src/components/public/detail-configs/asset.tsx',
    ]) {
      expect(read(rel)).toContain('isSignedIn={isSignedIn}');
    }
  });
});

describe('no surface may invent its own return-path param', () => {
  // The class-level guard. `redirect=` looked right, was accepted by the URL,
  // and was read by nobody — the kind of mistake that only shows up as "why
  // did signing in dump me on the dashboard?".
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  // Derived, not hardcoded: the allowlist IS whatever the auth surface reads,
  // so it stays true as that surface changes. Hardcoding it would make this
  // gate go stale the same way `redirect=` did.
  function paramsAuthReads(): Set<string> {
    const read = new Set<string>();
    for (const file of walk(join(ROOT, 'src/app/auth'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(
        /searchParams\??\.?get\('([a-zA-Z_]+)'\)/g,
      )) {
        read.add(m[1]);
      }
    }
    return read;
  }

  it('the derivation finds real params, rather than passing on an empty set', () => {
    // Without this, a regex that matches nothing would allowlist nothing and
    // the test below would still pass by accident on a codebase with no links.
    const read = paramsAuthReads();
    expect(read.has('from')).toBe(true);
    expect(read.size).toBeGreaterThan(2);
  });

  it('nothing links to /auth with a param the auth page does not read', () => {
    const allowed = paramsAuthReads();
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, 'src'))) {
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/\/auth\?([a-zA-Z_]+)=/g)) {
        if (!allowed.has(m[1])) {
          offenders.push(`${file.slice(ROOT.length + 1)} → /auth?${m[1]}=`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
