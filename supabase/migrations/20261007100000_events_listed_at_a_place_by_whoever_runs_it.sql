-- An event is listed at a place only by whoever runs that place.
--
-- A place (a bar, a studio, a hall) is an asset, and an event names where it
-- happens through events.asset_id; the asset page lists those events as
-- "Happening here" (#1237). Nothing checked who set asset_id, so anyone could
-- put their event onto a bar's page.
--
-- Who runs a place follows its actor, like every other right in the app
-- (src/domain/profileClaims/stewardship.ts):
--   * a person's asset      → that person
--   * an organization's     → its members
--   * a placeholder's       → the steward who set it up, while the claim is
--                             pending (after the claim, the owner)
--   * no actor (legacy row) → owner_id
-- owner_id alone is not enough: a claim re-points actor_id and leaves
-- owner_id with the steward.
--
-- Enforced by trigger, so the form, the API and the Cat meet one rule. A write
-- with no signed-in user (service role, migrations) is a system write and
-- passes; an UPDATE that leaves asset_id unchanged is never re-checked, so
-- events already listed somewhere keep working.
--
-- Rollback: DROP TRIGGER events_asset_requires_manager ON public.events;
--           DROP FUNCTION public.events_asset_requires_manager();
--           DROP FUNCTION public.places_i_can_list_events_at();
--           DROP FUNCTION public.can_list_events_at(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_list_events_at(p_asset_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assets a
    LEFT JOIN public.actors ac ON ac.id = a.actor_id
    WHERE a.id = p_asset_id
      AND (
        (a.actor_id IS NULL AND a.owner_id = p_user_id)
        OR ac.user_id = p_user_id
        OR (ac.group_id IS NOT NULL AND public.is_group_member(ac.group_id, p_user_id))
        OR (
          ac.actor_type = 'unclaimed'
          AND EXISTS (
            SELECT 1 FROM public.profile_claims c
            WHERE c.id = ac.claim_id AND c.status = 'pending' AND c.created_by = p_user_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_list_events_at(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_list_events_at(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.events_asset_requires_manager()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.asset_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.asset_id IS DISTINCT FROM OLD.asset_id)
     AND auth.uid() IS NOT NULL
     AND NOT public.can_list_events_at(NEW.asset_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only whoever runs a place can list events there'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_asset_requires_manager ON public.events;
CREATE TRIGGER events_asset_requires_manager
  BEFORE INSERT OR UPDATE OF asset_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_asset_requires_manager();

-- The places the signed-in person can list events at — the same rule, as a
-- list: the event form's venue picker and the Cat's "at Espresso Bar" both
-- read it, so neither can offer a place the trigger would then refuse.
CREATE OR REPLACE FUNCTION public.places_i_can_list_events_at()
RETURNS TABLE (id uuid, title text, location text, status text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.id, a.title, a.location, a.status
  FROM public.assets a
  WHERE auth.uid() IS NOT NULL
    AND a.status <> 'archived'
    AND public.can_list_events_at(a.id, auth.uid())
  ORDER BY a.title;
$$;

REVOKE ALL ON FUNCTION public.places_i_can_list_events_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.places_i_can_list_events_at() TO authenticated, service_role;
