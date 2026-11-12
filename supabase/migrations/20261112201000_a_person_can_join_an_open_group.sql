-- A person can join an open group by themselves.
--
-- Every public group showed a "Join Group" button, and pressing it signed in
-- inserted a group_members row as the joiner. group_members' own insert policy
-- (group_members_insert_auth, 20240101000001) allows only a group's creator
-- adding themselves, or a founder or admin adding someone. Nobody else could
-- ever join a group: the button answered with Postgres' row-level-security
-- text. POST /api/groups/<slug>/members made the same insert.
--
-- Joining goes through this function instead, in the shape of
-- accept_group_invitation (20261007171000). It runs as definer, so the policy
-- stays as it is for every other insert, and it decides one thing: may the
-- caller add THEMSELVES to THIS group as a plain member.
--
-- The rule, the same one as src/services/groups/utils/joining.ts: a group is
-- open to join when it is listed (is_public) AND its visibility is 'public'.
-- "Members only", "Private" and unlisted (invite-only) groups take members by
-- invitation; an unknown visibility counts as closed. A missing group and a
-- closed one get the same answer, so an id reveals nothing. Someone already
-- in the group is told so; the row they have, founder or admin included, is
-- never touched.
--
-- Rollback: DROP FUNCTION public.join_public_group(uuid). Nothing else
-- changes, so nothing else needs undoing.

CREATE OR REPLACE FUNCTION public.join_public_group(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  g RECORD;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sign in to join this group');
  END IF;

  -- FOR SHARE: the group cannot be closed or deleted between this check and
  -- the insert below.
  SELECT id, is_public, visibility INTO g
    FROM groups
   WHERE id = p_group_id
     FOR SHARE;

  IF NOT FOUND OR g.is_public IS NOT TRUE OR g.visibility IS DISTINCT FROM 'public' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This group takes new members by invitation only'
    );
  END IF;

  -- The unique (group_id, user_id) key decides "already a member", so two
  -- taps at once add one row and the second is told, not given an error.
  INSERT INTO group_members (group_id, user_id, role, invited_by)
  VALUES (p_group_id, v_user, 'member', NULL)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this group');
  END IF;

  RETURN jsonb_build_object('success', true, 'group_id', p_group_id);
END;
$$;

-- Signed-in people only. Supabase's default privileges grant every new public
-- function to anon and service_role by name, so revoking from PUBLIC alone
-- would leave both. service_role has no auth.uid() and would only ever be
-- refused, so it is not granted either.
REVOKE ALL ON FUNCTION public.join_public_group(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.join_public_group(uuid) TO authenticated;
