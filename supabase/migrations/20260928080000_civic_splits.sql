-- Civic splits: "Of the money I owe the public, how would I divide it between
-- my locality, my region and my nation?"
--
-- The law fixes the real split and nothing here pretends otherwise (the copy
-- that ships with every surface says so). What a person records is their OWN
-- split: a public statement of where they stand, and — once local funds exist —
-- the standing instruction for what they give voluntarily on top of taxes.
--
-- One row per actor. A person changes their mind by updating it; there is no
-- history table, because the interesting record is the current aggregate per
-- place, not one person's drift.
--
-- Place is typed by the person (country code + region + locality) and keyed
-- lowercase for grouping. No place registry exists yet; when one does, these
-- keys are what it maps onto. The aggregate never reports a place with fewer
-- than three declarations (src/config/civic-split.ts CIVIC_SPLIT_MIN_GROUP),
-- so a typo in a locality name is a place nobody will ever see.

CREATE TABLE IF NOT EXISTS civic_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Whose statement this is. Actors, not users: a group can declare too.
  actor_id UUID NOT NULL UNIQUE REFERENCES actors(id) ON DELETE CASCADE,

  -- Where the person belongs, in their own words.
  country_code CHAR(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  region TEXT NOT NULL CHECK (char_length(region) BETWEEN 1 AND 80),
  locality TEXT NOT NULL CHECK (char_length(locality) BETWEEN 1 AND 80),
  -- Grouping keys, derived once on write so the aggregate never re-derives them.
  region_key TEXT GENERATED ALWAYS AS (lower(btrim(region))) STORED,
  locality_key TEXT GENERATED ALWAYS AS (lower(btrim(locality))) STORED,

  -- Whole percentages. The three always sum to 100; a partial split is not a
  -- split, and letting one through would make every average wrong.
  share_locality SMALLINT NOT NULL CHECK (share_locality BETWEEN 0 AND 100),
  share_region   SMALLINT NOT NULL CHECK (share_region   BETWEEN 0 AND 100),
  share_nation   SMALLINT NOT NULL CHECK (share_nation   BETWEEN 0 AND 100),
  CONSTRAINT civic_splits_sum_to_100
    CHECK (share_locality + share_region + share_nation = 100),

  -- Shown on the public profile only when true. Counted in the aggregate
  -- either way — anonymously, above the minimum group size.
  is_public BOOLEAN NOT NULL DEFAULT false,
  -- Why, in a sentence, if they want to say.
  note TEXT CHECK (note IS NULL OR char_length(note) <= 280),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The aggregate groups by place; everything else reads one row by actor.
CREATE INDEX IF NOT EXISTS idx_civic_splits_place
  ON civic_splits (country_code, region_key, locality_key);

DROP TRIGGER IF EXISTS set_civic_splits_updated_at ON civic_splits;
CREATE TRIGGER set_civic_splits_updated_at
  BEFORE UPDATE ON civic_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE civic_splits ENABLE ROW LEVEL SECURITY;

-- A person reads, writes and removes their own statement and nobody else's.
-- The public aggregate is served by the service role and reports only
-- averages over groups, never rows.
DROP POLICY IF EXISTS civic_splits_select_own ON civic_splits;
CREATE POLICY civic_splits_select_own ON civic_splits
  FOR SELECT USING (
    actor_id IN (SELECT id FROM actors WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS civic_splits_insert_own ON civic_splits;
CREATE POLICY civic_splits_insert_own ON civic_splits
  FOR INSERT WITH CHECK (
    actor_id IN (SELECT id FROM actors WHERE user_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS civic_splits_update_own ON civic_splits;
CREATE POLICY civic_splits_update_own ON civic_splits
  FOR UPDATE
  USING (actor_id IN (SELECT id FROM actors WHERE user_id = (SELECT auth.uid())))
  WITH CHECK (actor_id IN (SELECT id FROM actors WHERE user_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS civic_splits_delete_own ON civic_splits;
CREATE POLICY civic_splits_delete_own ON civic_splits
  FOR DELETE USING (
    actor_id IN (SELECT id FROM actors WHERE user_id = (SELECT auth.uid()))
  );

-- The profile page shows a split only when its owner said so. A dedicated
-- SELECT policy for everyone would also expose private rows' places, so the
-- public read goes through a view that carries nothing but public rows.
-- Not security_invoker: see 20260917130000_the_public_view_cannot_run_as_the_caller.
CREATE OR REPLACE VIEW civic_splits_public AS
  SELECT actor_id, country_code, region, locality,
         share_locality, share_region, share_nation, note, updated_at
  FROM civic_splits
  WHERE is_public = true;

GRANT SELECT ON civic_splits_public TO anon, authenticated, service_role;

COMMENT ON TABLE civic_splits IS
  'One actor''s declared split of their public contribution between locality, region and nation. A statement, not a tax instruction.';
COMMENT ON COLUMN civic_splits.is_public IS
  'Shown on the profile when true; counted in place aggregates regardless, above the minimum group size.';
