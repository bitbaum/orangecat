---
created_date: 2026-09-29
last_modified_date: 2026-09-29
last_modified_summary: First version — switching passkeys on at the auth server
---

# Passkeys (WebAuthn)

OrangeCat's code supports passkeys end to end (Settings → Security → Passkeys
to add and remove them; "Sign in with a passkey" on `/auth`), but the auth
server ships with them OFF, and the UI hides both until it says otherwise. This
is the one switch that turns them on.

The app never guesses: `/auth` and the settings page read
`passkeys_enabled` from GoTrue's public settings document
(`/auth/v1/settings`) and show nothing while it is `false`. A button that
cannot work is a dead end, so there is no button.

## What the box needs

GoTrue (Supabase Auth, self-hosted) reads its configuration from the service
environment in `/opt/orangecat` (the same place the social-login providers are
configured — see `oauth-social-login.md`). Add:

```
GOTRUE_PASSKEY_ENABLED=true
GOTRUE_WEBAUTHN_RP_ID=orangecat.ch
GOTRUE_WEBAUTHN_RP_DISPLAY_NAME=OrangeCat
GOTRUE_WEBAUTHN_RP_ORIGINS=https://orangecat.ch
```

- `RP_ID` is the domain the passkey is bound to. The page that runs the
  ceremony is `https://orangecat.ch`, so the id is `orangecat.ch` — NOT
  `supabase.orangecat.ch`, even though that is where the API lives. A passkey
  created for one id never works for another, so get this right before the
  first person creates one; changing it later strands every passkey.
- `RP_ORIGINS` must be https (GoTrue refuses http except on localhost) and must
  list every origin the ceremony runs on. Add `https://www.orangecat.ch` too if
  the site is ever served there without a redirect.
- Optional: `GOTRUE_PASSKEY_MAX_PASSKEYS_PER_USER` (default 10) and
  `GOTRUE_RATE_LIMIT_PASSKEY` (default 30 per interval).

Restart the auth service. Then:

```bash
curl -s https://supabase.orangecat.ch/auth/v1/settings -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" | jq .passkeys_enabled
# true
```

Within five minutes (the app caches the settings document that long) the
passkeys card appears under Settings → Security and the sign-in button on
`/auth`.

## Verify

1. Signed in, open Settings → Security → Passkeys → Add a passkey. The
   browser's own prompt appears (Touch ID, Windows Hello, a phone). The new
   passkey is listed with its name and date.
2. Sign out. On `/auth`, "Sign in with a passkey" → the browser prompt → signed
   in, with no email or password typed.
3. Settings → Security → remove the passkey. Signing in with it now fails
   with the browser's own "no passkey" message.

`scripts/auth/passkeys-e2e.mjs` drives exactly those steps against a
deployment with Chromium's virtual authenticator standing in for a fingerprint
reader (`BASE=https://orangecat.ch node scripts/auth/passkeys-e2e.mjs`). It
exits 2, not 0, while the server still reports `passkeys_enabled: false`, so it
cannot be mistaken for a pass before the switch is thrown.

## What passkeys do NOT change

- Recovery. A passkey is a way in, not a way back in; losing every device
  still means the emailed code or a linked provider (ADR-0009, D6).
- Two-factor. A passkey already proves possession and presence; GoTrue does
  not ask for TOTP after a passkey sign-in.
- Other products. Solon, Loki and Heidi sign in through OrangeCat, so a passkey
  registered here signs the person in everywhere.
