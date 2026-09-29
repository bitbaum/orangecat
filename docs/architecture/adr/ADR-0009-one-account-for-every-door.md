# ADR-0009: One Account for Every Door

Date: 2026-09-29
Status: Accepted (D1–D4 shipped; D9 in this PR; D5–D8 in order below)

## Context

Four products sign people in today, and a fifth kind — sites we did not build —
is meant to. What a person meets depends on which door they walk through:

| Door            | How you sign in                                                         | Password? | Forgot it?                   |
| --------------- | ----------------------------------------------------------------------- | --------- | ---------------------------- |
| OrangeCat       | email + password, emailed code, Google, GitHub, X, anonymous            | optional  | reset link, or the code path |
| Solon           | OrangeCat only (email first, then Google/GitHub/existing account)       | none here | OrangeCat's                  |
| Heidi           | OrangeCat only                                                          | none here | OrangeCat's                  |
| Loki            | OrangeCat first, then GitHub/Google/X, then Loki's own email + password | optional  | Loki's own reset             |
| evig            | evig's own email + password, with lockout                               | required  | evig's own reset             |
| An outside site | can already register itself and use "Sign in with OrangeCat" (RFC 7591) | —         | OrangeCat's                  |

The foundation is right. OrangeCat is a real OpenID Connect provider: discovery
at `/.well-known/openid-configuration`, authorization code with PKCE, RS256
tokens verified through JWKS, refresh-token rotation, userinfo, remembered
consent for first-party clients, resource indicators, and dynamic client
registration. Solon, Heidi and Loki all consume it. Claude.ai and ChatGPT
register themselves against it to reach the Cat.

What is not right is everything a person touches around that core:

1. **Three password systems** (OrangeCat, Loki, evig), three reset flows, three
   places to get one wrong.
2. **No way to see or end what an app was allowed.** A self-registered AI app
   keeps a thirty-day session the person has no screen to find.
3. **"Sign out everywhere" does not.** It revokes OrangeCat's own sessions;
   the OAuth refresh tokens Solon, Loki and Heidi hold live on.
4. **Losing the inbox loses the account.** Every recovery path runs through
   email.
5. **No passkeys.** Returning people type codes or passwords; the auth server
   supports passkeys but has them switched off.
6. **No developer page.** A site that wants the button has the standard and
   nothing else.
7. **Key rotation has no written procedure.** The overlap mechanism exists
   (`OAUTH_JWT_PREVIOUS_JWKS`), but nothing says the order of operations,
   so a rotation done from memory invalidates every token in flight.

## Decision

**One account, held by OrangeCat. Every product and every outside site is a
client of it. Passwords are optional. Recovery has more than one path. What a
person allowed, they can see and take back.**

Concretely:

- **`sub` is the identity.** OrangeCat's actor id, carried in every id token,
  is the only key that links a person across products. Email never links
  accounts (two accounts may share one, and one may change it).
- **Products keep their own tables, keyed by `sub`.** Loki's users table
  stays, for Loki-only data; so does evig's. Neither stores another
  product's password or session.
- **OrangeCat's screens are the sign-in screens.** A product with a branded
  "Create account" page (Solon has one) hands off with `prompt=create`,
  `login_hint` and `idp_hint`, and OrangeCat's screen opens in that state,
  named for the product that sent the person.
- **Passwords become one option among several**, never the default a new
  person is asked to invent: emailed code (shipped), Google/GitHub (shipped),
  passkey (D5).
- **Every screen that stops a person shows the way forward** (fleet rule: no
  dead ends). Anonymous account meets a product that needs an email → asks
  for it inline. Email not reachable → the "I can't get email" branch (D6).

## Build order

Each step ships and is tested in production on its own. Later steps never
require earlier ones to be undone.

| #   | What                                                                                                                                                                                                                                                                         | Where           | Status  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------- |
| D1  | Sign in or create an account with an emailed code — no password                                                                                                                                                                                                              | OrangeCat #1163 | shipped |
| D2  | Participation pages offer "Create an account", not "Sign in with OrangeCat"                                                                                                                                                                                                  | Solon #199      | shipped |
| D3  | Connected apps: see every app that signed in as you, and disconnect it (consent + refresh tokens)                                                                                                                                                                            | OrangeCat       | this PR |
| D4  | Sign out everywhere revokes OAuth refresh tokens too; account deletion revokes them; the key-rotation runbook uses the JWKS overlap (`OAUTH_JWT_PREVIOUS_JWKS`) so a rotation signs nobody out                                                                               | OrangeCat       | this PR |
| D5  | Passkeys: enable on the auth server (`GOTRUE_PASSKEY_ENABLED`, RP id `orangecat.ch`), add/list/remove in settings, "Sign in with a passkey" on `/auth`                                                                                                                       | box + OrangeCat | next    |
| D6  | Second recovery path: one-time backup code shown once; linked Google/GitHub usable for recovery; an "I can't get email" branch on the reset page                                                                                                                             | OrangeCat       | next    |
| D7  | Loki: sign-up goes through OrangeCat; existing password users get a one-click link; password kept only for unlinked accounts                                                                                                                                                 | Loki            | next    |
| D8  | evig: "Sign in with OrangeCat" beside its own login; staff stays gated by the `is_staff` column, never by email                                                                                                                                                              | evig            | next    |
| D9  | Developer page `/docs/sign-in-with-orangecat`: discovery URL, registration example, Auth.js and generic OIDC snippets, button wording, scopes rendered from `OAUTH_SCOPES`; `scripts/oauth/sign-in-roundtrip.mjs` completes a full code + PKCE round trip against production | OrangeCat       | this PR |

## Security properties this relies on

- **PKCE (S256) and `state` on every relying party**; `nonce` bound into the
  code and echoed in the id token. Loki and Solon declare both checks.
- **Exact redirect-URI match**, no wildcards. Self-registered clients may use
  https anywhere or http on loopback only, are never trusted and never
  confidential, and always see the consent screen.
- **Refresh-token rotation**: a used token is revoked; reuse of a revoked
  token fails. Resource-bound tokens (`aud`) are refused by the wrong server.
- **Access tokens live one hour**, so a revocation (D3, D4) takes at most an
  hour to reach a session that never refreshes, and is immediate for one that
  does. That bound is deliberate; a shorter lifetime would trade it for more
  refresh traffic.
- **Every query on the `oauth_*` tables names the user.** They are
  service-role-only, so the `user_id` filter is the only tenancy boundary.
- **Rate limits on sending**, not on verifying: sign-in codes are limited per
  recipient (3 / 15 min) and per IP (10 / h); verification stays with the
  auth server, whose per-IP limit and code expiry bound guessing.
- **The same answer whether or not an account exists**, on every endpoint that
  takes an email.

## Edge cases, and where each lands

| Situation                                              | What happens                                                                                                                                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forgot the password                                    | Reset link, or the six-digit code in the same email (works across devices); or skip passwords with the sign-in code                                                                           |
| Never had a password (signed up by code or Google)     | Nothing to forget; the code or the provider signs them in                                                                                                                                     |
| Cannot reach the inbox                                 | D6: backup code, or a linked Google/GitHub; until D6, support                                                                                                                                 |
| Started anonymously on OrangeCat, then opened Solon    | Asked for an email inline on the consent screen; the account is upgraded, not replaced                                                                                                        |
| Changes the email                                      | Confirmation on the new address; `sub` is unchanged, so every product's link survives                                                                                                         |
| Two accounts share an email (one Google, one password) | They stay two accounts; linking is explicit (D6 makes a linked provider usable for recovery)                                                                                                  |
| Removes the only sign-in method                        | Not yet refused — D6 adds the guard: an account must keep at least one way in                                                                                                                 |
| Lost a device                                          | Sign out everywhere (D4 makes it reach every product)                                                                                                                                         |
| Lets an AI app in, then regrets it                     | D3: Settings → Integrations → Connected apps → Disconnect. A relying party sees `invalid_grant` on its next refresh and ends the session (Solon #203, Heidi #145); Loki marks the link broken |
| Deletes the account                                    | Auth user deleted. The `oauth_*` rows do not cascade today — D4 revokes them in the same request; Loki/evig rows keyed by `sub` become orphans they clean up on the next sign-in attempt      |
| A relying party is compromised                         | Disable its client row; every token it holds stops at the next refresh, and within an hour otherwise                                                                                          |
| Signing key rotation                                   | D4: publish old and new in JWKS, issue with new, retire old after the access-token lifetime                                                                                                   |

## Alternatives considered

- **Each product runs its own accounts, linked to OrangeCat optionally.**
  Three user tables, three resets, three passkey stores, and the drift is
  already visible between Loki and OrangeCat. Rejected; also forbidden by the
  fleet standard.
- **A shared login cookie across `*.orangecat.ch`.** Fragile across two auth
  stacks (Supabase and Auth.js), and it does nothing for a site we did not
  build. Rejected; the identity bridge doc already calls it a stopgap.
- **A paid identity service.** Would solve passkeys, recovery and rotation in
  one purchase, at the cost of the self-hosted, open-source rule this stack
  runs on, and of every token's issuer changing. Rejected.
- **Verify sign-in codes in OrangeCat, with an attempt counter.** The auth
  server's verify endpoint is public, so a counter here is one an attacker
  walks around. Rejected in D1; noted here so it is not re-proposed.

## What each product retires, once its step lands

- Loki: its sign-up form; its password for linked accounts.
- evig: nothing yet — the credentials login stays until every staff account is
  linked.
- OrangeCat: the "Sign in with OrangeCat" wording on other products' screens
  (D2 did this for Solon); the mandatory public profile page (a separate ADR).

## References

- `src/lib/oauth/config.ts` — issuer, endpoints, scopes, TTLs (SSOT)
- `src/services/auth/oauthProvider.ts` — codes, tokens, consent
- `src/services/auth/oauthRegistration.ts` — dynamic client registration
- `src/services/auth/emailCode.ts` — D1
- `src/services/auth/connectedApps.ts` — D3
- `docs/architecture/PLATFORM_AND_COLLABORATION.md` — why OrangeCat is the
  identity root
- `bitbaum/solon` `docs/design/2026-09-uniform-auth.md` — the decision this
  ADR carries forward (option A)
- `bitbaum/loki` `docs/architecture/cross-product-identity-bridge.md` — the
  Loki relying-party side
