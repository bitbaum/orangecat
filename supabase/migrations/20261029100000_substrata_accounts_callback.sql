-- Substrata moves its sign-in onto @bitbaum/accountkit (bitbaum/substrata),
-- whose "Continue with OrangeCat" returns to better-auth's callback path,
-- /api/auth/oauth2/callback/orangecat, not Auth.js's /api/auth/callback/orangecat.
-- Redirect URIs match exactly (src/services/auth/oauthProvider.ts), so the new
-- one is added beside the old: both work, whichever release is live.
--
-- Data only, idempotent, and a no-op where the client does not exist.
UPDATE public.oauth_clients
SET redirect_uris = array_append(
  redirect_uris,
  'https://substrata.orangecat.ch/api/auth/oauth2/callback/orangecat'
)
WHERE client_id = 'substrata'
  AND NOT ('https://substrata.orangecat.ch/api/auth/oauth2/callback/orangecat' = ANY (redirect_uris));
