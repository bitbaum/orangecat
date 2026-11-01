-- Companion routines: a bot that writes first, once a day at the person's
-- time, on the person's own key. One routine per bot per person. The cron
-- (api/cron/companion-routines, every 15 minutes) runs the ones whose
-- next_run_at has passed, posts the reply in the bot's own thread and sends
-- a notification; a routine never spends the free chain (budget rule
-- 2026-09-25), so the cron skips it, with the reason recorded, when the
-- person has no key of their own.

CREATE TABLE IF NOT EXISTS public.companion_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES public.ai_assistants(id) ON DELETE CASCADE,
  -- The thread the reply lands in; made on the first run when null.
  conversation_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 500),
  -- Wall-clock time of day and the IANA zone it is read in.
  time_local TEXT NOT NULL CHECK (time_local ~ '^[0-2][0-9]:[0-5][0-9]$'),
  zone TEXT NOT NULL CHECK (char_length(zone) BETWEEN 1 AND 64),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  -- Why the last due run did not happen (no own key), cleared on a run.
  skipped_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, assistant_id)
);

CREATE INDEX IF NOT EXISTS companion_routines_due_idx
  ON public.companion_routines (next_run_at)
  WHERE enabled;

ALTER TABLE public.companion_routines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_routines'
      AND policyname = 'Users manage own companion routines'
  ) THEN
    CREATE POLICY "Users manage own companion routines" ON public.companion_routines
      FOR ALL USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_routines TO authenticated;
GRANT ALL ON public.companion_routines TO service_role;
