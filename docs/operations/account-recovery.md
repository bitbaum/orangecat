---
created_date: 2026-09-29
last_modified_date: 2026-09-29
last_modified_summary: First version — every way back into an account, and the switch that lets people add one
---

# Account recovery

ADR-0009, step D6: an account survives losing the inbox. Three things make
that true, and one of them needs a switch on the box.

## What exists

1. **Ways to sign in** (Settings → Security). Lists every identity at the
   auth server (email, Google, GitHub, X…), the passkey count, and a "Link
   Google / GitHub / …" button for each working provider not yet linked.
   Removing a method is refused, before the click, while it would leave no
   way in; email is kept while a passkey is the only other way (it is how a
   lost device is recovered).
2. **"Can't get to your email?"** (`/auth/cant-get-email`), linked from
   "Forgot password?" and from the reset form. A linked provider, a passkey
   (when switched on), the inbox's own recovery, and support — each a real way
   in that exists today.
3. **The emailed code** still creates or signs in an account with nothing but
   the inbox; a person who still has it never needs this page.

## The switch: linking a second provider

GoTrue refuses to add a second identity to an existing account unless manual
linking is on. Without it, "Link Google" fails with `Manual linking is
disabled`, which the card reports as "not switched on yet".

In the GoTrue service environment in `/opt/orangecat` (same place as the
passkey and social-login settings):

```
GOTRUE_SECURITY_MANUAL_LINKING_ENABLED=true
```

Restart the auth service. No app change is needed.

Why it is off by default upstream: with linking on, a signed-in session can
attach a provider account. That is what we want (it is the second way in),
and the session is the person's own; the risk upstream guards against —
an attacker with a stolen session adding their own Google — is the same risk
as that session changing the email, which is already possible. Linking
does not merge accounts: the provider identity attaches to the signed-in
user, and a provider already tied to another account is refused.

## What is deliberately NOT built

**Backup codes as a first factor.** The auth server's recovery codes are a
second factor (they stand in for TOTP after a password), not a way in on
their own. A first-factor backup code would be a credential OrangeCat itself
issues, stores and verifies — a new attack surface (brute force, storage,
display-once handling) for a path that a linked provider or a passkey already
covers with less to get wrong. Revisit only if people without any provider
or passkey turn out to be common.

## Verify

1. Settings → Security → Ways to sign in shows Email. "Link GitHub" → GitHub
   consent → back on Settings with GitHub listed.
2. Sign out. On `/auth`, the GitHub button signs in without an email.
3. Ways to sign in → with two methods listed, both remove buttons are
   enabled. Remove GitHub: it goes; the Email row's remove button is now
   disabled, and hovering it says why ("the only way into your account").
4. `/auth?mode=forgot` and `/auth/reset-password` both show "Can't get to your
   email?", which opens the page above.
