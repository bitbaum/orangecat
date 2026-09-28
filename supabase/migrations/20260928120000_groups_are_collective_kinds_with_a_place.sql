-- Groups are kinds of collective, and some kinds are bound to a place.
--
-- The kind list is SSOT in @bitbaum/collective-kinds (packages/collective-kinds).
-- OrangeCat's `nonprofit` was its own word for what that list — and the world —
-- calls an association (Swiss: Verein). Rename the rows; the app no longer
-- accepts the old word.
--
-- A town or a local fund without a place is a word, so a group now carries
-- WHERE it belongs (country, region, locality — same three levels and the same
-- lower(btrim()) key rule as civic_splits) and WHAT IT LEGALLY IS (informal,
-- registered, recognised tax-exempt — each earned by evidence, see legal.ts in
-- the package). Only a complete tax-exempt record may ever be described as
-- able to receive deductible gifts; that rule lives in the app, the columns
-- only hold the facts.
--
-- Rollback: UPDATE public.groups SET label = 'nonprofit' WHERE label = 'association';
--           ALTER TABLE public.groups DROP COLUMN country_code, DROP COLUMN region,
--             DROP COLUMN locality, DROP COLUMN region_key, DROP COLUMN locality_key,
--             DROP COLUMN legal_status, DROP COLUMN legal_form, DROP COLUMN jurisdiction,
--             DROP COLUMN register_id, DROP COLUMN recognised_on;

UPDATE public.groups SET label = 'association' WHERE label = 'nonprofit';

COMMENT ON COLUMN public.groups.label IS
  'Kind of collective — one of the ids in @bitbaum/collective-kinds (packages/collective-kinds/src/kinds.ts). Influences defaults, never restricts capabilities.';

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS locality text,
  ADD COLUMN IF NOT EXISTS region_key text GENERATED ALWAYS AS (lower(btrim(region))) STORED,
  ADD COLUMN IF NOT EXISTS locality_key text GENERATED ALWAYS AS (lower(btrim(locality))) STORED,
  ADD COLUMN IF NOT EXISTS legal_status text NOT NULL DEFAULT 'informal',
  ADD COLUMN IF NOT EXISTS legal_form text,
  ADD COLUMN IF NOT EXISTS jurisdiction text,
  ADD COLUMN IF NOT EXISTS register_id text,
  ADD COLUMN IF NOT EXISTS recognised_on date;

-- True invariants only (the enum itself is validated in the app, see
-- services/groups/validation): a country code is two upper-case letters, a
-- place name fits a line, and the three legal states are the three the
-- package defines.
ALTER TABLE public.groups
  ADD CONSTRAINT groups_country_code_shape CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT groups_place_name_length CHECK (
    (region IS NULL OR char_length(region) BETWEEN 1 AND 80)
    AND (locality IS NULL OR char_length(locality) BETWEEN 1 AND 80)
  ),
  ADD CONSTRAINT groups_legal_status_known CHECK (legal_status IN ('informal', 'registered', 'tax_exempt'));

-- Finding "the local fund of Witikon" is a lookup by place and kind.
CREATE INDEX IF NOT EXISTS idx_groups_place_kind
  ON public.groups (country_code, region_key, locality_key, label)
  WHERE locality_key IS NOT NULL;

COMMENT ON COLUMN public.groups.country_code IS 'ISO 3166-1 alpha-2 of the place the group belongs to; required for place-bound kinds (town, local_fund).';
COMMENT ON COLUMN public.groups.legal_status IS 'informal | registered | tax_exempt — see @bitbaum/collective-kinds legal.ts for what each state requires as evidence.';
