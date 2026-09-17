-- Ask the Cat on a private post and nobody can read the answer, including you.
--
-- The Cat replies with the PARENT'S visibility, which is right: a private
-- thread should stay private. But the reply is authored by the CAT, and the
-- rule for a private event is `actor_id = auth.uid()`. So the answer to your
-- own question is visible to exactly one account, and it is not yours.
--
-- Verified in production 2026-08-28 on post 5c3ad8ef. Three replies exist:
--
--   425a3d00  actor=cat       visibility=private   "Each person would owe 1,400 CHF"
--   52cc045c  actor=mao       visibility=private   "@cat what is this"
--   3f9372ba  actor=mao       visibility=public    "awdaw"
--
-- The thread rendered two of them. The Cat's answer — the one that was asked
-- for — was filtered out by RLS for the person who asked. Nothing errors; the
-- reply simply is not there, which reads as the Cat having ignored you.
--
-- THE RULE ADDED: a private event is also visible to the author of the private
-- post it replies to.
--
-- Scoped to a private PARENT deliberately. The looser version — "the parent's
-- author can see any private reply" — would be a real privacy regression on
-- PUBLIC posts, where anyone can reply and someone may deliberately write a
-- private note to themselves attached to a stranger's post. That note must stay
-- theirs.
--
-- Restricted to a private parent, the set of possible repliers is closed: to
-- reply to a private post you must first be able to READ it, and the existing
-- policy allows only its author. The one other writer is the Cat, whose worker
-- uses the service role and bypasses RLS by design. So this exposes your own
-- replies and the Cat's answers on your own private posts, and nothing else.
--
-- Deliberately not keyed on the Cat's id or on `metadata->>'is_cat_reply'`:
-- either would put a second definition of who the Cat is into SQL, to drift
-- against config/cat-identity.ts. The property that matters is structural — it
-- is a reply to a private post of yours — and that is what is expressed.

-- The check has to run OUTSIDE row-level security. Asking about
-- `timeline_events` from inside a policy on `timeline_events` re-enters the
-- same policy: "infinite recursion detected in policy for relation
-- timeline_events". A SECURITY DEFINER function reads the parent row directly,
-- so the policy asks a question instead of running a subquery.
--
-- It answers only "does the caller own this private parent", never returning
-- any row content, so it cannot be used to read a post you may not see.
CREATE OR REPLACE FUNCTION public.owns_private_parent_event(p_parent_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.timeline_events parent
    WHERE parent.id = p_parent_id
      AND parent.visibility = 'private'
      AND parent.actor_id = (SELECT auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.owns_private_parent_event(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_private_parent_event(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.owns_private_parent_event(uuid) IS
  'Does the current user own this private post? Used by the timeline_events SELECT policy to let you read replies on your own private posts (chiefly the Cat''s answers) without the policy recursing into its own table.';

-- A gate for the nightly data-invariant run.
--
-- The failure this migration fixes is SILENT: the Cat answers, the row exists,
-- and the person who asked simply sees nothing. Whoever rewrites this policy
-- next will not get an error if they drop the clause — they will get a feature
-- that quietly stops working again. So the check is on the policy itself.
--
-- Returns a boolean rather than the policy text: what the timeline is visible
-- to is not something to hand out over PostgREST.
CREATE OR REPLACE FUNCTION public.timeline_policy_allows_own_thread()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'timeline_events'
      AND cmd = 'SELECT'
      AND qual LIKE '%owns_private_parent_event%'
  );
$$;

REVOKE ALL ON FUNCTION public.timeline_policy_allows_own_thread() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.timeline_policy_allows_own_thread() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.timeline_policy_allows_own_thread() TO service_role;

COMMENT ON FUNCTION public.timeline_policy_allows_own_thread() IS
  'Whether the timeline SELECT policy still lets you read replies on your own private posts. False means the Cat answers your private questions where you cannot see them.';

DROP POLICY IF EXISTS "Timeline events viewable by visibility rules" ON public.timeline_events;

CREATE POLICY "Timeline events viewable by visibility rules"
  ON public.timeline_events
  FOR SELECT
  USING (
    (NOT is_deleted)
    AND (
      visibility = 'public'
      OR (
        visibility = 'followers'
        AND EXISTS (
          SELECT 1 FROM follows
          WHERE follows.follower_id = (SELECT auth.uid())
            AND follows.following_id = timeline_events.actor_id
        )
      )
      OR (visibility = 'private' AND actor_id = (SELECT auth.uid()))
      -- New: a reply on your own private post. Without this the Cat's answer
      -- to your question is readable only by the Cat.
      OR (
        visibility = 'private'
        AND parent_event_id IS NOT NULL
        AND public.owns_private_parent_event(parent_event_id)
      )
    )
  );
