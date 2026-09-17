-- proactive_suggestions_enabled — may Cat raise something you did not ask about?
--
-- Cat should sometimes volunteer: "that draft has been sitting unpublished",
-- "nobody can pay into this yet". An agent that only ever answers is a search
-- box with manners. But unasked suggestions are also the fastest way to make a
-- product tiring, so this is the switch that settles it per person.
--
-- DEFAULT TRUE, deliberately, and the reasoning is worth keeping:
--
--   An opt-IN default means almost nobody ever sees the behaviour, so it never
--   gets better and never earns its keep. The risk of defaulting ON is not the
--   default — it is a low BAR for what deserves interrupting someone. The bar
--   lives in the prompt (Proactive Suggestions), and it is strict: anchored to
--   something concrete in their own context, one at a time, never repeated,
--   and never to fill a silence.
--
-- Mirrors memory_enabled (20260731110000) exactly: same table, same own-row
-- RLS, same "a missing row or a failed read must not silently change
-- behaviour" reading in the app.
--
-- Idempotent — safe if a box already has the column.

ALTER TABLE public.user_ai_preferences
  ADD COLUMN IF NOT EXISTS proactive_suggestions_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.user_ai_preferences.proactive_suggestions_enabled IS
  'May Cat raise something the user did not ask about? Default true; the bar for what qualifies lives in the system prompt, not here.';
