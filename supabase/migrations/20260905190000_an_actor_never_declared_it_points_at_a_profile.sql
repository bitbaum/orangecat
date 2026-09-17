-- actors.user_id is a reference to profiles that was never declared as one.
--
-- SYMPTOM
-- Every request to /api/messages/actors logged:
--   PGRST200 — Could not find a relationship between 'actors' and 'user_id'
--              in the schema cache
--              hint: "Perhaps you meant 'user_services' instead of 'user_id'"
-- fetchMessagingActors is best-effort: it logs the error and skips the row.
-- So the personal actor was silently absent and nobody could send a message
-- AS THEMSELVES — the failure looked like an empty picker, not an error.
--
-- CAUSE
-- The table declares actors_group_id_fkey (group_id -> groups) but never the
-- matching constraint on the other branch of the same check constraint:
--   actor_type = 'user'  AND user_id IS NOT NULL AND group_id IS NULL
--   actor_type = 'group' AND group_id IS NOT NULL AND user_id IS NULL
-- The check constraint already treats user_id as the user-actor identity;
-- only the foreign key was missing. PostgREST resolves embeds from declared
-- foreign keys, so `profiles:user_id (...)` had nothing to resolve against.
--
-- Declaring it is the honest fix: the relationship exists in the data (74 of
-- 74 user actors resolve to a live profile, 0 orphans as of 2026-09-05) and in
-- every query that reads the column. ON DELETE CASCADE matches the group
-- branch and profiles' own cascade behaviour — deleting a profile should take
-- its actor with it, exactly as deleting a group already does.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'actors_user_id_fkey'
      AND conrelid = 'public.actors'::regclass
  ) THEN
    -- Defensive: refuse to leave orphans behind rather than failing the whole
    -- deploy on one stale row. There are none today; if a future row points at
    -- a deleted profile, null it out (the check constraint would reject a
    -- 'user' actor with a null user_id, so drop those rows instead).
    DELETE FROM public.actors a
    WHERE a.user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = a.user_id);

    ALTER TABLE public.actors
      ADD CONSTRAINT actors_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index the column unconditionally. The existing idx_actors_user_id is
-- partial (WHERE actor_type = 'user'), which serves the lookup but not the
-- cascade check the new constraint performs on profile deletion.
CREATE INDEX IF NOT EXISTS idx_actors_user_id_all ON public.actors (user_id);

-- PostgREST caches the schema; without this the embed keeps failing until the
-- container restarts.
NOTIFY pgrst, 'reload schema';
