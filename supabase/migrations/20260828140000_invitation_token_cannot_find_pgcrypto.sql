-- Generating an invitation token raises, because it looks for pgcrypto in the
-- wrong schema.
--
-- `generate_invitation_token()` calls `gen_random_bytes(24)` unqualified and
-- declares no search_path, so the name resolves against whatever the CALLER
-- has. pgcrypto is installed in `extensions`, not `public` — which is the
-- normal Supabase layout — and PostgREST calls with `public` on the path. So
-- the function raises `function gen_random_bytes(integer) does not exist` every
-- time, and no invitation token has ever been generated.
--
-- Same family as the timeline functions repaired in 20260828110000: a
-- reference that is only resolved at call time, so it looks correct until
-- somebody uses it. Found by the plpgsql_check gate added alongside them, which
-- is the first thing that has ever been able to see this class.
--
-- Two changes, and the first is the fix:
--
--   * qualify the call as `extensions.gen_random_bytes`, so it resolves by
--     name rather than by whoever happens to be calling;
--   * pin `search_path`, which this function did not set at all. An unpinned
--     search_path on a function is also how a caller can shadow a name it
--     resolves — worth closing on a function whose whole job is minting a
--     credential.
--
-- Deliberately NOT moving pgcrypto into public: extensions belong in their own
-- schema, and every other caller already reaches them there.

CREATE OR REPLACE FUNCTION public.generate_invitation_token()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN encode(extensions.gen_random_bytes(24), 'base64');
END;
$function$;
