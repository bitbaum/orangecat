-- Open peer review on research.
--
-- Open science needs someone other than the author to look at the work. On
-- OrangeCat that someone may be pseudonymous, exactly like the researcher: a
-- review stands on what it says and on the reviewer's public track record, not
-- on a journal's letterhead.
--
-- A review is a public statement. It is append-only: no one edits one after it
-- is read, not even its author. A reviewer who changes their mind posts a NEW
-- review (verdict 'retracted' or a different one); the history is the record.
-- That is what makes a verdict worth anything to a funder, and it is why the
-- body's SHA-256 is stored beside it — anyone can recompute it and see that the
-- words are the ones that were posted.
--
--   verdict       what the reviewer concludes. The list is src/config/open-science.ts
--                 (validated by zod, deliberately not a CHECK).
--   output_link   which of the research's outputs was reviewed; NULL = the
--                 project as a whole.
--
-- A researcher cannot review their own research. That rule lives in the
-- insert policy, so no route can forget it.

CREATE TABLE IF NOT EXISTS public.research_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_entity_id UUID NOT NULL REFERENCES public.research_entities(id) ON DELETE CASCADE,
  reviewer_actor_id UUID NOT NULL REFERENCES public.actors(id) ON DELETE CASCADE,
  output_link TEXT CHECK (output_link IS NULL OR char_length(output_link) <= 500),
  verdict TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 10000),
  body_sha256 TEXT NOT NULL CHECK (body_sha256 ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_reviews_research
  ON public.research_reviews (research_entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_reviews_reviewer
  ON public.research_reviews (reviewer_actor_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.research_reviews_are_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'A review cannot be edited. Post a new review instead.'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS research_reviews_are_append_only ON public.research_reviews;
CREATE TRIGGER research_reviews_are_append_only
  BEFORE UPDATE ON public.research_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.research_reviews_are_append_only();

ALTER TABLE public.research_reviews ENABLE ROW LEVEL SECURITY;

-- Reviews of public research are public. A review of a private project is
-- visible to its owner and its reviewer.
DROP POLICY IF EXISTS research_reviews_select ON public.research_reviews;
CREATE POLICY research_reviews_select ON public.research_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.research_entities r
      WHERE r.id = research_entity_id
        AND (r.is_public = true OR r.user_id = (SELECT auth.uid()))
    )
    OR reviewer_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
  );

-- As yourself, on research you can see, that is not your own.
DROP POLICY IF EXISTS research_reviews_insert ON public.research_reviews;
CREATE POLICY research_reviews_insert ON public.research_reviews
  FOR INSERT WITH CHECK (
    reviewer_actor_id IN (SELECT id FROM public.actors WHERE user_id = (SELECT auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.research_entities r
      WHERE r.id = research_entity_id
        AND r.is_public = true
        AND r.user_id <> (SELECT auth.uid())
    )
  );

-- No UPDATE policy (and the trigger above for writers that bypass RLS).
-- No DELETE policy: a review leaves the record only with its research.

GRANT SELECT, INSERT ON public.research_reviews TO authenticated;
GRANT SELECT ON public.research_reviews TO anon;
GRANT ALL ON public.research_reviews TO service_role;

COMMENT ON TABLE public.research_reviews IS
  'Open, append-only peer review of research. Reviewers may be pseudonymous; a changed mind is a new review, never an edit.';

-- Rollback (by hand, if ever needed):
--   DROP TABLE public.research_reviews;
--   DROP FUNCTION public.research_reviews_are_append_only();
