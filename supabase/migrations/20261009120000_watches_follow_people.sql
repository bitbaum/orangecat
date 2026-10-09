-- Cat watches that follow PEOPLE: "tell me when she posts", "tell me when
-- anyone I follow posts about Lightning".
--
-- Two new kinds, both evaluated by the cat-watches timer
-- (services/cat/social-watches.ts) and, unlike the older kinds, STANDING:
-- they stay 'active' and notify once per new post until cancelled.
--
--   person_posts     — subject_user_id posted (optionally matching `topic`)
--   following_topic  — anyone the watcher follows posted about `topic`
--
-- `last_seen_at` is the cursor: the created_at of the newest post the watch
-- has already looked at. The timer only reads posts after it and advances it
-- BEFORE notifying, so a post can never fire the same watch twice. NULL means
-- "start from created_at".
--
-- Idempotent.

ALTER TABLE public.cat_watches ADD COLUMN IF NOT EXISTS subject_user_id uuid;
ALTER TABLE public.cat_watches ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.cat_watches.subject_user_id IS
  'person_posts only: the profile (user id) whose public posts are watched.';
COMMENT ON COLUMN public.cat_watches.last_seen_at IS
  'person_posts / following_topic: created_at of the newest post already evaluated. Advanced before notifying, so a post fires a watch at most once.';

-- migration-safety: contract-ok widening a CHECK in place — the constraint is
-- dropped and immediately re-added in the same transaction with a strictly
-- larger value set (the four existing kinds plus 'person_posts' and
-- 'following_topic'). Every row and INSERT the previous release can produce
-- still passes; only rows using the new kinds would fail the old constraint,
-- and the previous release never writes those.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cat_watches'::regclass AND conname = 'cat_watches_kind_check'
  ) THEN
    ALTER TABLE public.cat_watches DROP CONSTRAINT cat_watches_kind_check;
  END IF;
  ALTER TABLE public.cat_watches ADD CONSTRAINT cat_watches_kind_check
    CHECK (kind IN (
      'funding_reached', 'sale_received', 'booking_received', 'topic_match',
      'person_posts', 'following_topic'
    ));
END $$;

-- The timer reads "public posts by these authors since the cursor" every 15
-- minutes; the existing (actor_id, event_timestamp) index does not cover a
-- created_at cursor.
CREATE INDEX IF NOT EXISTS idx_timeline_actor_created
  ON public.timeline_events (actor_id, created_at)
  WHERE actor_id IS NOT NULL AND NOT is_deleted;
