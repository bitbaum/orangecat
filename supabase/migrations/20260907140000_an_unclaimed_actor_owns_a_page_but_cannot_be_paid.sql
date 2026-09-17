-- An unclaimed actor owns a page but cannot be paid.
--
-- ADR-0005 D1-D3, D6. A person set up on someone else's behalf becomes a real
-- `actors` row from minute one — `actor_type = 'unclaimed'`, carrying a
-- display_name, an avatar and a slug, owning real entity rows — so the studio
-- her friend made for her is a real page with a real URL before she has an
-- account. `profiles.id` stays a validated FK to `auth.users(id)`: there is
-- still no profile before an account. What exists is an IDENTITY, and an
-- identity is not a way to receive money.
--
-- ADR-0003's invariant — money must never be routable to an entity whose
-- subject has not accepted it — is kept STRUCTURAL here, not by policy:
--   1. an unclaimed actor has no profile, so no Lightning address (unchanged);
--   2. no wallet can be attached to anything an unclaimed actor owns (the
--      trigger below, on all three wallet tables);
--   3. claiming and declining are single transactions over every foreign key
--      that references actors(id), enumerated from the catalog at run time so
--      a table added next month is covered the day it lands.
--
-- Measured before writing: 25 FKs reference actors(id) — 15 ON DELETE CASCADE,
-- 10 ON DELETE SET NULL. Deleting a declined placeholder alone would therefore
-- leave ten kinds of row alive with no owner; a project with actor_id = NULL is
-- an ownerless fundable thing. So decline deletes owned rows FIRST.

-- migration-safety: contract-ok the two dropped CHECKs are each replaced by a
-- strictly WIDER one (a third actor_type value; the placeholder shape added as
-- an OR branch). Every row the previous release can write is still valid, so a
-- code-only auto-rollback keeps working against this schema.

------------------------------------------------------------------------------
-- 1. A third kind of actor.
------------------------------------------------------------------------------

ALTER TABLE public.actors
  ADD COLUMN claim_id uuid REFERENCES public.profile_claims(id) ON DELETE SET NULL;

ALTER TABLE public.actors DROP CONSTRAINT actors_actor_type_check;
ALTER TABLE public.actors
  ADD CONSTRAINT actors_actor_type_check
  CHECK (actor_type = ANY (ARRAY['user'::text, 'group'::text, 'unclaimed'::text]));

-- The shape check: a user actor has a user, a group actor has a group, and an
-- unclaimed actor has NEITHER — it has the claim that will hand it over, and a
-- display name so the page has something to say.
ALTER TABLE public.actors DROP CONSTRAINT actor_type_check;
ALTER TABLE public.actors
  ADD CONSTRAINT actor_type_check CHECK (
       (actor_type = 'user'      AND user_id IS NOT NULL AND group_id IS NULL     AND claim_id IS NULL)
    OR (actor_type = 'group'     AND group_id IS NOT NULL AND user_id IS NULL     AND claim_id IS NULL)
    OR (actor_type = 'unclaimed' AND claim_id IS NOT NULL AND user_id IS NULL     AND group_id IS NULL
                                 AND display_name IS NOT NULL AND slug IS NOT NULL)
  );

-- A placeholder's slug is its public address (/profiles/<slug>) until a
-- username exists, so it must be unique among placeholders. Scoped to the
-- unclaimed kind: user and group actors are addressed by username and group
-- slug respectively, and this must not start policing those.
CREATE UNIQUE INDEX IF NOT EXISTS actors_unclaimed_slug_unique
  ON public.actors (lower(slug))
  WHERE actor_type = 'unclaimed';

-- The claim points back at the placeholder it hands over. The draft no longer
-- needs to carry entities: the placeholder IS the container.
ALTER TABLE public.profile_claims
  ADD COLUMN actor_id uuid REFERENCES public.actors(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.actors.claim_id IS
  'Set only for actor_type=''unclaimed'': the profile_claims row that hands this identity — and everything it owns — to whoever accepts it.';
COMMENT ON COLUMN public.profile_claims.actor_id IS
  'The unclaimed placeholder actor this claim hands over. NULL for legacy person-only claims.';

------------------------------------------------------------------------------
-- 2. Who owns a thing, answered from the catalog.
------------------------------------------------------------------------------

-- Every (table, column) pair that references actors(id). This is the ONE list
-- the transfer, the delete and the wallet guard all walk, and it is read from
-- the catalog every time so it cannot go stale.
CREATE OR REPLACE FUNCTION public.actor_owner_columns()
RETURNS TABLE (table_name text, column_name text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT tc.table_name::text, kcu.column_name::text
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = tc.constraint_name
   AND kcu.table_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND ccu.table_schema = 'public'
    AND ccu.table_name = 'actors'
    AND ccu.column_name = 'id'
    -- The placeholder's own back-reference is not ownership.
    AND NOT (tc.table_name = 'profile_claims' AND kcu.column_name = 'actor_id');
$$;

-- "Which actor owns the row with this id?" — probes every actor-owning table
-- for a primary key match. Entity ids are UUIDs, so at most one table answers.
-- Used by the wallet guard for entity_wallets, whose entity_type → table map
-- lives in the application registry and must not be duplicated here.
CREATE OR REPLACE FUNCTION public.owner_actor_of(p_entity_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  r record;
  v_actor uuid;
BEGIN
  FOR r IN SELECT * FROM public.actor_owner_columns() LOOP
    -- Only tables that have an `id` column can be entities.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.table_name AND column_name = 'id'
    ) THEN
      EXECUTE format('SELECT %I FROM public.%I WHERE id = $1', r.column_name, r.table_name)
        INTO v_actor USING p_entity_id;
      IF v_actor IS NOT NULL THEN
        RETURN v_actor;
      END IF;
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.actor_is_unclaimed(p_actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.actors WHERE id = p_actor AND actor_type = 'unclaimed'
  );
$$;

------------------------------------------------------------------------------
-- 3. Nothing an unclaimed actor owns can have a wallet.
------------------------------------------------------------------------------

-- One trigger function, three tables, three ownership shapes:
--   wallets.project_id        → projects.actor_id
--   group_wallets.group_id    → actors.group_id
--   entity_wallets.entity_id  → owner_actor_of()
-- wallets.profile_id needs no guard: a profile is a real account by
-- construction (profiles.id → auth.users), never a placeholder.
CREATE OR REPLACE FUNCTION public.refuse_wallet_for_unclaimed_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF TG_TABLE_NAME = 'wallets' THEN
    IF NEW.project_id IS NOT NULL THEN
      SELECT actor_id INTO v_owner FROM public.projects WHERE id = NEW.project_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'group_wallets' THEN
    SELECT id INTO v_owner FROM public.actors
     WHERE group_id = NEW.group_id AND actor_type = 'group';
  ELSIF TG_TABLE_NAME = 'entity_wallets' THEN
    v_owner := public.owner_actor_of(NEW.entity_id);
  END IF;

  IF v_owner IS NOT NULL AND public.actor_is_unclaimed(v_owner) THEN
    RAISE EXCEPTION
      'This belongs to someone who has not accepted it yet; it cannot receive funds until they do.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallets_refuse_unclaimed_owner ON public.wallets;
CREATE TRIGGER wallets_refuse_unclaimed_owner
  BEFORE INSERT OR UPDATE OF project_id ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.refuse_wallet_for_unclaimed_owner();

DROP TRIGGER IF EXISTS group_wallets_refuse_unclaimed_owner ON public.group_wallets;
CREATE TRIGGER group_wallets_refuse_unclaimed_owner
  BEFORE INSERT OR UPDATE OF group_id ON public.group_wallets
  FOR EACH ROW EXECUTE FUNCTION public.refuse_wallet_for_unclaimed_owner();

DROP TRIGGER IF EXISTS entity_wallets_refuse_unclaimed_owner ON public.entity_wallets;
CREATE TRIGGER entity_wallets_refuse_unclaimed_owner
  BEFORE INSERT OR UPDATE OF entity_id ON public.entity_wallets
  FOR EACH ROW EXECUTE FUNCTION public.refuse_wallet_for_unclaimed_owner();

------------------------------------------------------------------------------
-- 4. Claiming: one transaction, ownership moves, the placeholder disappears.
------------------------------------------------------------------------------

-- Returns the claimer's actor id. Does NOT touch profiles.username: the
-- reserved-handle list (RESERVED_USERNAMES) lives in the application and is
-- the one source of truth for it, so the application allocates the handle
-- afterwards with the helper that already consults that list. The slug is
-- returned for that purpose via the claim row's placeholder data.
--
-- SECURITY DEFINER: the caller is the claimer, who does not (yet) own any of
-- the rows being moved and could not pass their RLS. The function takes only
-- ids, verifies the claim is pending and points at an unclaimed actor, and
-- refuses otherwise — it cannot be pointed at an arbitrary actor.
CREATE OR REPLACE FUNCTION public.claim_placeholder_actor(p_claim_id uuid, p_claimer uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placeholder uuid;
  v_status text;
  v_claimer_actor uuid;
  r record;
BEGIN
  SELECT actor_id, status INTO v_placeholder, v_status
    FROM public.profile_claims WHERE id = p_claim_id FOR UPDATE;

  IF v_placeholder IS NULL THEN
    RAISE EXCEPTION 'claim % has no placeholder actor', p_claim_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'claim % is %, not pending', p_claim_id, v_status USING ERRCODE = 'check_violation';
  END IF;
  IF NOT public.actor_is_unclaimed(v_placeholder) THEN
    RAISE EXCEPTION 'actor % is not unclaimed', v_placeholder USING ERRCODE = 'check_violation';
  END IF;

  -- Find or create the claimer's own actor.
  SELECT id INTO v_claimer_actor FROM public.actors
   WHERE user_id = p_claimer AND actor_type = 'user';
  IF v_claimer_actor IS NULL THEN
    INSERT INTO public.actors (actor_type, user_id) VALUES ('user', p_claimer)
      RETURNING id INTO v_claimer_actor;
  END IF;

  -- Move everything. One UPDATE per owning column, from the catalog.
  FOR r IN SELECT * FROM public.actor_owner_columns() LOOP
    EXECUTE format('UPDATE public.%I SET %I = $1 WHERE %I = $2',
                   r.table_name, r.column_name, r.column_name)
      USING v_claimer_actor, v_placeholder;
  END LOOP;

  -- Record, then remove the placeholder. Its slug/display_name are still on
  -- the claim's draft for the application to finish the profile with.
  UPDATE public.profile_claims
     SET status = 'claimed', claimed_by = p_claimer, claimed_at = now(), actor_id = NULL
   WHERE id = p_claim_id;

  DELETE FROM public.actors WHERE id = v_placeholder;

  RETURN v_claimer_actor;
END;
$$;

------------------------------------------------------------------------------
-- 5. Declining: her name comes down, and nothing is left ownerless.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.decline_placeholder_actor(p_claim_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placeholder uuid;
  v_status text;
  r record;
BEGIN
  SELECT actor_id, status INTO v_placeholder, v_status
    FROM public.profile_claims WHERE id = p_claim_id FOR UPDATE;

  IF v_status = 'declined' THEN
    RETURN;  -- saying no twice is not an error
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'claim % is %, not pending', p_claim_id, v_status USING ERRCODE = 'check_violation';
  END IF;

  IF v_placeholder IS NOT NULL AND public.actor_is_unclaimed(v_placeholder) THEN
    -- Owned rows first — 10 of the 25 owner FKs are ON DELETE SET NULL, and an
    -- ownerless fundable row is worse than the page it replaced.
    FOR r IN SELECT * FROM public.actor_owner_columns() LOOP
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.table_name, r.column_name)
        USING v_placeholder;
    END LOOP;
    DELETE FROM public.actors WHERE id = v_placeholder;
  END IF;

  UPDATE public.profile_claims
     SET status = 'declined', declined_at = now(), actor_id = NULL
   WHERE id = p_claim_id;
END;
$$;

-- Service role only, like the rest of the claims surface. The routes that call
-- these hold the token or are the creator; nothing here is reachable from a
-- browser session directly.
REVOKE ALL ON FUNCTION public.claim_placeholder_actor(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decline_placeholder_actor(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_placeholder_actor(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decline_placeholder_actor(uuid) TO service_role;
