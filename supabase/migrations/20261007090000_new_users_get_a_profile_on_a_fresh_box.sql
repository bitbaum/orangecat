-- A freshly built database works: new accounts get a profile, and writes to
-- search-indexed tables stop failing.
--
-- public.handle_new_user() and public.handle_new_user_plan() are in the
-- baseline, but the triggers that run them live on auth.users — a schema the
-- baseline dump (public only) does not carry. Production has them from before
-- the squash; a database rebuilt from these migrations (a new box, the
-- migration-replay job, a disaster restore of the schema) had none. Found by
-- replaying every migration from zero and signing up: the account existed and
-- no profile was ever written, so every page that reads one failed.
--
-- The same replay found the second half of it: public.notify_embedding_reindex()
-- (the trigger that asks the app to re-embed a changed row, on profiles and
-- every entity table) reads private.reindex_config, which only ever existed on
-- the box. On a fresh database every insert into those tables failed with
-- "relation private.reindex_config does not exist" — sign-up included. The
-- function already treats an empty secret as "do not notify"; it only needs
-- the table to exist. The secret itself stays a box-only value: this creates
-- the table empty and readable by nobody but its owner.
--
-- Idempotent and production-safe: a trigger is created only when NO trigger
-- on auth.users already runs that function, whatever its name — so the box,
-- which has them, is left exactly as it is.
--
-- Rollback: nothing to drop on the box (every statement there is a no-op). On a
--           fresh database: DROP TABLE private.reindex_config;
--           DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
--           DROP TRIGGER IF EXISTS on_auth_user_created_plan ON auth.users;
--           (only where this migration created them)

CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE IF NOT EXISTS private.reindex_config (secret text);
REVOKE ALL ON private.reindex_config FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'auth.users'::regclass AND p.proname = 'handle_new_user'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid = 'auth.users'::regclass AND p.proname = 'handle_new_user_plan'
  ) THEN
    CREATE TRIGGER on_auth_user_created_plan
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_plan();
  END IF;
END;
$$;
