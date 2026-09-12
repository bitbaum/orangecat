# Platform-API Integration Deploy Checklist

**Status**: Ready for use
**Created**: 2026-06-04
**Companion to**: `docs/operations/DEPLOYMENT_CHECKLIST.md` (the general OrangeCat
deployment guide). This file covers the _additional_ steps to exercise an
integration-key + webhook customer (FleetCrown, hirn.li, third-party).

This checklist is what an operator pulls up when running through the
9-step deploy that shipped across the 211188a3 → 6da6b8cd thread. Each
step has the exact command, a verification, and a rollback if it fails.

---

## TL;DR — the 9 steps

```
[ ] 1. Mint a customer integration key at orangecat.ch/settings/integrations
[ ] 2. Mint a webhook endpoint pointing at the customer's inbound URL
[ ] 3. Set customer-side env vars
       (ORANGECAT_API_KEY + ORANGECAT_API_BASE + WEBHOOK_SECRET)
[ ] 4. Run customer-side DB migrations
       (e.g. cd ~/dev/fleetcrown && pnpm run migrate)
[ ] 5. Repack the SDK tarball into the customer's vendor/ folder
[ ] 6. (Optional) pnpm publish --access public on @orangecat/sdk
[ ] 7. Set CRON_SECRET in OrangeCat prod env (/opt/orangecat/app/.env)
[ ] 8. Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
       in OrangeCat prod env (/opt/orangecat/app/.env)
[ ] 9. Set WEBHOOK_SECRET_KEY in OrangeCat prod env (/opt/orangecat/app/.env)
       (master key encrypting webhook_endpoints.secret_encrypted at rest)

[ ] Smoke test: trigger an entity-create on the customer side,
                watch the webhook fire end-to-end.
```

---

## Step 1 — Mint the integration key

1. Sign in to `orangecat.ch` as the customer's binding user.
2. Navigate to **Settings → Integrations**.
3. Click **Create a new key** in the _Integration keys_ section.
4. Fill out:
   - **Name**: e.g. `FleetCrown production`
   - **Acts as**: the actor the key acts as (personal or group).
   - **Environment**: leave **Sandbox** unchecked for production.
   - **Permissions**: leave **Full access (wildcard)** unless customer
     needs least-privilege; otherwise pick the scopes.
5. Click **Create key**.
6. **Copy the plaintext `ock_…` value NOW** — it's shown ONCE.

**Verify**: the key appears in the list with the truncated prefix and
the `Acts as` actor matches. `Scopes:` matches what was picked.

**Rollback**: click **Revoke** on the row; mint again from step 1.

---

## Step 2 — Mint the webhook endpoint

1. On the same page, scroll to _Webhook endpoints_.
2. Click **Create a new endpoint**.
3. Fill out:
   - **Name**: e.g. `FleetCrown subscriptions`
   - **Acts as**: same actor as the integration key (the firing fan-out
     is per actor).
   - **Target URL**: the customer's inbound HTTPS URL. Production URLs
     must start with `https://` — the API rejects http in prod.
   - **Events**: leave empty to receive every event, or tick the
     specific `<entity>.created` tokens the customer subscribes to.
     Unknown events are rejected at mint (8f9f1841).
4. Click **Create endpoint**.
5. **Copy the plaintext `ock_whk_…` value NOW** — it's shown ONCE.

**Verify**: the endpoint appears in the list. The `Events:` column shows
either `all` or the selected list.

**Rollback**: click **Revoke** on the endpoint row; mint again.

---

## Step 3 — Set customer-side env vars

In the customer's environment (e.g. FleetCrown — self-hosted on the same
Hetzner box; edit `/opt/fleetcrown/app/.env`), set:

| Var                  | Value                                  |
| -------------------- | -------------------------------------- |
| `ORANGECAT_API_KEY`  | The `ock_…` plaintext from step 1.     |
| `ORANGECAT_API_BASE` | `https://orangecat.ch/api/v1`          |
| `WEBHOOK_SECRET`     | The `ock_whk_…` plaintext from step 2. |

Apply to all environments the integration should run in (Production
typically). Restart the customer app (e.g. `systemctl restart
fleetcrown-app`) so the new env is loaded.

**Verify**: the customer's logs show the SDK initialised with the new
key on first call.

**Rollback**: remove the env vars; the SDK will fail-closed on next
call (401 from OrangeCat).

---

## Step 4 — Run customer-side DB migrations

For FleetCrown specifically:

```bash
cd ~/dev/fleetcrown
pnpm run migrate
# Applies drizzle/0021_subscriptions_orangecat_service_id.sql which
# adds subscriptions.orangecat_service_id (nullable uuid) so the
# "OC ✓" badge has somewhere to persist its link.
```

For other customers: whatever DB changes their side of the integration
needs.

**Verify**: customer's logs show the migration applied; no schema
drift errors on first integration call.

**Rollback**: drizzle migrations are forward-only by default. If the
migration fails partway, manually drop the columns added and retry.

---

## Step 5 — Repack the SDK tarball

If consuming `@orangecat/sdk` via `file:vendor/orangecat-sdk-X.Y.Z.tgz`
(the pre-publish path):

```bash
# Inside OrangeCat repo:
cd ~/dev/orangecat/packages/sdk
pnpm run build
pnpm pack
# Produces orangecat-sdk-<version>.tgz in the cwd.

# Then copy into the customer's vendor folder:
mv orangecat-sdk-*.tgz ~/dev/fleetcrown/vendor/
# Delete any older tarball there to keep one version on disk.

# Customer-side: update the version pin in package.json if needed,
# then:
cd ~/dev/fleetcrown
pnpm install
```

**Verify**: `pnpm ls @orangecat/sdk` from the customer repo reports the
new version.

**Rollback**: restore the previous tarball + `pnpm install`.

---

## Step 6 — (Optional) publish to the npm registry

Only when ready for public distribution:

```bash
cd ~/dev/orangecat/packages/sdk
pnpm publish --access public
```

This makes step 5's vendor-tarball flow obsolete for future customers —
they can `pnpm install @orangecat/sdk` directly.

**Verify**: `npm view @orangecat/sdk version` reports the published
version.

**Rollback**: `npm deprecate @orangecat/sdk@<version> "<reason>"`.
npm does not allow un-publishing within 72h of publish for security
reasons; deprecate is the polite recall.

---

## Step 7 — Set CRON_SECRET in OrangeCat prod env

Without this, both cron routes 401 every minute / every day:

- `/api/cron/webhook-worker` (every minute — deliveries pile up
  unfired)
- `/api/cron/cleanup` (daily at 02:00 UTC — table bloat starts
  compounding)

Generate a high-entropy secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set it as `CRON_SECRET` in `/opt/orangecat/app/.env` on the Hetzner box and restart the app.

**Verify**: trigger the worker manually with the secret:

```bash
curl -sS https://orangecat.ch/api/cron/webhook-worker \
  -H "authorization: Bearer $CRON_SECRET" | jq
# Expect { ok: true, data: { processed: 0, ranAt: "..." } } on an
# empty queue. Anything other than 200 = misconfig.
```

**Rollback**: remove the env var; cron routes return 401. Crons fail
soft (the app logs the 401 every minute but no data is harmed).

---

## Step 8 — Set Upstash Redis env vars

Without these, per-key rate limits silently degrade to an in-memory
single-instance bucket (only effective within one app process).
Production multi-instance traffic will not be properly throttled.

In `/opt/orangecat/app/.env` on the box (Production):

| Var                        | Value                       |
| -------------------------- | --------------------------- |
| `UPSTASH_REDIS_REST_URL`   | From the Upstash dashboard. |
| `UPSTASH_REDIS_REST_TOKEN` | From the Upstash dashboard. |

**Verify**: in the Upstash dashboard, the analytics chart starts
showing per-second activity once the first authenticated /api/v1
request hits production.

**Rollback**: remove the env vars; rate limiting falls back to
in-memory. Not data-harmful, just less correct under load.

---

## Step 9 — Set WEBHOOK_SECRET_KEY in OrangeCat prod env

Without this, every `POST /api/webhook-endpoints` mint **throws** —
the service encrypts the signing secret at rest with this key, and
will not silently fall back to plaintext storage.

Generate a high-entropy 32-byte hex key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set it as `WEBHOOK_SECRET_KEY` in `/opt/orangecat/app/.env` on the box
(Production). The value must be exactly 64 hex characters.

**Verify**:

1. Mint a webhook endpoint (step 2). If `WEBHOOK_SECRET_KEY` is
   missing or malformed, the mint returns 500 (server logs show
   "WEBHOOK_SECRET_KEY is not set" or "must be 64 hex characters").
2. After setting, mint succeeds; check the DB row has
   `secret_encrypted IS NOT NULL` and `secret_plaintext` does not
   exist (it was dropped in migration 20260604000004).
3. Trigger a delivery (smoke test below). The worker decrypts
   `secret_encrypted` at fire time; logs show the delivery POSTing
   with `X-OrangeCat-Signature`.

**Rollback**: do not rotate this key without coordinating a
re-encryption pass. Every webhook_endpoints row's `secret_encrypted`
was encrypted with the current key — rotating in place leaves them
all unreadable. If the key is leaked, the safe response is:

1. Set the new key alongside the old one (out of scope for this
   deploy; would need a service change to try both keys on
   decrypt).
2. Mint replacement endpoints for every customer, communicate the
   migration, revoke the old endpoints.
3. Once all old endpoints are revoked, drop the old key.

There is no "undo" for `WEBHOOK_SECRET_KEY` going stale — treat it
as a high-value secret with restricted access to the box env file.

---

## Smoke test — exercise the full path

After all 9 steps land:

1. **From customer side**, trigger whatever flow creates an OrangeCat
   entity (for FleetCrown: create a subscription).
2. The SDK call should return `201 Created` with the entity payload.
3. Within ~60 seconds, the webhook worker picks up the enqueued
   delivery and POSTs to the customer's endpoint.
4. On `orangecat.ch/settings/integrations`, click **Deliveries** on
   the endpoint row. The most-recent row should show:
   - Status: `Delivered` (green) if customer's receiver returned 2xx
   - HTTP status code from the customer
   - `event_type` matching the entity that was created
5. The customer's logs should show:
   - The SDK call succeeded
   - The webhook POST landed
   - `verifyWebhookSignature` from `@orangecat/sdk` returned `{valid: true}`

If any of these break, click into the delivery row to see:

- The exact payload OrangeCat sent
- The exact response body the customer returned
- The attempt count + next retry time

Click **Replay** in the expanded row to nudge a single delivery
manually (resets attempt_count, fresh exp-backoff). Useful when the
customer fixed a bug and wants to retry without waiting for the
natural retry schedule.

---

## Known operational surface

- **Webhook backoff**: 1m / 5m / 25m / 2h / 12h / 24h, then status=failed.
  Verified by eb5fc998 + 5f051a83. Failed rows are kept; delivered rows
  are pruned at 30 days by the daily cleanup cron.
- **Idempotency**: 24h TTL on cached responses. Replays within window
  return the same response with `Idempotency-Replay: true` header.
- **Rate limits**: 60/min write + 300/min read per integration key
  (defaults; configurable per call in code, settings UI hook is future).
- **Scopes**: wildcard `['*']` by default; pickable via the mint UI.
- **Sandbox**: `ock_test_` prefix; data-isolated end-to-end. Mint via
  the Environment checkbox in the form.
