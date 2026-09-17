-- Backfill timeline_event_stats from the reactions that actually exist.
--
-- SYMPTOM
-- 10 rows in timeline_likes, but only 2 rows in timeline_event_stats — and
-- only one of those belonged to a liked event. Every reader takes its counts
-- from timeline_event_stats (services/timeline/processors/reaction-state.ts:
-- "Counts come from timeline_event_stats ... the single place they live"), so
-- 9 real likes by real people rendered as 0. The like was in the database and
-- invisible on every surface — the same failure the reaction work of
-- 2026-08-28 set out to fix, still true for every row written before it.
--
-- WHY THE DRIFT IS POSSIBLE
-- Nothing enforces the relationship. There is no trigger on timeline_likes
-- (verified: pg_trigger is empty for it); the counts are maintained only by
-- like_timeline_event / unlike_timeline_event, which are SECURITY DEFINER and
-- recompute the row from the membership table. So the stats row for an event
-- only ever materialises when someone toggles a reaction on it AFTER those
-- functions existed. Anything written before, or by any path that is not those
-- functions, is simply never counted.
--
-- This migration recomputes every stats row from the membership tables, which
-- is exactly what the RPCs do, so it cannot disagree with them. It is
-- idempotent: running it twice produces the same rows.
--
-- Deliberately NOT adding a trigger. The RPCs already own this write and
-- recompute rather than increment; a trigger doing the same work would either
-- double-count or race with them. The invariant is instead checked below, so a
-- future drift shows up as a failed deploy rather than as a silent zero.

-- Comments and shares drift the same way and were worse: production held 17
-- comments and 7 shares while timeline_event_stats reported 0 of each, across
-- every event. So a post with real replies under it advertised none.
--
-- `is_deleted` is respected for comments because the read policy is
-- "viewable if not deleted or own" — counting deleted rows would advertise
-- replies a visitor cannot see. timeline_shares keys on `original_event_id`,
-- not `event_id`.
INSERT INTO public.timeline_event_stats AS s
  (event_id, like_count, dislike_count, comment_count, share_count, updated_at)
SELECT
  e.id,
  COALESCE(l.c, 0),
  COALESCE(d.c, 0),
  COALESCE(c.c, 0),
  COALESCE(sh.c, 0),
  now()
FROM public.timeline_events e
LEFT JOIN (
  SELECT event_id, count(*)::int AS c FROM public.timeline_likes GROUP BY event_id
) l ON l.event_id = e.id
LEFT JOIN (
  SELECT event_id, count(*)::int AS c FROM public.timeline_dislikes GROUP BY event_id
) d ON d.event_id = e.id
LEFT JOIN (
  SELECT event_id, count(*)::int AS c
  FROM public.timeline_comments
  WHERE is_deleted IS NOT TRUE
  GROUP BY event_id
) c ON c.event_id = e.id
LEFT JOIN (
  SELECT original_event_id AS event_id, count(*)::int AS c
  FROM public.timeline_shares GROUP BY original_event_id
) sh ON sh.event_id = e.id
-- Only touch events that actually have an interaction. Writing a zero row for
-- all 1445 events would be noise.
WHERE COALESCE(l.c, 0) > 0
   OR COALESCE(d.c, 0) > 0
   OR COALESCE(c.c, 0) > 0
   OR COALESCE(sh.c, 0) > 0
ON CONFLICT (event_id) DO UPDATE
SET like_count    = EXCLUDED.like_count,
    dislike_count = EXCLUDED.dislike_count,
    comment_count = EXCLUDED.comment_count,
    share_count   = EXCLUDED.share_count,
    updated_at    = now()
WHERE s.like_count    IS DISTINCT FROM EXCLUDED.like_count
   OR s.dislike_count IS DISTINCT FROM EXCLUDED.dislike_count
   OR s.comment_count IS DISTINCT FROM EXCLUDED.comment_count
   OR s.share_count   IS DISTINCT FROM EXCLUDED.share_count;

-- The invariant, asserted. If a future change lets the counts drift again,
-- the deploy fails here instead of quietly showing people a zero.
DO $$
DECLARE
  bad integer;
BEGIN
  SELECT count(*) INTO bad
  FROM public.timeline_events e
  LEFT JOIN public.timeline_event_stats s ON s.event_id = e.id
  LEFT JOIN (
    SELECT event_id, count(*)::int AS c FROM public.timeline_likes GROUP BY event_id
  ) l ON l.event_id = e.id
  LEFT JOIN (
    SELECT event_id, count(*)::int AS c
    FROM public.timeline_comments WHERE is_deleted IS NOT TRUE GROUP BY event_id
  ) c ON c.event_id = e.id
  LEFT JOIN (
    SELECT original_event_id AS event_id, count(*)::int AS c
    FROM public.timeline_shares GROUP BY original_event_id
  ) sh ON sh.event_id = e.id
  WHERE (COALESCE(l.c, 0) > 0 OR COALESCE(c.c, 0) > 0 OR COALESCE(sh.c, 0) > 0)
    AND (
         COALESCE(s.like_count, -1)    IS DISTINCT FROM COALESCE(l.c, 0)
      OR COALESCE(s.comment_count, -1) IS DISTINCT FROM COALESCE(c.c, 0)
      OR COALESCE(s.share_count, -1)   IS DISTINCT FROM COALESCE(sh.c, 0)
    );

  IF bad > 0 THEN
    RAISE EXCEPTION
      'timeline_event_stats disagrees with the interaction tables for % event(s)', bad;
  END IF;
END $$;
