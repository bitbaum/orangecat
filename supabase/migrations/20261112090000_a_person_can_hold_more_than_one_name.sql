-- A person can hold more than one name (ADR-0014).
--
-- An IDENTITY here is a whole account: its own auth user, profile, actor,
-- wallet, timeline and inbox, exactly as the Cat's account is (a user nobody
-- signs into directly). What makes it one of a person's identities is a single
-- private row saying who holds it. Nothing else in the schema changes, and
-- nothing an identity owns points at its holder, so two identities of one
-- person cannot be joined from any public row.
--
-- Rejected: more `actor_type='user'` rows under one login. Measured on a
-- replay of this schema, 44 RLS policies and the NOT NULL `user_id` on eight
-- entity tables key on the login, so a second actor either cannot act or
-- publishes its holder's id on every row it creates.
--
-- The link is private by construction: RLS is on and there is NO policy, so
-- only the service role reads or writes it (the same arrangement as
-- profile_claims, ADR-0004). The application answers "which identities are
-- mine" from the holder's own session and never exposes it for anyone else.
--
-- Rollback: DROP TABLE public.identity_links; (and the two functions below).
-- Accounts created as identities remain as ordinary, unreachable accounts.

CREATE TABLE IF NOT EXISTS public.identity_links (
  identity_user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  holder_user_id   uuid NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_links_not_self CHECK (identity_user_id <> holder_user_id)
);

CREATE INDEX IF NOT EXISTS idx_identity_links_holder ON public.identity_links (holder_user_id);

ALTER TABLE public.identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.identity_links TO service_role;

COMMENT ON TABLE public.identity_links IS
  'Who holds an additional identity (ADR-0014). Service-role only: the link between a person''s identities is never readable by anyone else.';

-- The shape rules, kept in the database so no code path can skip them:
--   * one level only: a holder is never itself an identity, and an identity
--     never holds identities (no chains to walk, no cycles to detect);
--   * a hard ceiling per holder. The product limit is lower and lives in
--     src/config/identities.ts; this is the backstop behind it.
CREATE OR REPLACE FUNCTION public.identity_links_keep_their_shape()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.identity_links WHERE identity_user_id = NEW.holder_user_id) THEN
    RAISE EXCEPTION 'an identity cannot hold identities' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.identity_links WHERE holder_user_id = NEW.identity_user_id) THEN
    RAISE EXCEPTION 'an account that holds identities cannot become one' USING ERRCODE = 'check_violation';
  END IF;
  -- Serialise additions per holder so two concurrent creates cannot both pass
  -- the count below.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.holder_user_id::text, 0));
  IF (SELECT count(*) FROM public.identity_links WHERE holder_user_id = NEW.holder_user_id) >= 24 THEN
    RAISE EXCEPTION 'this account already holds the maximum number of identities'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS identity_links_keep_their_shape ON public.identity_links;
CREATE TRIGGER identity_links_keep_their_shape
  BEFORE INSERT ON public.identity_links
  FOR EACH ROW EXECUTE FUNCTION public.identity_links_keep_their_shape();

-- A link is written once. Changing who holds an identity is a different act
-- (handing it over) with its own rules; an UPDATE here would be a quiet way to
-- take someone's account.
CREATE OR REPLACE FUNCTION public.identity_links_are_written_once()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'identity links are not edited; delete and create' USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS identity_links_are_written_once ON public.identity_links;
CREATE TRIGGER identity_links_are_written_once
  BEFORE UPDATE ON public.identity_links
  FOR EACH ROW EXECUTE FUNCTION public.identity_links_are_written_once();



-- "Sign out everywhere" must reach every identity a person holds: a session
-- for one can become a session for any other, so ending only the account the
-- request came from leaves a lost device one switch away from the rest. GoTrue's
-- admin API can end a session only when handed that session's own token, which
-- the server does not have for the other accounts, so the sessions are removed
-- here (refresh tokens cascade from auth.sessions). Access tokens already
-- issued run out within the hour, as with any global sign-out.
--
-- plpgsql resolves auth.sessions when the function runs, not when it is
-- created, so this file applies on a database without that table.
CREATE OR REPLACE FUNCTION public.end_sessions_of(p_user_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM auth.sessions WHERE user_id = ANY (p_user_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.end_sessions_of(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.end_sessions_of(uuid[]) TO service_role;
NOTIFY pgrst, 'reload schema';
