# OrangeCat Public API Conventions

This document is the rulebook for `/api/v1/*` and everything we ship under it. Anyone touching the public API surface — adding a route, changing a schema, building an SDK, integrating from Loki — should read this first. The internal `/api/<entity>/*` routes are out of scope; conventions there are looser because they only serve the OrangeCat web app.

**Last reviewed**: 2026-06-03

---

## 1. Versioning

- **URL-prefixed.** `v1` lives at `/api/v1/...`. There is no `v0`, there will be no "unversioned but stable" endpoint. If it's not under `/v1/`, it's not part of the contract.
- **Breaking changes ship under a new prefix.** `/api/v2/...` co-exists with `/api/v1/...`; we deprecate v1 at announce-time, sunset no sooner than 12 months later.
- **Non-breaking changes are fine in place.** New optional request fields, new response fields integrations can ignore, new endpoints, new error codes — all OK within a version.
- **What counts as breaking** (non-exhaustive):
  - Removing or renaming a request field
  - Removing or renaming a response field
  - Tightening a validation rule that used to accept a value
  - Removing an endpoint
  - Changing an HTTP status code for an existing condition
  - Changing the `code` field of an error response

## 2. Auth

- **Integration key.** `X-OrangeCat-Key: ock_<48-hex>` is the canonical header. `Authorization: Bearer ock_<48-hex>` is also accepted for clients that only support bearer tokens.
- **Session cookies** are also accepted on `/api/v1/*` so the OrangeCat web app and an integrator share the same code path (lower test surface).
- **Failure modes**: a present-but-invalid integration key returns `401` and does NOT silently fall through to the session. The presence of the header signals intent.

## 3. Response envelope

Every successful response uses the shape declared in `src/lib/api/standardResponse.ts`:

```jsonc
{
  "success": true,
  "data": {
    /* endpoint payload */
  },
  "metadata": {
    "timestamp": "2026-06-03T10:00:00.000Z",
    // optional pagination: page, limit, total
  },
}
```

Every error response:

```jsonc
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED", // UPPERCASE on the wire — see codes table below
    "message": "Unauthorized", // human-readable, may be translated
    "details": {
      /* endpoint-specific */
    },
  },
  "metadata": { "timestamp": "2026-06-03T10:00:00.000Z" },
}
```

- **`error.code` is stable** (case-insensitive). Once a code is in the catalogue, never reuse it for a different condition.
- **`error.message` is human prose.** Translatable. Clients should branch on `error.code`, never on `error.message`.
- **`@orangecat/sdk` normalizes** server codes to lowercase before matching against the catalogue, so SDK consumers branch on the lowercase forms (`'unauthorized'`, not `'UNAUTHORIZED'`).

### Canonical error codes (initial set — extend as endpoints grow)

The wire shape is uppercase; the catalogue is documented in lowercase to match what SDKs branch on.

| code (SDK form)    | wire form          | HTTP | When                                                        |
| ------------------ | ------------------ | ---- | ----------------------------------------------------------- |
| `unauthorized`     | `UNAUTHORIZED`     | 401  | No or invalid auth                                          |
| `forbidden`        | `FORBIDDEN`        | 403  | Authenticated but not permitted (e.g. actor not authorised) |
| `validation_error` | `VALIDATION_ERROR` | 400  | Request body failed Zod validation                          |
| `not_found`        | `NOT_FOUND`        | 404  | Resource doesn't exist or is hidden by RLS                  |
| `conflict`         | `CONFLICT`         | 409  | Duplicate / idempotency violation                           |
| `rate_limited`     | `RATE_LIMITED`     | 429  | Per-user/per-key quota exceeded                             |
| `internal_error`   | `INTERNAL_ERROR`   | 500  | Unhandled server failure                                    |

## 4. Idempotency (planned — not yet enforced)

Mutating endpoints (POST, PUT, DELETE) **will** accept `Idempotency-Key: <client-generated-string>` and dedupe retries within 24 hours. Until that lands, SDKs should:

- Always pass `Idempotency-Key` on POST (forwards-compatible no-op today)
- Treat a retryable network failure (`ECONNRESET`, `ETIMEDOUT`, `5xx`) as eligible for retry only when the previous attempt included an `Idempotency-Key`

## 5. Rate limits

- Per-user (session auth) and per-key (integration auth) limits are independent. A user with one integration key can sustain ~2x the throughput.
- Limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`) accompany every response when rate limiting applies.
- 429 responses MUST include `Retry-After` in seconds.

## 6. Pagination

- List endpoints (not yet exposed via `/v1/`) will use **cursor pagination**, not offset/page. The discovery endpoint will document the cursor parameter name as it lands.
- `limit` is bounded at 100 unless explicitly negotiated.

## 7. Request validation

- Every request body is validated server-side with the canonical Zod schema. Client-side validation is advisory.
- Validation failures return `400 validation_error` with `details` containing the Zod issue list (path + message).

## 8. Naming

- Endpoint paths: `kebab-case`, lowercase, pluralised resource (`/products`, not `/product`).
- JSON fields: `snake_case` (matches DB schema and the rest of the platform).
- Enum values: lowercase snake_case (`active`, `paused`, `archived`).

## 9. Timestamps

- All timestamps are ISO 8601 UTC strings: `"2026-06-03T10:00:00.000Z"`. The `Z` suffix is mandatory.

## 10. Bitcoin amounts

- Stored and transmitted as BTC numeric values with up to 8 decimals (`NUMERIC(18,8)` in the DB). Field name suffix: `_btc`.
- Never use `_sats`. Never use floats without explicit decimal precision.

## 11. Webhooks (shipped 2026-06)

Endpoints are minted via `POST /api/webhook-endpoints` (session auth only) and delivered by the cron worker (`/api/cron/webhook-worker`, systemd timer on the box):

- Payloads are signed with HMAC-SHA-256 using the endpoint's secret (returned once at mint). Verification header: `X-OrangeCat-Signature: t=<unix_seconds>,v1=<hex>`; signed string is `${timestamp}.${rawBody}` with a 5-minute default tolerance. Receivers verify with `@orangecat/sdk` (`verifyWebhookSignature`).
- Failed deliveries retry with exponential backoff, up to 6 attempts, then flip to `status='failed'`.
- Each event has a stable `type` string from the `PUBLIC_API_WEBHOOK_EVENTS` allowlist (`src/config/public-api.ts`).
- **URL policy (SSRF guard, 2026-07):** webhook URLs must be public https URLs. URLs pointing at localhost, private/reserved IP ranges (RFC1918, link-local/cloud-metadata, CGNAT), or hostnames resolving to them are rejected at mint time and re-checked before every delivery (`src/lib/security/ssrfGuard.ts`). Dev allows localhost receivers.

## 12. SDK / client guidance

- **Always send `User-Agent`** identifying the SDK and version (`@orangecat/sdk@0.1.0 node/20`).
- **Always send `Idempotency-Key`** on mutating requests, even if today's server ignores it.
- **Default timeout: 20 seconds** — matches Loki's existing `useFetch` convention and gives the server enough headroom for cold starts.
- **Retry transient failures** (network errors, 5xx, 429) with exponential backoff. Honour `Retry-After`.
- **Tree-shake.** Ship ESM-only with `"type": "module"` and a clean `"exports"` map.

## 13. Documentation

- The machine-readable contract lives at `GET /api/v1/openapi.json`.
- The human contract lives in `/api/v1/README.md` (in repo) and, eventually, on a dedicated developer portal.
- Any new endpoint MUST land with both: a registry entry in `src/lib/openapi/registerV1Routes.ts` and a row in the README endpoint table.

## 14. Discipline checklist for new public endpoints

Before merging a change that adds or modifies anything under `/api/v1/`:

- [ ] Endpoint registered in `src/lib/openapi/registerV1Routes.ts`
- [ ] Request/response Zod schemas annotated with `.openapi({ description, example })` where helpful
- [ ] README endpoint table updated
- [ ] Error codes added to the canonical catalogue (section 3) if introducing new ones
- [ ] If breaking: new `/v2/` prefix, deprecation note in `/v1/` docs
- [ ] If new auth path: section 2 updated
