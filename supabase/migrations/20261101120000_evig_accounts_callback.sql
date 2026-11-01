-- evig is moving its sign-in onto @bitbaum/accountkit (bitbaum/evig,
-- docs/ACCOUNTKIT-MIGRATION.md), whose "Mit OrangeCat anmelden" returns to
-- better-auth's callback path, /api/auth/oauth2/callback/orangecat, not
-- Auth.js's /api/auth/callback/orangecat. Redirect URIs match exactly
-- (src/services/auth/oauthProvider.ts), so the new one is added beside the old:
-- both work, whichever release is live.
--
-- evig's client (client_id 'evig', read from its live authorize request on
-- 2026-11-01) was registered on the box, not in a migration. Data only, idempotent, and a no-op where no such client exists.
UPDATE public.oauth_clients
SET redirect_uris = array_append(
  redirect_uris,
  'https://evig.orangecat.ch/api/auth/oauth2/callback/orangecat'
)
WHERE client_id = 'evig'
  AND NOT ('https://evig.orangecat.ch/api/auth/oauth2/callback/orangecat' = ANY (redirect_uris));
