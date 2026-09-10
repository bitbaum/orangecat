-- ADR-0005 D4: a page owned by an unclaimed actor is public — visible on the
-- platform and by link, with a band saying whose it is. The actors SELECT
-- policy predates placeholders and admits only 'user' and 'group' rows, so
-- every reader that goes through RLS — the visitor's project page, the
-- /profiles/<slug> fallback, the steward's own session — saw NOTHING: no band,
-- no slug page, and the FleetCrown handoff named the steward as the client.
-- Found 2026-09-10 by walking the first placeholder-owned page in prod; the
-- form path had never produced one before that day (its project was owned by
-- the steward), so no surface had ever rendered a real placeholder.
--
-- The band is the safeguard here, not the policy: a placeholder can own a
-- page and cannot receive money (wallet guard trigger, no profile row).
DROP POLICY IF EXISTS "Actors are viewable by appropriate users" ON public.actors;
CREATE POLICY "Actors are viewable by appropriate users" ON public.actors
  FOR SELECT USING (
    actor_type = 'user'
    OR actor_type = 'unclaimed'
    OR (
      actor_type = 'group'
      AND (
        group_id IN (SELECT groups.id FROM public.groups WHERE groups.is_public = true)
        OR group_id IN (
          SELECT group_members.group_id FROM public.group_members
          WHERE group_members.user_id = (SELECT auth.uid())
        )
      )
    )
  );
