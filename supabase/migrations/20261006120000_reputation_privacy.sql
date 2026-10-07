-- Reputation, private where it matters. (ADR-0010, revisited)
--
-- The first version published more than OrangeCat's principles allow:
--
--   * every seller's settled BTC volume was public on their profile, and the
--     backfill made past sales public with no notice;
--   * a revealed review named its reviewer and said "bought from them", and
--     because EITHER side could review, a seller reviewing a buyer put that
--     purchase on the buyer's profile without the buyer doing anything;
--   * review text could never be removed, even if it doxxed someone, and the
--     person reviewed had no way to answer.
--
-- This migration keeps what makes reviews trustworthy (only parties review,
-- one per side, blind until both write, never edited) and changes who sees
-- what:
--
--   1. deal_reviews is no longer readable by the public. Each party sees its
--      own review, and the other side's once the deal is revealed.
--   2. The public sees reviews only through public_deal_reviews(): reviews OF
--      a seller BY their customers. Reviews of buyers are never public; they
--      stay with the two parties (and, later, a lending check the buyer
--      consents to).
--   3. A reviewer is anonymous ("a verified buyer") unless they chose to show
--      their name (reviewer_shown). Existing reviews default to anonymous.
--   4. actor_track_record() no longer returns sales volume or how often
--      someone BOUGHT. It keeps deal count, distinct customers and outcome
--      counts, the anti-fraud signal, and adds the "would deal again" tally
--      over public reviews.
--   5. Anyone signed in can report a public review; the operator can hide its
--      text (deal_review_moderation). The record itself stays, with its hash,
--      so hiding is visible as hiding, never a silent rewrite.
--   6. The seller can reply once to each public review about them.
--
-- Rollback: the previous release reads deal_reviews as anon and the old
-- actor_track_record columns. Against this schema the read is refused, which
-- that code catches by hiding the profile section. It degrades to "no track
-- record shown", never to a crash or a leak.

-- ==================== 3. REVIEWER CHOOSES TO BE NAMED ====================

ALTER TABLE public.deal_reviews
  ADD COLUMN IF NOT EXISTS reviewer_shown BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.deal_reviews.reviewer_shown IS
  'The reviewer chose to be named on the public review. Default false: shown as a verified buyer.';

-- ==================== 1. REVIEWS ARE THE PARTIES' ====================

DROP POLICY IF EXISTS deal_reviews_select ON public.deal_reviews;
CREATE POLICY deal_reviews_select ON public.deal_reviews
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      reviewer_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
      OR (
        subject_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
        AND public.deal_reviews_revealed(deal_id)
      )
    )
  );

REVOKE SELECT ON public.deal_reviews FROM anon;

-- ==================== 5. MODERATION ====================

-- Written only by the operator (service role). Hides the TEXT of a review or
-- its reply; the answers, the date and the body's hash stay, so a reader sees
-- that something was removed rather than a quietly different record.
CREATE TABLE IF NOT EXISTS public.deal_review_moderation (
  review_id UUID PRIMARY KEY REFERENCES public.deal_reviews(id) ON DELETE CASCADE,
  text_hidden_at TIMESTAMPTZ,
  reply_hidden_at TIMESTAMPTZ,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 1000),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_review_moderation ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.deal_review_moderation TO service_role;

-- Is this review on public display? Customers' reviews of sellers, once
-- revealed. SECURITY DEFINER so a report or reply policy can ask without the
-- caller being able to read the review row itself.
CREATE OR REPLACE FUNCTION public.deal_review_public_subject(p_review_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.subject_actor_id
    FROM public.deal_reviews r
   WHERE r.id = p_review_id
     AND r.reviewer_role = 'customer'
     AND public.deal_reviews_revealed(r.deal_id)
$$;

GRANT EXECUTE ON FUNCTION public.deal_review_public_subject(UUID) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.deal_review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.deal_reviews(id) ON DELETE CASCADE,
  reporter_actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deal_review_reports_once UNIQUE (review_id, reporter_actor_id)
);

ALTER TABLE public.deal_review_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deal_review_reports_insert ON public.deal_review_reports;
CREATE POLICY deal_review_reports_insert ON public.deal_review_reports
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND reporter_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
    AND public.deal_review_public_subject(review_id) IS NOT NULL
  );

DROP POLICY IF EXISTS deal_review_reports_select ON public.deal_review_reports;
CREATE POLICY deal_review_reports_select ON public.deal_review_reports
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND reporter_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
  );

GRANT SELECT, INSERT ON public.deal_review_reports TO authenticated;
GRANT ALL ON public.deal_review_reports TO service_role;

-- ==================== 6. THE SELLER'S REPLY ====================

CREATE TABLE IF NOT EXISTS public.deal_review_replies (
  review_id UUID PRIMARY KEY REFERENCES public.deal_reviews(id) ON DELETE CASCADE,
  author_actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  body_sha256 TEXT NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deal_review_replies ENABLE ROW LEVEL SECURITY;

-- Only the person the public review is about, once, as themselves.
DROP POLICY IF EXISTS deal_review_replies_insert ON public.deal_review_replies;
CREATE POLICY deal_review_replies_insert ON public.deal_review_replies
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND author_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
    AND author_actor_id = public.deal_review_public_subject(review_id)
  );

DROP POLICY IF EXISTS deal_review_replies_select ON public.deal_review_replies;
CREATE POLICY deal_review_replies_select ON public.deal_review_replies
  FOR SELECT USING (
    (SELECT auth.uid()) IS NOT NULL
    AND author_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
  );

DROP TRIGGER IF EXISTS deal_review_replies_are_append_only ON public.deal_review_replies;
CREATE TRIGGER deal_review_replies_are_append_only
  BEFORE UPDATE ON public.deal_review_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.deal_reviews_are_append_only();

GRANT SELECT, INSERT ON public.deal_review_replies TO authenticated;
GRANT ALL ON public.deal_review_replies TO service_role;

-- ==================== 2. WHAT THE PUBLIC SEES ====================

-- Public reviews OF a seller BY their customers, newest first. Never the deal,
-- its title or amount; the reviewer only if they chose to be named; text only
-- if the operator has not hidden it.
CREATE OR REPLACE FUNCTION public.public_deal_reviews(p_actor_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  review_id UUID,
  answers JSONB,
  body TEXT,
  text_hidden BOOLEAN,
  created_at TIMESTAMPTZ,
  reviewer_actor_id UUID,
  reply_body TEXT,
  reply_hidden BOOLEAN,
  reply_created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.answers,
    CASE WHEN m.text_hidden_at IS NULL THEN r.body END,
    m.text_hidden_at IS NOT NULL,
    r.created_at,
    CASE WHEN r.reviewer_shown THEN r.reviewer_actor_id END,
    CASE WHEN m.reply_hidden_at IS NULL THEN rp.body END,
    m.reply_hidden_at IS NOT NULL,
    rp.created_at
  FROM public.deal_reviews r
  LEFT JOIN public.deal_review_moderation m ON m.review_id = r.id
  LEFT JOIN public.deal_review_replies rp ON rp.review_id = r.id
  WHERE r.subject_actor_id = p_actor_id
    AND r.reviewer_role = 'customer'
    AND public.deal_reviews_revealed(r.deal_id)
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 20)
$$;

GRANT EXECUTE ON FUNCTION public.public_deal_reviews(UUID, INTEGER) TO anon, authenticated, service_role;

-- ==================== 4. THE TRACK RECORD, WITHOUT VOLUME ====================

-- The return type changes (columns removed), which CREATE OR REPLACE cannot
-- do, so the function is dropped and recreated in the same transaction.
DROP FUNCTION IF EXISTS public.actor_track_record(UUID);

-- 'would_deal_again' is HEADLINE_QUESTION in src/config/reputation.ts; a unit
-- test pins the two together.
CREATE FUNCTION public.actor_track_record(p_actor_id UUID)
RETURNS TABLE (
  deals_provided INTEGER,
  deals_provided_completed INTEGER,
  deals_provided_refunded INTEGER,
  deals_provided_cancelled INTEGER,
  distinct_customers INTEGER,
  first_deal_at TIMESTAMPTZ,
  last_deal_at TIMESTAMPTZ,
  would_deal_again_yes INTEGER,
  would_deal_again_of INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sold AS (
    SELECT * FROM public.deals WHERE provider_actor_id = p_actor_id
  ),
  heard AS (
    SELECT r.answers->'would_deal_again' AS answer
      FROM public.deal_reviews r
      JOIN sold d ON d.id = r.deal_id
     WHERE r.reviewer_role = 'customer'
       AND r.answers ? 'would_deal_again'
       AND public.deal_reviews_revealed(r.deal_id)
  )
  SELECT
    (SELECT count(*) FROM sold)::int,
    (SELECT count(*) FROM sold WHERE status = 'completed')::int,
    (SELECT count(*) FROM sold WHERE status = 'refunded')::int,
    (SELECT count(*) FROM sold WHERE status = 'cancelled')::int,
    (SELECT count(DISTINCT customer_actor_id) FROM sold)::int,
    (SELECT min(settled_at) FROM sold),
    (SELECT max(settled_at) FROM sold),
    (SELECT count(*) FROM heard WHERE answer = 'true'::jsonb)::int,
    (SELECT count(*) FROM heard)::int
$$;

GRANT EXECUTE ON FUNCTION public.actor_track_record(UUID) TO anon, authenticated, service_role;

-- Rollback (by hand, if ever needed): re-run the actor_track_record and
-- deal_reviews_select definitions from 20261005120000, GRANT SELECT ON
-- deal_reviews TO anon, and drop public_deal_reviews,
-- deal_review_public_subject, deal_review_replies, deal_review_reports,
-- deal_review_moderation and the reviewer_shown column.
