-- A routine could only run once a day. A bot that watches something (is a
-- site up, did the agents finish) needs to look more often than that.
--
-- every_hours, when set, makes the routine run again that many hours after
-- each run instead of at time_local the next day. NULL keeps the daily
-- routine exactly as it was. The cron that runs due routines is unchanged
-- (every 15 minutes), and a routine still runs only on the person's own key.

ALTER TABLE public.companion_routines
  ADD COLUMN IF NOT EXISTS every_hours INTEGER
  CHECK (every_hours IS NULL OR every_hours BETWEEN 1 AND 24);
