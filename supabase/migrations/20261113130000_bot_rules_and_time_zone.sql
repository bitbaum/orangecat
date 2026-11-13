-- A person's own rules for their bots, and their time zone.
--
-- Grok Bot reviews a bot's risky actions against rules the person wrote, and
-- knows the person's time zone. Two nullable columns on user_ai_preferences
-- (the existing per-user AI settings row, already client-writable under RLS):
--
--   bot_rules  the person's own words: what their bots must never do, or must
--              always ask before. Read into a bot's prompt for its owner, and
--              a step a bot would run on its own is checked against them
--              first (src/services/companions/rules.ts).
--   time_zone  an IANA name ("Europe/Zurich"), so a bot knows what time it is
--              for its owner.
--
-- The ceilings mirror MAX_BOT_RULES_LENGTH in that file; the CHECKs are the
-- backstop for direct writes.

ALTER TABLE public.user_ai_preferences
  ADD COLUMN IF NOT EXISTS bot_rules TEXT,
  ADD COLUMN IF NOT EXISTS time_zone TEXT;

-- Added only when missing, so a second run changes nothing and nothing is
-- ever dropped (the previous release never knew these constraints).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_ai_preferences_bot_rules_len'
  ) THEN
    ALTER TABLE public.user_ai_preferences
      ADD CONSTRAINT user_ai_preferences_bot_rules_len
      CHECK (bot_rules IS NULL OR char_length(bot_rules) <= 2000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_ai_preferences_time_zone_len'
  ) THEN
    ALTER TABLE public.user_ai_preferences
      ADD CONSTRAINT user_ai_preferences_time_zone_len
      CHECK (time_zone IS NULL OR char_length(time_zone) <= 64);
  END IF;
END
$$;

COMMENT ON COLUMN public.user_ai_preferences.bot_rules IS
  'The person''s own rules for their bots. In the bot''s prompt for its owner; a step a bot would run on its own is checked against them first.';
COMMENT ON COLUMN public.user_ai_preferences.time_zone IS
  'The person''s IANA time zone, so a bot knows what time it is for them.';
