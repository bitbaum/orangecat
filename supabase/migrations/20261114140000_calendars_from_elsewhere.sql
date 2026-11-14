-- A person's calendars kept elsewhere, and theirs shown elsewhere.
--
-- calendar_feeds: other calendars a person linked by their private iCal
-- address (Google's "secret address in iCal format", an iCloud public
-- calendar, an Outlook published calendar…). Read on demand and shown in
-- their OrangeCat calendar; never written to. The address itself grants
-- read access to that calendar, so it is never sent back to a browser: the
-- page is given a name and a hint only.
--
-- calendar_share_tokens: one secret per person behind the address of their
-- own OrangeCat calendar as an iCal feed, for Apple Calendar, Google
-- Calendar or Outlook to subscribe to. Turning it off deletes the row;
-- turning it on again makes a new secret, so an old link stops working.

CREATE TABLE IF NOT EXISTS public.calendar_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  url TEXT NOT NULL CHECK (char_length(url) BETWEEN 10 AND 2000),
  -- Which service it came from, read off the address: google, apple, outlook or other.
  provider TEXT NOT NULL DEFAULT 'other' CHECK (char_length(provider) BETWEEN 1 AND 20),
  last_ok_at TIMESTAMPTZ,
  last_error TEXT CHECK (last_error IS NULL OR char_length(last_error) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

CREATE INDEX IF NOT EXISTS calendar_feeds_owner_idx ON public.calendar_feeds (user_id);

ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_feeds'
      AND policyname = 'Linked calendars are their owner''s'
  ) THEN
    CREATE POLICY "Linked calendars are their owner's" ON public.calendar_feeds
      FOR ALL USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feeds TO authenticated;
GRANT ALL ON public.calendar_feeds TO service_role;

CREATE TABLE IF NOT EXISTS public.calendar_share_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE CHECK (char_length(token) >= 32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_share_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calendar_share_tokens'
      AND policyname = 'A calendar link is its owner''s'
  ) THEN
    CREATE POLICY "A calendar link is its owner's" ON public.calendar_share_tokens
      FOR ALL USING ((SELECT auth.uid()) = user_id)
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_share_tokens TO authenticated;
GRANT ALL ON public.calendar_share_tokens TO service_role;
