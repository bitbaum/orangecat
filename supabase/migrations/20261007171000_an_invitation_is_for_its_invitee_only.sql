-- A group invitation can be answered by the person it names, and nobody else.
--
-- Two holes, one path:
--   1. "Token invitations are viewable" let ANY caller (anon included) read
--      every pending link invitation — its id, group and role.
--   2. accept_group_invitation is SECURITY DEFINER, granted to anon, and
--      skipped its owner check when user_id IS NULL (a link invitation). So
--      the id from (1) let anyone call the function and join the group, as
--      whatever role the invitation carried.
--
-- No screen ever minted or redeemed link invitations (the join page they
-- pointed at, /groups/join/<token>, was never built), so nothing legitimate
-- depends on either. The functions now require the invitation to name the
-- caller, pin search_path, and are callable only by signed-in users. They
-- also become the one way to answer an invitation: the API answered by
-- inserting into group_members as the invitee, which group_members' own
-- policy forbids, so accepting could never have succeeded.

DROP POLICY IF EXISTS "Token invitations are viewable" ON public.group_invitations;

CREATE OR REPLACE FUNCTION public.accept_group_invitation(invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM group_invitations WHERE id = invitation_id FOR UPDATE;

  IF NOT FOUND OR inv.user_id IS NULL OR inv.user_id <> auth.uid() THEN
    -- One answer for "missing" and "not yours": the id reveals nothing.
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been answered');
  END IF;

  IF inv.expires_at < now() THEN
    UPDATE group_invitations SET status = 'expired' WHERE id = invitation_id;
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has expired');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM group_members WHERE group_id = inv.group_id AND user_id = inv.user_id
  ) THEN
    INSERT INTO group_members (group_id, user_id, role, invited_by)
    VALUES (inv.group_id, inv.user_id, inv.role, inv.invited_by);
  END IF;

  UPDATE group_invitations
     SET status = 'accepted', responded_at = now()
   WHERE id = invitation_id;

  RETURN jsonb_build_object('success', true, 'group_id', inv.group_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_group_invitation(invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM group_invitations WHERE id = invitation_id FOR UPDATE;

  IF NOT FOUND OR inv.user_id IS NULL OR inv.user_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;

  IF inv.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been answered');
  END IF;

  UPDATE group_invitations
     SET status = 'declined', responded_at = now()
   WHERE id = invitation_id;

  RETURN jsonb_build_object('success', true, 'group_id', inv.group_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_group_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_group_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_group_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decline_group_invitation(uuid) TO authenticated, service_role;

-- The invitee is told. Invitations were inserted and nothing else happened:
-- no notification type existed for them, so nobody ever learned they had one.
-- migration-safety: contract-ok widen-only CHECK swap — the new list is a
-- strict superset of the old one, so every insert the previous release makes
-- still passes; rollback-safe by construction.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'follow','payment','project_funded','message','comment','like','mention',
    'system','task_attention','task_request','task_completed','task_broadcast',
    'match','tip_dead_end','booking_request','booking_update','deal_review',
    'ticket','crew','group_invite'
  ]::text[])
);
