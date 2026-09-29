-- OAuth: resource indicators (RFC 8707) and dynamic client registration (RFC 7591).
--
-- AI apps (claude.ai custom connectors, ChatGPT connectors, Claude Code, Cursor)
-- connect to OrangeCat's MCP server and to Loki's with one OrangeCat sign-in.
-- Two things the provider could not express before:
--
-- 1. WHICH server a token is for. /oauth/authorize now takes `resource`; it is
--    bound to the code, carried onto the refresh token, and becomes the access
--    token's `aud`, so a token minted for Loki is refused by OrangeCat and the
--    reverse. NULL = no resource asked for: the original "Login with OrangeCat"
--    shape, `aud` = client_id. Existing rows keep NULL and behave as before.
--
-- 2. WHO registered a client. Until now every oauth_clients row was inserted
--    by an operator. /oauth/register lets an app register itself; the consent
--    screen must then say it is unverified, so the origin is stored rather than
--    guessed from the `dcr_` client_id prefix.
--
-- Values of registered_via are the ids of OAUTH_CLIENT_ORIGINS in
-- src/lib/oauth/config.ts. The CHECK pins that two-value set because the
-- consent screen's warning depends on it being exactly right.
--
-- Rollback: ALTER TABLE public.oauth_auth_codes DROP COLUMN resource;
--           ALTER TABLE public.oauth_refresh_tokens DROP COLUMN resource;
--           ALTER TABLE public.oauth_clients DROP COLUMN registered_via;

ALTER TABLE public.oauth_auth_codes
  ADD COLUMN IF NOT EXISTS resource text;

ALTER TABLE public.oauth_refresh_tokens
  ADD COLUMN IF NOT EXISTS resource text;

ALTER TABLE public.oauth_clients
  ADD COLUMN IF NOT EXISTS registered_via text NOT NULL DEFAULT 'admin';

ALTER TABLE public.oauth_clients
  ADD CONSTRAINT oauth_clients_registered_via_known CHECK (registered_via IN ('admin', 'dcr'));

COMMENT ON COLUMN public.oauth_auth_codes.resource IS
  'RFC 8707 resource the code was issued for; becomes the access token aud. NULL = none requested (aud = client_id).';
COMMENT ON COLUMN public.oauth_refresh_tokens.resource IS
  'RFC 8707 resource carried across refresh rotation. NULL = none requested.';
COMMENT ON COLUMN public.oauth_clients.registered_via IS
  'admin = registered by an OrangeCat operator; dcr = registered itself via /oauth/register (RFC 7591) and is unverified.';
