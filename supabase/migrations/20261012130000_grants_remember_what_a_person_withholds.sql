-- A person chooses, per app, which profile claims it receives (name, username,
-- picture). Empty = share everything the scopes allow, which is what every
-- existing grant did, so nothing changes until someone opts out.
--
-- Stored on the grant because that row already is "this person x this app".
-- The values are checked against PROFILE_CLAIMS (src/lib/oauth/config.ts) at
-- the write boundary, not by a CHECK that would have to be edited in step.
ALTER TABLE public.oauth_user_grants
  ADD COLUMN IF NOT EXISTS withheld_claims text[] NOT NULL DEFAULT '{}'::text[];
