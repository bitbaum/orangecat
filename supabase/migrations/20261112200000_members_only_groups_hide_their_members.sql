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
--   is_group_member(), get_user_group_role()
--                      SECURITY DEFINER and executable by anon, and they
--                      answered for ANY user id. Profiles are world-readable,
--                      so every user id is public, and so is the id of a
--                      listed group: looping get_user_group_role over
--                      /rest/v1/profiles rebuilt a members-only group's
--                      member list with roles. EXECUTE cannot simply be
--                      revoked: the row policies on groups and group_members
--                      call both functions as the caller (anon included). So
--                      the caller's role decides: anon and authenticated get
--                      an answer about themselves (auth.uid()) only, false /
--                      NULL for anyone else. Every policy passes auth.uid(),
--                      and so does can_list_events_at's only real caller (the
--                      events trigger and places_i_can_list_events_at).
--                      service_role, and SQL run without a role (migrations,
--                      the box), are unchanged.
--   groups.visibility  nullable, and a NULL counted as closed above. The
--                      group page already labels a NULL "Private" and the
--                      settings form preselects "Members only" for it; no
--                      screen calls it public. Backfilled to what the settings
--                      form shows (listed -> members_only, unlisted ->
--                      private), so no outsider's access changes, then made
--                      NOT NULL: every writer already sets it, and the column
--                      keeps DEFAULT 'public'.
--
-- Not changed here: the groups row itself (description, tags, created_by,
-- bitcoin_address, lightning_address) of a listed group stays readable over
-- REST by anyone, as before. The page shows an outsider only the name and the
-- label; hiding the columns needs a restricted listing (a view or column
-- grants) and every select('*') on groups rewritten, so it is its own change.
--
-- Rollback: recreate the four policies as 20240101000001 wrote them (without
-- the visibility test), grant EXECUTE on get_user_groups back to anon and
-- authenticated, recreate is_group_member and get_user_group_role as
-- 20240101000001 wrote them, and DROP NOT NULL on groups.visibility. That
-- reopens the leak.

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

CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(
    (
      p_user_id = (SELECT auth.uid())
      OR COALESCE(current_setting('role', true), 'none') NOT IN ('anon', 'authenticated')
    )
    AND EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_id = p_group_id
        AND user_id = p_user_id
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_group_role(p_group_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT role FROM public.group_members
  WHERE group_id = p_group_id
    AND user_id = p_user_id
    AND (
      p_user_id = (SELECT auth.uid())
      OR COALESCE(current_setting('role', true), 'none') NOT IN ('anon', 'authenticated')
    )
  LIMIT 1;
$$;

UPDATE public.groups
SET visibility = CASE WHEN is_public THEN 'members_only' ELSE 'private' END
WHERE visibility IS NULL;

ALTER TABLE public.groups ALTER COLUMN visibility SET NOT NULL;
