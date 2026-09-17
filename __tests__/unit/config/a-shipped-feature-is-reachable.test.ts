/**
 * A feature nobody can navigate to has not shipped.
 *
 * `public.profile_claims` — the holding area that lets a member set up a
 * profile for someone who has not registered yet — shipped complete on
 * 2026-08-18: table, RLS, domain service, `POST/GET /api/profile-claims`, a
 * `/dashboard/profile-claims` dashboard with a `/new` form, and a public
 * `/claim/<id>` landing page. It had written **zero** production rows by
 * 2026-09-05.
 *
 * The entire cause was this: `src/config/navigation.ts` contained no reference
 * to `ROUTES.DASHBOARD.PROFILE_CLAIMS`. The only way to reach any of it was to
 * type the URL. Every layer worked; nothing pointed at the first one.
 *
 * The sibling test file `nav-destinations-do-not-bounce.test.ts` proves that
 * what nav points AT resolves. This one proves the opposite direction — that a
 * destination we deliberately built is actually pointed at by something.
 */

import { sidebarSections } from '@/config/navigation';
import { ROUTES } from '@/config/routes';

function allSidebarHrefs(): string[] {
  const hrefs: string[] = [];
  const walk = (items: readonly { href?: string; children?: unknown }[]): void => {
    for (const item of items) {
      if (typeof item.href === 'string') {
        hrefs.push(item.href);
      }
      const children = (item as { children?: { href?: string }[] }).children;
      if (Array.isArray(children)) {
        walk(children);
      }
    }
  };
  for (const section of sidebarSections) {
    walk(section.items as readonly { href?: string }[]);
  }
  return hrefs;
}

describe('a shipped feature is reachable from the sidebar', () => {
  it('links the profile-claims dashboard', () => {
    // Asserts the ROUTES constant, not the literal string, so a route rename
    // moves this test with it instead of leaving it green against a dead path.
    expect(allSidebarHrefs()).toContain(ROUTES.DASHBOARD.PROFILE_CLAIMS);
  });

  it('gives that link a human name, not a bare path', () => {
    const entry = sidebarSections
      .flatMap(s => s.items as { href?: string; name?: string }[])
      .find(i => i.href === ROUTES.DASHBOARD.PROFILE_CLAIMS);

    expect(entry).toBeDefined();
    expect(entry?.name).toBeTruthy();
    expect(entry?.name).not.toContain('/');
  });
});
