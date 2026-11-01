-- Petvity, Surf Your Life and Loki are moving their sign-in onto
-- @bitbaum/accountkit (each repo's docs/ACCOUNTKIT-MIGRATION.md, or Loki's
-- staging PR), whose "Sign in with OrangeCat" returns to better-auth's callback
-- path, /api/auth/oauth2/callback/orangecat, not Auth.js's
-- /api/auth/callback/orangecat. Redirect URIs match exactly
-- (src/services/auth/oauthProvider.ts), so the new one is added beside the old:
-- both work, whichever release is live. Same shape as
-- 20261101120000_evig_accounts_callback.sql.
--
-- The client ids are the ones each app's live authorize request carried
-- (bitbaum/fleet docs/auth-parity-2026-10-30.md: petvity, surf-your-life,
-- loki). Those clients were registered on the box, not in a migration. Data
-- only, idempotent, and a no-op where a client does not exist.
UPDATE public.oauth_clients AS c
SET redirect_uris = array_append(c.redirect_uris, v.uri)
FROM (VALUES
  ('petvity', 'https://petvity.orangecat.ch/api/auth/oauth2/callback/orangecat'),
  ('surf-your-life', 'https://surf-your-life.orangecat.ch/api/auth/oauth2/callback/orangecat'),
  ('loki', 'https://loki.orangecat.ch/api/auth/oauth2/callback/orangecat')
) AS v(client_id, uri)
WHERE c.client_id = v.client_id
  AND NOT (v.uri = ANY (c.redirect_uris));
