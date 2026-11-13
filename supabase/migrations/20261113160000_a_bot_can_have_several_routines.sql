-- A bot could hold one routine per person: a morning brief OR a site check,
-- never both. The pair (user_id, assistant_id) stops being unique, so a bot
-- can be asked several things at their own times. How many is the app's rule
-- (ROUTINES_PER_BOT in services/companions/routines-store.ts), not the
-- table's. Rows are untouched; the runner already reads one row per routine.
--
-- The constraint is found by its columns, not by a guessed name.

DO $$
DECLARE
  found TEXT;
BEGIN
  SELECT c.conname INTO found
  FROM pg_constraint c
  WHERE c.conrelid = 'public.companion_routines'::regclass
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname::text ORDER BY a.attname::text)
      FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    ) = ARRAY['assistant_id', 'user_id'];
  IF found IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.companion_routines DROP CONSTRAINT %I', found);
  END IF;
END $$;

-- The details sheet reads a bot's routines by these two columns, oldest first.
CREATE INDEX IF NOT EXISTS companion_routines_bot_idx
  ON public.companion_routines (user_id, assistant_id, created_at);
