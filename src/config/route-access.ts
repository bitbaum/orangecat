/**
 * Authentication boundary SSOT.
 *
 * App-shell placement and access are different concerns: some app surfaces
 * (Discover, Community, Collaborate) intentionally work before sign-in. Both
 * middleware and browser-contract tests consume this predicate.
 */
export const AUTH_REQUIRED_PREFIXES = [
  '/dashboard',
  '/settings',
  '/timeline',
  '/messages',
  '/post',
  '/ai-chat',
  '/home',
  '/receive',
  '/send',
  '/requests',
  '/onboarding',
  '/profile/setup',
  '/documents',
  '/create',
] as const;

export const AUTH_REQUIRED_EXACT_PATHS = [
  '/profile',
  '/profiles/me',
  '/assets/create',
  '/articles/new',
  '/events/create',
  '/groups/create',
  '/projects/create',
] as const;

export function requiresAuthentication(pathname: string): boolean {
  if (AUTH_REQUIRED_EXACT_PATHS.some(route => pathname === route)) {
    return true;
  }

  if (/^\/articles\/[^/]+\/edit$/.test(pathname) || /^\/groups\/[^/]+\/settings$/.test(pathname)) {
    return true;
  }

  return AUTH_REQUIRED_PREFIXES.some(
    route => pathname === route || pathname.startsWith(`${route}/`)
  );
}
