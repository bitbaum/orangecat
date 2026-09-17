# ADR-0002 – Unify Rate Limiting Modules

Status: Accepted
Date: 2026-01-18
Resolved: 2026-08-25
Completed: 2026-09-05 — remaining work implemented via `limitkit@0.2.0` (see addendum)

## Context (as written 2026-01-18)

Two rate limiting implementations existed:

- `src/lib/rate-limit.ts` (Upstash + in-memory fallback, exported helpers)
- `src/lib/api/rateLimiting.ts` (richer API with strategies, cleanup, status)

## What actually happened between Proposed and Accepted

Worth recording, because almost none of the original plan survived contact:

- **`src/lib/api/rateLimiting.ts` no longer exists.** It was removed at some point
  independently of this ADR. The duplication this document was written about
  resolved itself without the migration plan below ever being executed.
- **A different duplicate appeared in the meantime**, which this ADR never named:
  `src/features/messaging/lib/rate-limiter.ts`, a sync in-memory limiter with its
  own `Map`, reached through the `features/messaging/lib` barrel by the two
  `/api/messages` routes. So for seven months the count in this document was
  wrong in both directions — it named a file that was gone and missed the one
  that mattered.
- **The proposed `src/lib/rate-limit/` directory was never created.** The
  canonical module is the existing `src/lib/rate-limit.ts` _file_. Renaming it
  now would touch 129 importers to buy nothing.

The lesson is not "the plan was bad". It is that a decision recorded as
**Proposed** and left alone describes the codebase on the day it was written and
drifts from there silently — while the thing it warned about kept happening
somewhere else.

## Decision

One canonical rate limiting module: **`src/lib/rate-limit.ts`**.

Implemented 2026-08-25:

1. **Named-action limits** live there now — `ACTION_RATE_LIMITS` +
   `rateLimitAction(action, identifier)`, covering `MESSAGE_SEND` and
   `CONVERSATION_CREATE`. `windowMs` is the single source; the Upstash window
   string is derived from it so the Redis path and the in-memory fallback cannot
   drift apart.
2. **`src/features/messaging/lib/rate-limiter.ts` is deleted**, along with its
   barrel re-export. Its two consumers now call `rateLimitAction`. Its unused
   `READ_RECEIPT` and `BULK_OPERATION` configs went with it rather than being
   ported forward as speculative surface.
3. **Headers have one owner**: `rateLimitHeaders(result)` returns the record and
   `applyRateLimitHeaders` is implemented on top of it, so the two forms cannot
   emit different header sets.

The messaging limiter was sync, which is exactly why it could never be backed by
anything but process memory. `rateLimitAction` is async for that reason.

## Consequences

- Messaging now counts against the same backend as everything else, instead of a
  private in-process budget nothing could observe or reset.
- Two limiters became one. Verified by search: no references to
  `enforceRateLimit`, `getRateLimitHeaders`, `RATE_LIMIT_CONFIGS` or
  `checkRateLimit` remain anywhere in `src/` or `__tests__/`.

## Known, deliberately not fixed here (as of 2026-08-25; both resolved — see addendum)

- **Upstash is not configured.** `UPSTASH_REDIS_REST_URL` is absent from
  `.env.local` and referenced nowhere in `.github/` or `scripts/`, so the live
  path is the in-memory fallback. On the current deployment — a single
  self-hosted Node process behind Caddy, not serverless — that is _correct_ and
  the warning in the module header is stale advice from the Vercel era. It stops
  being correct the moment a second instance exists.
- **`rate-limit.ts` repeats an upstash-limiter + fallback-limiter + exported
  function triple five times** (general, social, write, tip-recipient, ask-cat).
  That is real duplication inside the canonical module. It was left alone because
  changing it touches the behaviour of 129 importers, and this ADR was about
  removing a second _implementation_, not refactoring the surviving one. It is
  the obvious next step, and `rateLimitAction` is the shape to fold them into.

## Addendum 2026-09-05 — algorithm extracted to `limitkit`

The canonical module survived, but its internals moved to the fleet package
`limitkit@0.2.0` (sliding windows over an injectable two-method `Store`,
bounded-memory default, standard `X-RateLimit-*`/`Retry-After` headers,
`clientIp()`). What changed:

- `src/lib/rate-limit.ts` keeps its full export surface (138 importers
  untouched) but now only declares the LIMITS — every value preserved
  exactly — while limitkit supplies the window arithmetic, store, and headers.
  The five-fold limiter triple is gone.
- The never-configured Upstash path is deleted along with `@upstash/ratelimit`
  and `@upstash/redis`; runtime behaviour on the single self-hosted instance is
  unchanged (the in-memory path was always the live one). A second instance
  now means implementing limitkit's `Store` over shared infrastructure — one
  seam instead of a parallel code path.
- `src/lib/client-ip.ts` delegates X-Forwarded-For parsing to limitkit's
  `clientIp()` (same last-hop correction, `trustedProxies: 1` for the one
  Caddy hop); the app keeps only its `anonymous` bucket naming.
- Headers now follow this ADR's spec exactly via limitkit's `toHeaders`:
  `X-RateLimit-Reset` in epoch seconds (was milliseconds), `Retry-After` on
  refusals only (was emitted on success responses too).
- All windows are sliding, which the Upstash path always declared
  (`Ratelimit.slidingWindow`) — previously the live in-memory fallback
  approximated it with a first-hit-anchored fixed window.
