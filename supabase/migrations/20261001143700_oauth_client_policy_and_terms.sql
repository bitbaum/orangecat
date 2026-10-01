-- The consent screen links to the app's own privacy policy and terms.
--
-- A person deciding whether to let an app in should be able to read what that
-- app does with their data. RFC 7591 names the two fields (`policy_uri`,
-- `tos_uri`); self-registered apps send them to /oauth/register, operators set
-- them in scripts/oauth/register-client.ts. NULL = the app has published none,
-- and the consent screen says exactly that rather than staying silent.
--
-- Additive only (expand): nothing reads these until the code that ships with it.
--
-- Rollback: ALTER TABLE public.oauth_clients DROP COLUMN policy_uri;
--           ALTER TABLE public.oauth_clients DROP COLUMN tos_uri;

ALTER TABLE public.oauth_clients
  ADD COLUMN IF NOT EXISTS policy_uri text,
  ADD COLUMN IF NOT EXISTS tos_uri text;

COMMENT ON COLUMN public.oauth_clients.policy_uri IS
  'https URL of the app''s privacy policy (RFC 7591 policy_uri), shown on the consent screen. NULL = none published.';
COMMENT ON COLUMN public.oauth_clients.tos_uri IS
  'https URL of the app''s terms of service (RFC 7591 tos_uri), shown on the consent screen. NULL = none published.';
