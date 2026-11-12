-- A bot's hands are switched per bot, by its owner.
--
-- Until now every bot of a person was offered the same hands, each waiting
-- for a tap. A row here says, for one bot and one hand, either "off" (the
-- bot is not offered it) or "auto" (the bot runs it without a tap, as its
-- owner, and is handed the result to carry on with). No row means "ask":
-- the hand is offered and waits for a tap, as before.
--
-- The grant is the owner's own, read and written only by them (RLS). It
-- widens nothing a person could not do: an "auto" hand still passes the
-- Cat's permission check, parameter validation and action log on every run.

CREATE TABLE IF NOT EXISTS public.companion_hand_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assistant_id UUID NOT NULL REFERENCES public.ai_assistants(id) ON DELETE CASCADE,
  action_id TEXT NOT NULL CHECK (char_length(action_id) BETWEEN 1 AND 80),
  mode TEXT NOT NULL CHECK (mode IN ('off', 'auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, assistant_id, action_id)
);

CREATE INDEX IF NOT EXISTS companion_hand_grants_bot_idx
  ON public.companion_hand_grants (assistant_id, user_id);

ALTER TABLE public.companion_hand_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_hand_grants'
      AND policyname = 'Users manage own companion hand grants'
  ) THEN
    CREATE POLICY "Users manage own companion hand grants" ON public.companion_hand_grants
      FOR ALL USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_hand_grants TO authenticated;
GRANT ALL ON public.companion_hand_grants TO service_role;
