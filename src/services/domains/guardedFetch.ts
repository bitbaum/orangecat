/**
 * Outbound fetch that validates every hop, including redirects.
 *
 * The domain lookup takes a name from a public query string and asks a registry
 * about it. The URL it builds is a constant base plus a strictly-validated
 * label, so the first hop is safe by construction — but rdap.org is a
 * REDIRECTOR: its whole job is to bounce the request to whichever registry runs
 * that TLD. Following those hops with `redirect: 'follow'` means the runtime
 * silently fetches a host chosen by a third party, and a misconfigured or
 * hostile bootstrap entry pointing at 127.0.0.1 or a cloud metadata endpoint
 * would be followed without anybody noticing.
 *
 * So redirects are followed by hand, and `checkPublicUrl` — the guard this
 * codebase already uses for user-supplied webhook URLs — runs against every hop
 * before the request is made. Same policy, applied to a second place that
 * needed it.
 *
 * Created: 2026-08-27
 */

import { checkPublicUrl } from '@/lib/security/ssrfGuard';

/** Injectable so tests need no DNS. Matches `checkPublicUrl`'s shape. */
export type UrlGuard = (url: string) => Promise<{ ok: true } | { ok: false; reason: string }>;

/** Enough for a redirector plus a registry; anything more is a loop. */
export const MAX_REDIRECT_HOPS = 5;

export class BlockedRequestError extends Error {
  constructor(url: string, reason: string) {
    super(`Refused to fetch ${url}: ${reason}`);
    this.name = 'BlockedRequestError';
  }
}

/**
 * Fetch `url`, following redirects one hop at a time and guarding each.
 *
 * @throws BlockedRequestError when a hop fails the guard or the chain is too long.
 */
export async function guardedFetch(
  url: string,
  init: RequestInit = {},
  guard: UrlGuard = checkPublicUrl
): Promise<Response> {
  let target = url;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    const verdict = await guard(target);
    if (!verdict.ok) {
      throw new BlockedRequestError(target, verdict.reason);
    }

    const response = await fetch(target, { ...init, redirect: 'manual' });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) {
      return response;
    }

    const location = response.headers?.get?.('location');
    if (!location) {
      // A 3xx with nowhere to go. Hand it back rather than inventing a hop.
      return response;
    }
    // Resolve relative Locations against the hop that issued them.
    target = new URL(location, target).toString();
  }

  throw new BlockedRequestError(url, `more than ${MAX_REDIRECT_HOPS} redirects`);
}
