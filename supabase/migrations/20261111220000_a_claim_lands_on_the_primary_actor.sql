-- A claim lands on the claimer's PRIMARY actor.
--
-- claim_placeholder_actor found the claimer's own actor with
--   SELECT id INTO v_claimer_actor ... WHERE user_id = p_claimer AND actor_type = 'user';
-- and no ORDER BY. Nothing makes a user's actor unique (one account had six on
-- 2026-09-18), and plpgsql's SELECT INTO takes whichever row comes first, so a
-- person with duplicates could have a whole studio moved onto an actor that
-- every other reader ignores: lookupUserActor and primary_user_actor both take
-- the OLDEST. The page would be claimed and then appear empty.
--
-- Same body as 20260907140000, with the one lookup ordered by that rule.

-- migration-safety: contract-ok CREATE OR REPLACE with an identical signature
-- and return type; the previous release calls it the same way.

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

  -- Find or create the claimer's own actor: the oldest, as everywhere else.
  SELECT id INTO v_claimer_actor FROM public.actors
   WHERE user_id = p_claimer AND actor_type = 'user'
   ORDER BY created_at ASC, id ASC
   LIMIT 1;
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

REVOKE ALL ON FUNCTION public.claim_placeholder_actor(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_placeholder_actor(uuid, uuid) TO service_role;
