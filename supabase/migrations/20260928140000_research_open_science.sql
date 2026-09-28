-- Open science on research: what the work is released under, where its outputs
-- live, and what it committed to before it saw a result.
--
-- Research already had a funding side (goal, model, wallet). It had nothing that
-- made it SCIENCE in the open sense: a funder could back a question and never be
-- told whether the answer would be published, under what terms, or whether the
-- hypothesis was moved after the data came in. These three columns are that.
--
--   license            what the outputs are released under. The option list is
--                      src/config/open-science.ts (validated by zod at the write
--                      boundary, deliberately NOT a CHECK — hand-synced enum
--                      checks drift). NULL = not stated, shown as "not stated".
--   output_links       where the outputs live, in order: preprint, dataset, code,
--                      protocol. ipfs:// and ar:// are content-addressed — the
--                      address IS the hash, so the thing cannot be swapped
--                      silently. The kind is derived from the link at display
--                      time; storing it would be a second copy of the URL's
--                      meaning.
--   preregistration    the hypothesis and analysis plan, written BEFORE results.
--   preregistration_sha256 / preregistered_at
--                      set by the server on the first write, never by a client.
--
-- Pre-registration is only worth anything if it cannot be edited afterwards. The
-- API refuses a change; the trigger below refuses it for every other writer too
-- (the Cat, the service role, a future route that forgets). Pseudonymous
-- researchers need this most: with no institution vouching for them, a public,
-- timestamped, unalterable commitment is what their credibility rests on.

ALTER TABLE public.research_entities
  ADD COLUMN IF NOT EXISTS license TEXT,
  ADD COLUMN IF NOT EXISTS output_links TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS preregistration TEXT,
  ADD COLUMN IF NOT EXISTS preregistration_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS preregistered_at TIMESTAMPTZ;

-- True invariants only: a hash is 64 hex chars, and a commitment is all three
-- fields or none of them.
ALTER TABLE public.research_entities
  DROP CONSTRAINT IF EXISTS research_entities_preregistration_sha256_format,
  ADD CONSTRAINT research_entities_preregistration_sha256_format
    CHECK (preregistration_sha256 IS NULL OR preregistration_sha256 ~ '^[0-9a-f]{64}$'),
  DROP CONSTRAINT IF EXISTS research_entities_preregistration_complete,
  ADD CONSTRAINT research_entities_preregistration_complete
    CHECK (
      (preregistration IS NULL AND preregistration_sha256 IS NULL AND preregistered_at IS NULL)
      OR (preregistration IS NOT NULL AND preregistration_sha256 IS NOT NULL AND preregistered_at IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION public.research_preregistration_is_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.preregistered_at IS NOT NULL AND (
       NEW.preregistration IS DISTINCT FROM OLD.preregistration
    OR NEW.preregistration_sha256 IS DISTINCT FROM OLD.preregistration_sha256
    OR NEW.preregistered_at IS DISTINCT FROM OLD.preregistered_at
  ) THEN
    RAISE EXCEPTION 'A pre-registration cannot be changed once it is committed'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS research_preregistration_is_immutable ON public.research_entities;
CREATE TRIGGER research_preregistration_is_immutable
  BEFORE UPDATE ON public.research_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.research_preregistration_is_immutable();

-- Rollback (by hand, if ever needed):
--   DROP TRIGGER research_preregistration_is_immutable ON public.research_entities;
--   DROP FUNCTION public.research_preregistration_is_immutable();
--   ALTER TABLE public.research_entities DROP COLUMN license, DROP COLUMN output_links,
--     DROP COLUMN preregistration, DROP COLUMN preregistration_sha256,
--     DROP COLUMN preregistered_at;
