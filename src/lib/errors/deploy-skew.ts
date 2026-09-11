/**
 * The errors that mean "your browser is on an older build than this server",
 * and are fixed by loading the page again.
 *
 * Every deploy replaces the build's hashed chunks and its server-action ids. A
 * tab opened before the deploy still asks for the old ones, and the answers
 * are 404s that surface as an exception. The user sees "Something went wrong.
 * There was a problem loading this page." and is invited to press "Try again",
 * which re-renders the same stale tab and fails identically. The journal for
 * 2026-09-11 shows eight of these in one minute, all the same deploy.
 *
 * It is not a fault in the page, and the person is not the right component to
 * resolve it — a reload is, and it always works. So this predicate exists to
 * tell that class apart from a genuine failure, which must still be reported
 * and must NOT silently reload (a reload loop hides real bugs).
 *
 * Pure and exported so the boundary's behaviour is a unit test, not a claim.
 */

/** Substrings Next.js/webpack use for a build the browser no longer matches. */
const SKEW_SIGNATURES: readonly string[] = [
  // Server Actions: the id is minted per build.
  'failed to find server action',
  // Route/chunk fetches against hashed filenames from the previous build.
  'chunkloaderror',
  'loading chunk',
  'loading css chunk',
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
];

export function isDeploySkewError(error: unknown): boolean {
  const text = [
    error instanceof Error ? error.message : typeof error === 'string' ? error : '',
    error instanceof Error ? error.name : '',
  ]
    .join(' ')
    .toLowerCase();
  if (!text.trim()) return false;
  return SKEW_SIGNATURES.some(signature => text.includes(signature));
}

/** Key for the one-reload guard. Session-scoped: a new tab may try again. */
export const DEPLOY_SKEW_RELOAD_KEY = 'oc:deploy-skew-reload-at';

/** How long a reload counts as "already tried", so a loop cannot form. */
export const DEPLOY_SKEW_RELOAD_WINDOW_MS = 30_000;

/**
 * May we reload for this error right now? False when we already reloaded
 * moments ago — that means the reload did NOT fix it, so the error is real and
 * the user deserves to see it rather than a page that flickers forever.
 */
export function shouldReloadForSkew(
  error: unknown,
  lastReloadAt: number | null,
  now: number = Date.now()
): boolean {
  if (!isDeploySkewError(error)) return false;
  if (lastReloadAt === null) return true;
  return now - lastReloadAt > DEPLOY_SKEW_RELOAD_WINDOW_MS;
}
