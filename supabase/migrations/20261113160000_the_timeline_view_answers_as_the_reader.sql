-- The timeline view answers as the reader, not as its owner.
--
-- `enriched_timeline_events` (baseline) joins every timeline row to its author,
-- subject and target, has no visibility filter of its own, and was created
-- without security_invoker — so it ran with its OWNER's rights and the
-- "Timeline events viewable by visibility rules" policy on timeline_events was
-- never evaluated through it. It is granted to anon and authenticated, so
-- anyone holding the public anon key could read every followers-only and
-- private post (text, author, metadata) straight off PostgREST. Found
-- 2026-11-13 while making public posts shareable (bitbaum/orangecat#1721).
--
-- security_invoker = true (PG 15+; production runs 15.8, as 20260917120000
-- notes) makes the policies on timeline_events, profiles and projects apply to
-- the calling role. Every profiles column the view reads (id, username, name,
-- avatar_url, bio, created_at) is granted to anon and authenticated by
-- 20260917120100 / 20260917163100, so public posts keep their bylines.
--
-- Rollback: ALTER VIEW public.enriched_timeline_events SET (security_invoker = false);
-- (which reopens the hole — only to restore service while a reader is fixed).

BEGIN;

ALTER VIEW public.enriched_timeline_events SET (security_invoker = true);

-- Prove it here; migration-replay.yml replays this against a fresh database.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'enriched_timeline_events'
      AND 'security_invoker=true' = ANY (coalesce(c.reloptions, '{}'))
  ) THEN
    RAISE EXCEPTION 'enriched_timeline_events still runs with its owner''s rights';
  END IF;
END $$;

-- Signed-out readers can still read the view (public posts, articles): a
-- missing column grant would turn every article page into an error.
DO $$
DECLARE
  n int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM (SELECT * FROM public.enriched_timeline_events LIMIT 1) t;
  RESET ROLE;
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE EXCEPTION 'anon cannot read enriched_timeline_events as itself — article pages would fail';
END $$;

COMMIT;
