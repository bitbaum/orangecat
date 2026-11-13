import { ROUTES } from '@/config/routes';

/**
 * Single source of truth for "is this nav href currently active".
 *
 * Used by every chrome surface (sidebar, header desktop nav, mobile
 * bottom nav). Don't grow a fourth implementation — extend this one.
 *
 * Rules:
 *   - Exact pathname === href → active
 *   - `/dashboard` (the dashboard home) is active only on its own path,
 *     NOT on `/dashboard/x` — otherwise it would always look active when
 *     the user is on any sub-page like /dashboard/projects.
 *   - Every other href is active on its own path AND any sub-path
 *     prefixed by `${href}/`.
 *   - `/` is only active on `/` exactly (avoids matching every URL).
 *   - `activeFor` lists other paths the item owns (Money owns Receive, Send
 *     and Requests; My things owns every type's list); each follows the same
 *     rules as href.
 */
export function isNavHrefActive(
  pathname: string | null | undefined,
  href: string | null | undefined,
  activeFor?: readonly string[]
): boolean {
  if (activeFor?.some(path => matchesHref(pathname, path))) {
    return true;
  }
  return matchesHref(pathname, href);
}

function matchesHref(
  pathname: string | null | undefined,
  href: string | null | undefined
): boolean {
  if (!pathname || !href) {
    return false;
  }
  if (pathname === href) {
    return true;
  }
  if (href === '/') {
    return pathname === '/';
  }
  // Dashboard root is exact-match only — sub-routes have their own
  // sidebar entries that should claim active state.
  if (href === ROUTES.DASHBOARD.HOME) {
    return false;
  }
  return pathname.startsWith(`${href}/`);
}
