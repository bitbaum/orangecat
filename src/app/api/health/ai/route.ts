import { catLivenessHandler } from '@/services/cat/liveness';

export const dynamic = 'force-dynamic';

/**
 * Can the Cat think RIGHT NOW?
 *
 *   GET /api/health/ai            free. Reports nothing but that it is here.
 *   GET /api/health/ai?probe=1    a real call. 200 or 503. Needs AI_PROBE_SECRET,
 *                                 via the `x-probe-secret` header or `?secret=`.
 *
 * Separate from /api/health on purpose. That route answers "is the site up" for
 * load balancers and deploy gates, and a dead provider key must never fail it —
 * a restart cannot fix a key, and failing on it would kill a healthy process
 * over someone else's outage. This route has the opposite contract: 200 only
 * when a model actually answered, so an uptime monitor can watch this URL and
 * page on a real AI outage without paging on every deploy.
 *
 * Why it exists: `callPlatformJson` sits behind eight Cat features, every one
 * of which degrades to null on failure. A dead chain therefore looks exactly
 * like a quiet afternoon, and it has been dead twice — a retired model id, and
 * an empty 200 returned as an answer. Nothing in /api/health could see either.
 */
export const GET = catLivenessHandler;
