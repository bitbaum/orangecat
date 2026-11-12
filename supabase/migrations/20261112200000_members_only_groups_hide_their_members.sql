-- A "Members only" group shows its members, events and proposals to its
-- members, not to everyone.
--
-- The create form promises "Members Only - Only members can see content" and
-- the settings page "Listed, but only members see content". The row policies
-- asked only whether the group was listed (groups.is_public). On 2026-11-12 a
-- listed members-only group handed its member list to anyone through the REST
-- API and its own page, signed in or not.
--
-- The rule, the same one as src/services/groups/utils/visibility.ts: someone
-- outside a group sees its content only when the group is listed AND its
-- visibility is 'public'. Members keep every row (is_group_member, or their
-- own membership row), and an unknown visibility counts as closed.
--
-- Every table a group page reads, checked against that rule:
--   group_members      open to anyone when the group was listed; closed here
--   group_events       an event is public by default (is_public DEFAULT true),
--                      so the events of a listed members-only group were open;
--                      closed here
--   group_proposals    a proposal marked public was open whatever the group's
--                      visibility; closed here
--   group_event_rsvps  its policy reads group_events under the caller's own
--                      row policies, so it closes with group_events
--   group_wallets, group_activities, group_features, group_votes
--                      already members-only; unchanged
--   get_user_groups()  SECURITY DEFINER and executable by anon: given anyone's
--                      user id it listed every group they belong to, private
--                      and members-only ones included, past every policy
--                      above. Nothing in the app calls it; only service_role
--                      keeps it.
--
-- Rollback: recreate the four policies as 20240101000001 wrote them (without
-- the visibility test) and grant EXECUTE on get_user_groups back to anon and
-- authenticated. That reopens the leak.

DROP POLICY IF EXISTS group_members_select_anon ON public.group_members;
CREATE POLICY group_members_select_anon ON public.group_members
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND g.is_public = true
        AND g.visibility = 'public'
    )
  );

DROP POLICY IF EXISTS group_members_select_auth ON public.group_members;
CREATE POLICY group_members_select_auth ON public.group_members
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_members.group_id
        AND g.is_public = true
        AND g.visibility = 'public'
    )
    OR public.is_group_member(group_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Public events are viewable" ON public.group_events;
CREATE POLICY "Public events are viewable" ON public.group_events
  FOR SELECT
  USING (
    (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_events.group_id
          AND g.is_public = true
          AND g.visibility = 'public'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.group_members gm
      WHERE gm.group_id = group_events.group_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Public can view public proposals" ON public.group_proposals;
CREATE POLICY "Public can view public proposals" ON public.group_proposals
  FOR SELECT
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.groups g
      WHERE g.id = group_proposals.group_id
        AND g.is_public = true
        AND g.visibility = 'public'
    )
  );

REVOKE EXECUTE ON FUNCTION public.get_user_groups(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_groups(uuid) TO service_role;
