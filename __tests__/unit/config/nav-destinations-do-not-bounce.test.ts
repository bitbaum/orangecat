/**
 * A nav entry is a promise: "this row takes you somewhere the other rows don't."
 *
 * `mobile-tab-bar.test.ts` already checks that no two rows share an href — but
 * hrefs are compared as *strings*, and that is exactly how the sidebar shipped
 * two rows ("Cat" and "Home") that both landed on /dashboard/cat: /dashboard's
 * page component `router.replace`d everyone to the Cat hub. Textually distinct,
 * identical in the browser, and the dashboard became unreachable — along with
 * the breadcrumb crumb, the 404 recovery link and every RouteError that points
 * at /dashboard.
 *
 * So: an authenticated nav destination may not redirect to another authenticated
 * nav destination. Bouncing somewhere that is NOT a nav row (/auth, onboarding)
 * stays allowed — that's a guard, not a duplicate row.
 *
 * Scope, stated rather than implied: this reads each destination's own
 * `page.tsx`. A redirect hidden inside a child component or a layout is not
 * caught here.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { mobileTabBar, sidebarSections } from '@/config/navigation';
import { ROUTES } from '@/config/routes';

const APP_DIR = join(process.cwd(), 'src', 'app');

/** Every route the signed-in user can reach from a nav row, path-only. */
function authenticatedNavDestinations(): string[] {
  const fromSidebar = sidebarSections
    .flatMap(section => section.items)
    .filter(item => item.requiresAuth !== false)
    .map(item => item.href);
  const fromTabBar = mobileTabBar.filter(item => !item.opensCreate).map(item => item.href);
  return [...new Set([...fromSidebar, ...fromTabBar])]
    .filter((href): href is string => typeof href === 'string' && href.startsWith('/'))
    .map(stripQuery);
}

function stripQuery(href: string): string {
  return href.split(/[?#]/)[0];
}

/** Resolve "/dashboard" to its page file, looking through route groups. */
function pageFileFor(href: string): string | null {
  const segments = href.split('/').filter(Boolean);
  const groups = readdirSync(APP_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.startsWith('('))
    .map(entry => entry.name);
  for (const prefix of ['', ...groups]) {
    const candidate = join(APP_DIR, prefix, ...segments, 'page.tsx');
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** Look up "ROUTES.DASHBOARD.CAT" against the real config. */
function resolveRoutesExpression(expression: string): string | null {
  const path = expression.split('.').slice(1);
  let value: unknown = ROUTES;
  for (const key of path) {
    if (typeof value !== 'object' || value === null || !(key in value)) {
      return null;
    }
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' ? value : null;
}

/** Redirect targets a page sends the user to on arrival. */
function redirectTargetsIn(source: string): string[] {
  const targets: string[] = [];
  const calls = source.matchAll(/(?:router\.replace|\bredirect)\(([^)]*)\)/g);
  for (const [, argument] of calls) {
    for (const [expression] of argument.matchAll(/ROUTES(?:\.[A-Z0-9_]+)+/g)) {
      const resolved = resolveRoutesExpression(expression);
      if (resolved) {
        targets.push(stripQuery(resolved));
      }
    }
    for (const [, literal] of argument.matchAll(/['"](\/[^'"]*)['"]/g)) {
      targets.push(stripQuery(literal));
    }
  }
  return targets;
}

describe('authenticated nav destinations', () => {
  const destinations = authenticatedNavDestinations();

  it('finds the nav rows it is meant to police', () => {
    expect(destinations).toContain(ROUTES.DASHBOARD.HOME);
    expect(destinations).toContain(ROUTES.DASHBOARD.CAT);
  });

  it('never redirects one nav row onto another', () => {
    const others = new Set(destinations);
    const collisions: string[] = [];

    for (const href of destinations) {
      const file = pageFileFor(href);
      if (!file) {
        continue; // dynamic or externally-served route — nothing to read
      }
      const source = readFileSync(file, 'utf8');
      for (const target of redirectTargetsIn(source)) {
        if (target !== href && others.has(target)) {
          collisions.push(`${href} → ${target}`);
        }
      }
    }

    expect(collisions).toEqual([]);
  });
});
