/**
 * Rate limiting — the LIMITS live here; the algorithm lives in `limitkit`.
 *
 * ADR-0002 made this file the one canonical rate-limit module. limitkit
 * finishes the job: the window arithmetic, the bounded store, and the
 * standard headers are the shared package's, while every VALUE (how many
 * requests a route allows) stays here, because a limit is app semantics —
 * limitkit ships none on purpose.
 *
 * What this replaced (2026-09-05):
 *   - a hand-rolled `InMemoryRateLimiter` (fixed window anchored at the first
 *     hit, unbounded Map — the slow-leak shape limitkit's bounded MemoryStore
 *     exists to prevent);
 *   - an Upstash Redis path that was never configured in production (see
 *     ADR-0002 "Known, deliberately not fixed"): the live path was always the
 *     in-memory fallback, so deleting `@upstash/ratelimit`/`@upstash/redis`
 *     changed nothing at runtime. The deployment is a single self-hosted Node
 *     process behind Caddy, where per-process counting is correct. If a second
 *     instance ever exists, implement limitkit's two-method `Store` over
 *     something shared instead of resurrecting a second code path.
 *
 * All limiters are sliding windows — what the Upstash path always declared
 * (`Ratelimit.slidingWindow`) and what ADR-0002 specifies. Refusals count
 * nothing, so a hammered key recovers as soon as the traffic stops.
 */

import { slidingWindow, toHeaders, type Limiter, type LimitResult } from 'limitkit';
import { clientIpKey } from '@/lib/client-ip';

// ==================== TYPES ====================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the window opens again. */
  resetTime: number;
}

interface RequestLike {
  headers: {
    get(name: string): string | null;
  };
}

function toRateLimitResult(result: LimitResult): RateLimitResult {
  return {
    success: result.allowed,
    limit: result.limit,
    remaining: result.remaining,
    resetTime: result.resetAt,
  };
}

// ==================== RATE LIMITERS ====================

/** General per-IP budget: 100 requests per 15 minutes. */
const generalLimiter = slidingWindow({ limit: 100, windowMs: 15 * 60_000 });
/** Social actions (follow/unfollow): 10 per minute per user. */
const socialLimiter = slidingWindow({ limit: 10, windowMs: 60_000 });
/** Write operations: 30 per minute per user. */
const writeLimiter = slidingWindow({ limit: 30, windowMs: 60_000 });
// Caps how often a SINGLE recipient's wallet/relay can be hit by anonymous
// tip-invoice generation, regardless of the tipper's IP — so one attacker
// (even rotating IPs) can't flood a victim's NWC relay. Generous enough to
// absorb a legitimately viral post's concurrent tippers.
const tipRecipientLimiter = slidingWindow({ limit: 20, windowMs: 5 * 60_000 });
// Generous on purpose: a paying client polls, and refusing a real payer is
// worse than the outbound traffic this bounds.
const l402VerifyLimiter = slidingWindow({ limit: 60, windowMs: 60_000 });
const paymentClaimLimiter = slidingWindow({ limit: 10, windowMs: 60 * 60_000 });
// Public Ask-Cat / feedback endpoint: each submission costs a platform LLM
// call, and the caller may be anonymous — so a tight per-IP budget on top of
// the general limiter. 8 per 5 min is plenty for a real person having a
// conversation, and starves a script.
const askCatLimiter = slidingWindow({ limit: 8, windowMs: 5 * 60_000 });
// Public, keyless domain search. One inbound request fans out to as many as
// MAX_CANDIDATES (24) outbound RDAP lookups against third-party registries, and
// varying the query defeats the result cache. The cost of abuse is therefore not
// our CPU — it is this box's IP being throttled or blocked by the registries we
// depend on. Same reasoning as ask-cat: an expensive downstream call on behalf
// of an anonymous caller gets its own tight budget on top of the general limiter.
const domainSearchLimiter = slidingWindow({ limit: 10, windowMs: 5 * 60_000 });

// ==================== RATE LIMIT FUNCTIONS ====================
//
// All async, although the in-process store is sync: 138 call sites await these,
// and the seam staying Promise-shaped is what lets a shared Store (Redis,
// Postgres) slot in later without touching a single route.

/**
 * General rate limit for API requests
 * 100 requests per 15 minutes per IP
 */
export async function rateLimit(request: RequestLike): Promise<RateLimitResult> {
  return toRateLimitResult(generalLimiter.check(`api:${clientIpKey(request)}`));
}

/**
 * Rate limit for social actions (follow, unfollow)
 * 10 actions per minute per user
 */
export async function rateLimitSocialAsync(userId: string): Promise<RateLimitResult> {
  return toRateLimitResult(socialLimiter.check(`social:${userId}`));
}

/**
 * Rate limit anonymous tip-invoice generation PER RECIPIENT (by username).
 * 20 invoices per 5 minutes against any one recipient — protects a victim's
 * wallet/relay from invoice-spam even when the attacker rotates IPs. Apply this
 * IN ADDITION to the per-IP `rateLimit`.
 */
export async function rateLimitTipRecipient(username: string): Promise<RateLimitResult> {
  return toRateLimitResult(tipRecipientLimiter.check(`tip-recipient:${username.toLowerCase()}`));
}

/**
 * Rate limit invoice generation PER RECIPIENT for an entity-addressed payment.
 *
 * The per-IP limiter answers "is one caller hammering us". This answers the
 * question that actually protects a seller: "is one RECIPIENT's wallet being
 * hammered", however many IPs it arrives from. Both `GET /api/v1/pay/...` and
 * `POST /api/v1/payments/public` mint a REAL Lightning invoice through the
 * recipient's own LNURL/NWC relay on every request, so unbounded calls are how
 * an attacker gets a seller rate-limited or banned by their wallet provider and
 * litters their queue with orphan intents. bitbaum/orangecat#563 finding 1.
 *
 * Shares the tip limiter's budget and window deliberately — it is the same
 * victim's wallet being protected either way.
 *
 * Residual, stated rather than hidden: a profile reachable BOTH by username
 * (tips/lnurlp) and by entity id (here) has two buckets, so a determined
 * attacker splitting across both paths gets twice the budget. Collapsing them
 * would mean a username→entity lookup on the rate-limit path, i.e. a database
 * round trip before we have decided whether to serve the request at all. Twice
 * a bounded number is still bounded; unbounded was the bug.
 */
export async function rateLimitPaymentRecipient(
  entityType: string,
  entityId: string
): Promise<RateLimitResult> {
  return rateLimitTipRecipient(`${entityType}:${entityId}`);
}

/**
 * Rate limit "I paid you" claims per RECIPIENT.
 *
 * An acknowledge is testimony, not settlement: it flips an intent to
 * buyer_confirmed and fires a "someone says they paid you" card into the
 * recipient's confirmation queue. One card is a prompt to check a wallet; a
 * hundred is a denial-of-attention attack, and the social-engineering primitive
 * is ship-the-goods-for-no-money.
 *
 * The route's per-IP budget cannot bound this — the claims that matter come
 * from many addresses at one seller. Creating the intents is already bounded
 * per recipient (rateLimitPaymentRecipient), so this is the second half of the
 * same fence: bound the claims as well as the invoices.
 *
 * 10 per hour per recipient. A genuine payer claims once, and retries are
 * idempotent no-ops that never reach here. bitbaum/orangecat#563 finding 3.
 */
export async function rateLimitPaymentClaim(
  entityType: string,
  entityId: string
): Promise<RateLimitResult> {
  return toRateLimitResult(paymentClaimLimiter.check(`payment-claim:${entityType}:${entityId}`));
}

/**
 * Rate limit L402 verification PER TOKEN.
 *
 * The verify branch is deliberately unlimited: a payer who has paid must be
 * able to retry until we see it, and sharing the challenge budget would let
 * invoice-minting starve settlement confirmation. But "unlimited" is doing more
 * than that. Each verify on a non-terminal intent drives an OUTBOUND call — the
 * recipient's NWC or LNURL relay, or mempool — so one valid token buys unbounded
 * traffic against someone else's infrastructure, and the per-IP limiter cannot
 * see it because a token is the thing being replayed, not an address.
 *
 * Keyed on the intent, not the caller: 60 checks per minute is far more than an
 * honest client polling a payment needs, and far less than a loop. The budget
 * covers terminal intents too, even though those short-circuit in
 * refreshPaymentStatus before any rail call — a cheap check is still a check,
 * and one bound is easier to reason about than two.
 * bitbaum/orangecat#563 finding 7.
 */
export async function rateLimitL402Verify(paymentIntentId: string): Promise<RateLimitResult> {
  // Keyed on the INTENT, not the preimage. The intent is what the outbound call
  // is about, and it cannot be varied without a valid status token for a
  // different payment — whereas a preimage is caller-supplied, so keying on it
  // would let the same bucket-rotation trick the per-IP limiter already fell to.
  // The id is not a secret (it is in the status route's own URL), so no hash.
  return toRateLimitResult(l402VerifyLimiter.check(`l402-verify:${paymentIntentId}`));
}

/**
 * Rate limit public Ask-Cat / feedback submissions per IP.
 * 8 per 5 minutes — each one is a platform LLM call from a possibly anonymous
 * visitor. Apply IN ADDITION to the general per-IP `rateLimit`.
 */
export async function rateLimitAskCat(request: RequestLike): Promise<RateLimitResult> {
  return toRateLimitResult(askCatLimiter.check(`ask-cat:${clientIpKey(request)}`));
}

/**
 * Rate limit the public domain-availability search per IP.
 *
 * 10 per 5 minutes. A person trying names types a handful of queries; a script
 * enumerating the namespace through us — and through the registries behind us —
 * does not. Apply IN ADDITION to the general per-IP `rateLimit`.
 */
export async function rateLimitDomainSearch(request: RequestLike): Promise<RateLimitResult> {
  return toRateLimitResult(domainSearchLimiter.check(`domain-search:${clientIpKey(request)}`));
}

/**
 * Rate limit for write operations (create, update, delete)
 * 30 writes per minute per user
 */
export async function rateLimitWriteAsync(userId: string): Promise<RateLimitResult> {
  return toRateLimitResult(writeLimiter.check(`write:${userId}`));
}

// ==================== INTEGRATION-KEY QUOTAS ====================

/**
 * Per-integration-key quotas.
 *
 * Per-user quotas (rateLimitWriteAsync) lump every key minted by the same
 * user into one bucket, so one buggy Loki instance can DOS hirn.li
 * even though they're different keys. These give each integration key its
 * own bucket, keyed on integration_key_id — a leak/bug on one key stays
 * scoped to that key.
 *
 * Defaults: writes 60/min (twice the session-write limit since integrations
 * are machine-paced), reads 300/min (5× the write quota since reads are
 * cheaper). Configurable per call so a future settings UI can let users tune;
 * limiters are memoized per quota so a tuned key gets its own window without
 * rebuilding on every request.
 */
const DEFAULT_INTEGRATION_KEY_WRITES_PER_MINUTE = 60;
const DEFAULT_INTEGRATION_KEY_READS_PER_MINUTE = 300;

const integrationKeyLimiters = new Map<string, Limiter>();

function integrationKeyLimiter(kind: 'read' | 'write', requestsPerMinute: number): Limiter {
  const cacheKey = `${kind}:${requestsPerMinute}`;
  let limiter = integrationKeyLimiters.get(cacheKey);
  if (!limiter) {
    limiter = slidingWindow({ limit: requestsPerMinute, windowMs: 60_000 });
    integrationKeyLimiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function rateLimitIntegrationKeyWrite(
  keyId: string,
  requestsPerMinute: number = DEFAULT_INTEGRATION_KEY_WRITES_PER_MINUTE
): Promise<RateLimitResult> {
  return toRateLimitResult(
    integrationKeyLimiter('write', requestsPerMinute).check(`int_key_write:${keyId}`)
  );
}

/**
 * Per-integration-key READ quota. Mirror of rateLimitIntegrationKeyWrite
 * for the read path so a buggy integration's reads can't starve siblings
 * sharing an IP via the middleware's IP-based limit.
 *
 * Stacks ON TOP of the IP-based withRateLimit('read') middleware:
 * the floor still applies (anonymous abuse protection), the per-key
 * isolation is an additional gate on top.
 */
export async function rateLimitIntegrationKeyRead(
  keyId: string,
  requestsPerMinute: number = DEFAULT_INTEGRATION_KEY_READS_PER_MINUTE
): Promise<RateLimitResult> {
  return toRateLimitResult(
    integrationKeyLimiter('read', requestsPerMinute).check(`int_key_read:${keyId}`)
  );
}

// ==================== NAMED ACTION LIMITS ====================

/**
 * Limits for actions identified by name rather than by request shape.
 *
 * This absorbed `src/features/messaging/lib/rate-limiter.ts` (ADR-0002): one
 * limit table, one store, instead of a second implementation with a private
 * in-process budget nothing could observe or reset.
 */
export const ACTION_RATE_LIMITS = {
  /** Message sending: 60 per minute. */
  MESSAGE_SEND: { requests: 60, windowMs: 60 * 1000 },
  /** Conversation creation: 10 per minute. */
  CONVERSATION_CREATE: { requests: 10, windowMs: 60 * 1000 },
} as const;

export type RateLimitAction = keyof typeof ACTION_RATE_LIMITS;

const actionLimiters = new Map<RateLimitAction, Limiter>();

/**
 * Rate limit a named action for one identifier (normally a user id).
 */
export async function rateLimitAction(
  action: RateLimitAction,
  identifier: string
): Promise<RateLimitResult> {
  let limiter = actionLimiters.get(action);
  if (!limiter) {
    const { requests, windowMs } = ACTION_RATE_LIMITS[action];
    limiter = slidingWindow({ limit: requests, windowMs });
    actionLimiters.set(action, limiter);
  }
  return toRateLimitResult(limiter.check(`${action}:${identifier}`));
}

// ==================== RESPONSE HELPERS ====================

export function createRateLimitResponse(result: RateLimitResult): Response {
  const resetDate = new Date(result.resetTime).toUTCString();

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      limit: result.limit,
      remaining: result.remaining,
      resetTime: result.resetTime,
      resetDate,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders(result),
      },
    }
  );
}

/**
 * Compute seconds until a rate limit resets.
 * Eliminates the repeated inline Math.ceil((result.resetTime - Date.now()) / 1000).
 */
export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.ceil((result.resetTime - Date.now()) / 1000);
}

/**
 * Standard rate limit headers as a plain record — limitkit's `toHeaders`,
 * which is the header set ADR-0002 specified: X-RateLimit-Limit, -Remaining,
 * -Reset (epoch SECONDS, per the de-facto standard), and Retry-After on
 * refusals only. Defined once here so no caller can emit a divergent set.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return toHeaders({
    allowed: result.success,
    limit: result.limit,
    remaining: result.remaining,
    resetAt: result.resetTime,
    retryAfterSeconds: result.success ? 0 : Math.max(1, retryAfterSeconds(result)),
  });
}

/**
 * Apply standard rate limit headers to an existing Response.
 */
export function applyRateLimitHeaders<T extends Response>(response: T, result: RateLimitResult): T {
  for (const [name, value] of Object.entries(rateLimitHeaders(result))) {
    response.headers.set(name, value);
  }
  return response;
}

export { clientIpKey };
