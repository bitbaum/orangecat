-- A person's own calendar. Until now "what do I have next week" could only
-- be answered from an outside calendar, which needs that provider's sign-in
-- app, permissions and reconnects. An entry here needs none of it: the
-- person, their Cat or one of their bots writes it, and every model can be
-- handed it.
--
-- Private to its owner. made_by says who wrote it ('me', 'cat', or a bot's
-- id) so an entry a bot added is never mistaken for one the person typed.

CREATE TABLE IF NOT EXISTS public.calendar_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  starts_at TIMESTAMPTZ NOT NULL,
  -- NULL = a moment or an all-day entry with no stated end.
  ends_at TIMESTAMPTZ CHECK (ends_at IS NULL OR ends_at >= starts_at),
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  location TEXT CHECK (location IS NULL OR char_length(location) <= 300),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  made_by TEXT NOT NULL DEFAULT 'me' CHECK (char_length(made_by) BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS calendar_entries_owner_time_idx
  ON public.calendar_entries (user_id, starts_at);

ALTER TABLE public.calendar_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_entries'
      AND policyname = 'A calendar is its owner''s'
  ) THEN
    CREATE POLICY "A calendar is its owner's" ON public.calendar_entries
      FOR ALL USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_entries TO authenticated;
GRANT ALL ON public.calendar_entries TO service_role;
