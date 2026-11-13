-- A task is seen and changed by the person who made it and by the person it
-- was asked of, not by every account on the platform.
--
-- The task tables came from a single-team chores board. Their policies let any
-- signed-in account read and update every non-archived task, read every
-- completion and attention flag, and read every request sent to "everyone".
-- On orangecat.ch a brand-new account opened /dashboard/tasks and saw another
-- account's task with a working "complete" control (UX/UI audit 2026-11-12,
-- owner decision 1). The request route also notified every account on the
-- platform; that is removed in the app in the same change.
--
-- Who sees a task now:
--   - its creator, archived or not;
--   - a person a request on it names, while it is not archived.
-- Completions, attention flags and requests follow the task. A completion or
-- a flag can be added only to a task the person can see.
--
-- The two helpers are SECURITY DEFINER so the policies on tasks and on
-- task_requests can ask about each other without recursing through RLS.
--
-- Rollback: recreate the baseline policies from
-- 20240101000001_baseline_public_schema.sql (tasks_select, tasks_update and the
-- "Staff can …" / "Users can … requests" policies on task_attention_flags,
-- task_completions and task_requests), then
-- DROP FUNCTION public.task_asked_of_me(uuid), public.task_visible_to_me(uuid).

CREATE OR REPLACE FUNCTION public.task_asked_of_me(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.task_requests r
     WHERE r.task_id = p_task_id
       AND r.requested_user_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.task_visible_to_me(p_task_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.tasks t
     WHERE t.id = p_task_id
       AND (
         t.created_by = (SELECT auth.uid())
         OR (NOT t.is_archived AND public.task_asked_of_me(t.id))
       )
  );
$$;

REVOKE ALL ON FUNCTION public.task_asked_of_me(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.task_visible_to_me(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.task_asked_of_me(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.task_visible_to_me(uuid) TO authenticated, service_role;

-- tasks
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT USING (
  created_by = (SELECT auth.uid())
  OR (NOT is_archived AND public.task_asked_of_me(id))
);

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks FOR UPDATE USING (
  created_by = (SELECT auth.uid())
  OR (NOT is_archived AND public.task_asked_of_me(id))
);

-- task_completions
DROP POLICY IF EXISTS "Staff can view completions" ON public.task_completions;
DROP POLICY IF EXISTS "People who can see the task can view completions" ON public.task_completions;
CREATE POLICY "People who can see the task can view completions" ON public.task_completions
  FOR SELECT USING (public.task_visible_to_me(task_id));

DROP POLICY IF EXISTS "Staff can create completions" ON public.task_completions;
DROP POLICY IF EXISTS "People who can see the task can complete it" ON public.task_completions;
CREATE POLICY "People who can see the task can complete it" ON public.task_completions
  FOR INSERT WITH CHECK (
    completed_by = (SELECT auth.uid()) AND public.task_visible_to_me(task_id)
  );

-- task_attention_flags
DROP POLICY IF EXISTS "Staff can view attention flags" ON public.task_attention_flags;
DROP POLICY IF EXISTS "People who can see the task can view attention flags" ON public.task_attention_flags;
CREATE POLICY "People who can see the task can view attention flags" ON public.task_attention_flags
  FOR SELECT USING (public.task_visible_to_me(task_id));

DROP POLICY IF EXISTS "Staff can create attention flags" ON public.task_attention_flags;
DROP POLICY IF EXISTS "People who can see the task can flag it" ON public.task_attention_flags;
CREATE POLICY "People who can see the task can flag it" ON public.task_attention_flags
  FOR INSERT WITH CHECK (
    flagged_by = (SELECT auth.uid()) AND public.task_visible_to_me(task_id)
  );

DROP POLICY IF EXISTS "Staff can update attention flags" ON public.task_attention_flags;
DROP POLICY IF EXISTS "People who can see the task can update attention flags" ON public.task_attention_flags;
CREATE POLICY "People who can see the task can update attention flags" ON public.task_attention_flags
  FOR UPDATE USING (public.task_visible_to_me(task_id));

-- task_requests: the person who asked, the person asked, and the task's creator.
-- A request with no one named is no longer readable by everyone.
DROP POLICY IF EXISTS "Users can view their requests" ON public.task_requests;
CREATE POLICY "Users can view their requests" ON public.task_requests FOR SELECT USING (
  requested_by = (SELECT auth.uid())
  OR requested_user_id = (SELECT auth.uid())
  OR public.task_visible_to_me(task_id)
);

DROP POLICY IF EXISTS "Staff can create requests" ON public.task_requests;
DROP POLICY IF EXISTS "People who can see the task can ask someone" ON public.task_requests;
CREATE POLICY "People who can see the task can ask someone" ON public.task_requests
  FOR INSERT WITH CHECK (
    requested_by = (SELECT auth.uid())
    AND requested_user_id IS NOT NULL
    AND public.task_visible_to_me(task_id)
  );

DROP POLICY IF EXISTS "Users can respond to requests" ON public.task_requests;
CREATE POLICY "Users can respond to requests" ON public.task_requests FOR UPDATE USING (
  requested_user_id = (SELECT auth.uid())
);
