/**
 * Who is calling — the one place that may ask, delegating the actual header
 * parsing to limitkit's `clientIp`.
 *
 * `X-Forwarded-For` is a list, and Caddy APPENDS to it: only the LAST entry
 * is the hop Caddy itself wrote, so only the last entry is evidence. Six
 * places here once read the header directly and every one read it wrong —
 * see bitbaum/orangecat#563 finding 2 — which is why `check:client-ip`
 * forbids any other file from touching the raw header, and why the parsing
 * now lives in `limitkit` (which ships the identical correction) rather than
 * being maintained a thirteenth time.
 *
 * Verified rather than assumed, 2026-08-28: orangecat.ch resolves straight to
 * the box, no CDN in front (`via: 1.1 Caddy`), one Caddy 2.11.4 with no
 * `trusted_proxies` configured — exactly one appended hop, i.e. limitkit's
 * default `trustedProxies: 1`. If a CDN is ever put in front of Caddy, this
 * is the one line to change (`trustedProxies: 2`).
 */

import { clientIp } from 'limitkit';

type HeadersLike = { get(name: string): string | null };
type RequestLike = { headers: HeadersLike };

/**
 * The caller's IP as seen by Caddy, or a shared `anonymous` bucket.
 *
 * The fallback throttles unattributable traffic collectively rather than
 * letting it past, and is never empty — an empty key would read as a real
 * identity in `l402:${key}` while collapsing every caller into one bucket.
 * limitkit spells the fallback "unknown"; this app's bucket name predates it
 * and is pinned by tests, so it is mapped here rather than renamed.
 */
export function clientIpKey(request: RequestLike): string {
  const ip = clientIp(request.headers);
  return ip === 'unknown' ? 'anonymous' : ip;
}

/**
 * The same answer where an ADDRESS is wanted rather than a bucket key —
 * an audit row or a captcha `remoteip` wants nothing at all rather than the
 * word "anonymous", which is a limiter concept and not a place.
 */
export function clientIpOrUndefined(request: RequestLike): string | undefined {
  const key = clientIpKey(request);
  return key === 'anonymous' ? undefined : key;
}
