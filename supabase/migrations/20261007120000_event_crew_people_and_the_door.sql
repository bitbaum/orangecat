-- A crew role holds people, and the people on the door can check guests in.
--
-- event_roles said "2× Bartender" but never who: nobody could be on a crew,
-- and the only account that could check tickets at the door was the
-- organizer's — so the bartender on the door needed the organizer's phone.
--
-- 1. event_roles.assignee_user_ids — the people in the role, at most its
--    head-count. Written by the organizer (the existing owner-only policy).
-- 2. event_roles.can_check_in — the role works the door (Door, Security;
--    src/config/event-crew.ts decides which presets set it).
-- 3. can_check_in_at(event, user): the organizer, or someone in a
--    can_check_in role at that event. check_in_ticket and the guest-list read
--    use it instead of "organizer only".
--
-- Rollback: restore check_in_ticket and event_attendees_select from
--   20261005100000; DROP FUNCTION public.can_check_in_at(uuid, uuid);
--   ALTER TABLE public.event_roles DROP COLUMN assignee_user_ids,
--     DROP COLUMN can_check_in;

ALTER TABLE public.event_roles
  ADD COLUMN IF NOT EXISTS assignee_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
  ADD COLUMN IF NOT EXISTS can_check_in boolean DEFAULT false NOT NULL;

-- migration-safety: contract-ok the dropped constraint is this migration's own, made re-runnable
ALTER TABLE public.event_roles DROP CONSTRAINT IF EXISTS event_roles_assignees_fit;
ALTER TABLE public.event_roles ADD CONSTRAINT event_roles_assignees_fit
  CHECK (cardinality(assignee_user_ids) <= quantity);

CREATE INDEX IF NOT EXISTS event_roles_assignees_idx ON public.event_roles USING gin (assignee_user_ids);

CREATE OR REPLACE FUNCTION public.can_check_in_at(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p_user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.user_id = p_user_id)
    OR EXISTS (
      SELECT 1 FROM public.event_roles r
      WHERE r.event_id = p_event_id AND r.can_check_in AND p_user_id = ANY (r.assignee_user_ids)
    )
  );
$$;

REVOKE ALL ON FUNCTION public.can_check_in_at(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_check_in_at(uuid, uuid) TO authenticated, service_role;

-- The door sees the guest list too (it has to find a guest by name).
DROP POLICY IF EXISTS event_attendees_select ON public.event_attendees;
CREATE POLICY event_attendees_select ON public.event_attendees FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR public.can_check_in_at(event_id, (SELECT auth.uid()))
);

CREATE OR REPLACE FUNCTION public.check_in_ticket(p_event_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.event_attendees;
BEGIN
  IF NOT public.can_check_in_at(p_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the organizer or the door crew can check people in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.event_attendees
  WHERE event_id = p_event_id AND ticket_code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('result', 'cancelled', 'user_id', v_row.user_id);
  END IF;
  IF v_row.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'result', 'already', 'user_id', v_row.user_id,
      'ticket_count', v_row.ticket_count, 'checked_in_at', v_row.checked_in_at
    );
  END IF;

  UPDATE public.event_attendees
  SET checked_in_at = now(), status = 'attended'
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'result', 'checked_in', 'user_id', v_row.user_id,
    'ticket_count', v_row.ticket_count, 'checked_in_at', v_row.checked_in_at
  );
END;
$$;
