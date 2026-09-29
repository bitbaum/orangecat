---
created_date: 2026-09-29
last_modified_date: 2026-09-29
last_modified_summary: First version — rotating the OIDC signing key without signing anyone out
---

# OIDC signing key rotation

OrangeCat signs every access token and id token for "Sign in with OrangeCat"
with one RS256 key. Relying parties (Solon, Loki, Heidi, Claude.ai, any site
that registered itself) fetch the public half from `/oauth/jwks.json` and
cache it. Rotate the key when it may have leaked, when a person who held the
box's environment leaves, or yearly by habit.

The mechanism already exists (`src/lib/oauth/keys.ts`): the app signs with the
key in `OAUTH_JWT_PRIVATE_KEY`, publishes it under `OAUTH_JWT_KID`, and ALSO
publishes any keys listed in `OAUTH_JWT_PREVIOUS_JWKS`. Tokens carry the
`kid` they were signed with, so a relying party that fetched the JWK set
after the rotation verifies old and new tokens alike. This runbook is the
order of operations that makes that overlap hold.

## Why the overlap matters

Access tokens live one hour (`OAUTH_TTL.accessToken`). A token signed with the
old key and presented after the rotation must still verify, or every person
signed in to Solon or Loki at that moment is thrown out, and every AI app
mid-conversation with the Cat fails its next call. The old public key stays
published until every token it signed has expired — one hour plus clock skew;
keep it a day.

## Steps (on the box, `/opt/orangecat/app/.env`)

1. **Generate the new key pair.** Anywhere private; never on a shared machine.

   ```bash
   openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out new.pem
   NEW_KID="oc-prod-$(date +%Y%m%d)-$(openssl rand -hex 3)"
   base64 -w0 new.pem > new.pem.b64
   ```

2. **Export the CURRENT public key as a JWK** — from the live JWKS endpoint,
   which already has it in the right shape:

   ```bash
   curl -s https://orangecat.ch/oauth/jwks.json | jq -c '.keys'
   ```

   Keep the output; it becomes `OAUTH_JWT_PREVIOUS_JWKS`.

3. **Edit the environment**, in one change:

   ```
   OAUTH_JWT_PRIVATE_KEY=<contents of new.pem.b64>
   OAUTH_JWT_KID=<NEW_KID>
   OAUTH_JWT_PREVIOUS_JWKS=<the JSON array from step 2>
   ```

4. **Restart the app** (the deploy's usual restart). From this moment new
   tokens carry `NEW_KID`; `/oauth/jwks.json` lists both keys.

5. **Verify.**

   ```bash
   curl -s https://orangecat.ch/oauth/jwks.json | jq '[.keys[].kid]'   # two kids
   ```

   Sign in to Solon in a private window: the round trip must complete. Any
   session already open on Solon or Loki must keep working without a new
   sign-in (their tokens still verify against the old key).

6. **Retire the old key after 24 hours.** Remove `OAUTH_JWT_PREVIOUS_JWKS`
   (or drop the old entry from it) and restart. Delete `new.pem` and
   `new.pem.b64` from wherever step 1 ran.

## If the key LEAKED

Do steps 1–4 immediately, then skip the overlap: leave
`OAUTH_JWT_PREVIOUS_JWKS` empty. Every token signed with the leaked key stops
verifying at once. People are signed out of the products that sign in through
OrangeCat and must sign in again; that is the point. Also revoke every OAuth
refresh token (they are opaque and hashed, so not affected by the key, but a
leak of the environment likely exposed more than the key):

```sql
UPDATE public.oauth_refresh_tokens SET revoked_at = now() WHERE revoked_at IS NULL;
```

## What this does NOT rotate

- GoTrue's own JWT secret (`GOTRUE_JWT_SECRET`) — that signs OrangeCat's own
  sessions, not OIDC tokens, and has its own procedure in the Supabase docs.
- Client secrets (`oauth_clients.client_secret_hash`) — rotate one with
  `scripts/oauth/register-client.ts --client <id> --rotate`.
