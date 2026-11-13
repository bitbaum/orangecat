-- Identities hold their boundaries (ADR-0014, after review).
--
-- Three holes an adversarial review found in what shipped, closed where they
-- cannot be skipped.
--
-- 1. LOSING THE CIRCLE IS PERMANENT. An identity that has been given a way in
--    of its own must stand alone (D6a). The gate read the identity's CURRENT
--    address and session, so an identity given a real address could set an
--    unreachable one again and be let back in. Now the first change to its
--    email or password stamps identity_links.lost_circle_at, and a stamped
--    identity never has its circle again.
--
-- 2. A HANDED-OVER IDENTITY KEEPS NO WAY IN. Accepting a hand-over ended the
--    former holder's sessions and nothing else: a passkey, a linked Google or
--    GitHub login or a second factor they had put on the identity stayed, and
--    with it a way back into an account that is no longer theirs.
--    identity_strip_ways_in() removes every row GoTrue keeps for the user
--    except its email identity. It finds those tables from the catalog (any
--    table in the auth schema with a user_id column), so a table a GoTrue
--    upgrade adds is covered the day it lands, with no list here to go stale.
--    The password is replaced by the application through the auth server,
--    which owns its format.
--
-- 3. PERSON TAGS ONLY FOR AN APP'S OWN USERS. identity_person_tags answered
--    for any account, so an app OrangeCat trusts could ask about accounts that
--    never used it and map who holds whom across the whole platform. It now
--    answers only for accounts that have granted that app (oauth_user_grants).
--    Everyone else is simply absent: "cannot be told apart", as before.
--
-- Rollback: DROP TRIGGER identity_loses_circle_on_own_way_in ON auth.users;
--           DROP FUNCTION public.identity_loses_circle_on_own_way_in();
--           DROP FUNCTION public.identity_strip_ways_in(uuid);
--           ALTER TABLE public.identity_links DROP COLUMN lost_circle_at;
--           and re-apply identity_person_tags from 20261112160000.

-- migration-safety: contract-ok identity_person_tags is replaced with an
-- identical signature and return type; it only returns fewer rows.

------------------------------------------------------------------------------
-- 1. Losing the circle is permanent.
------------------------------------------------------------------------------

ALTER TABLE public.identity_links ADD COLUMN IF NOT EXISTS lost_circle_at timestamptz;

COMMENT ON COLUMN public.identity_links.lost_circle_at IS
  'Set the first time this identity''s email or password changes (ADR-0014 D6a). From then on it never has its circle again, whatever its address becomes.';

-- The written-once rule on identity_links (20261112090000) refuses every
-- UPDATE. Stamping this one column is the single update allowed.
CREATE OR REPLACE FUNCTION public.identity_links_are_written_once()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.identity_user_id = OLD.identity_user_id
     AND NEW.holder_user_id = OLD.holder_user_id
     AND NEW.created_at = OLD.created_at
     AND OLD.lost_circle_at IS NULL
     AND NEW.lost_circle_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'identity links are not edited; delete and create' USING ERRCODE = 'check_violation';
END;
$$;

CREATE OR REPLACE FUNCTION public.identity_loses_circle_on_own_way_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.identity_links
     SET lost_circle_at = now()
   WHERE identity_user_id = NEW.id
     AND lost_circle_at IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS identity_loses_circle_on_own_way_in ON auth.users;
CREATE TRIGGER identity_loses_circle_on_own_way_in
  AFTER UPDATE OF email, encrypted_password ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email
        OR OLD.encrypted_password IS DISTINCT FROM NEW.encrypted_password)
  EXECUTE FUNCTION public.identity_loses_circle_on_own_way_in();

------------------------------------------------------------------------------
-- 2. A handed-over identity keeps no way in.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.identity_strip_ways_in(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_rows integer;
  v_total integer := 0;
BEGIN
  -- Only for an identity being handed over: never for an ordinary account.
  -- The caller cuts the link first, so this is checked against the offer it
  -- spent, which the application passes by acting in that order; here the
  -- guard is that the account must sit on an unreachable address.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
     WHERE u.id = p_user_id AND u.email LIKE '%.invalid'
  ) THEN
    RAISE EXCEPTION 'only an identity on an unreachable address can be stripped'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Every auth table that ties rows to a user: sessions (and through them
  -- refresh tokens), second factors, passkeys, one-time tokens, pending
  -- sign-in flows. Found from the catalog, not listed.
  FOR r IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'auth'
       AND c.column_name = 'user_id'
       AND t.table_type = 'BASE TABLE'
       AND c.table_name NOT IN ('users', 'identities')
  LOOP
    EXECUTE format('DELETE FROM auth.%I WHERE user_id::text = $1', r.table_name)
      USING p_user_id::text;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_total := v_total + v_rows;
  END LOOP;

  -- Linked sign-in providers (Google, GitHub, ...). The email identity stays:
  -- it is the one the new owner signs in with.
  DELETE FROM auth.identities WHERE user_id = p_user_id AND provider <> 'email';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_total + v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.identity_strip_ways_in(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_strip_ways_in(uuid) TO service_role;

COMMENT ON FUNCTION public.identity_strip_ways_in(uuid) IS
  'Hand-over (ADR-0014 D9): remove every way in GoTrue keeps for an identity except its email identity. Service role only; refuses an account on a reachable address.';

------------------------------------------------------------------------------
-- 3. Person tags only for an app's own users.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.identity_person_tags(
  p_client_id text,
  p_scope     text,
  p_actor_ids uuid[]
)
RETURNS TABLE (actor_id uuid, tag text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id,
         encode(
           extensions.hmac(
             convert_to(
               length(p_client_id)::text || ':' || p_client_id || '|' ||
               length(p_scope)::text     || ':' || p_scope     || '|' ||
               COALESCE(l.holder_user_id, a.user_id)::text,
               'UTF8'
             ),
             k.key,
             'sha256'
           ),
           'hex'
         )
    FROM public.actors a
    CROSS JOIN public.identity_person_tag_key k
    LEFT JOIN public.identity_links l ON l.identity_user_id = a.user_id
   WHERE a.id = ANY (p_actor_ids)
     AND a.actor_type = 'user'
     AND a.user_id IS NOT NULL
     AND p_client_id <> ''
     AND p_scope <> ''
     -- Only an account that has granted this app: its own users.
     AND EXISTS (
       SELECT 1 FROM public.oauth_user_grants g
        WHERE g.user_id = a.user_id AND g.client_id = p_client_id
     )
$$;
