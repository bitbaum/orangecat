-- Two wallet-truth fixes, both of the same shape: a number nobody measured,
-- displayed as if someone had.
--
-- 1. THE PROJECT BALANCE THAT WAS NEVER A COLUMN
--
-- Every public project page renders a "Bitcoin Balance" beside its funding
-- address, and it has always read 0.00 -- not because the addresses are empty,
-- but because `projects.bitcoin_balance_btc` DOES NOT EXIST. The page selects
-- `*`, gets `undefined`, and coalesces it with `|| 0`. The owner-only "Refresh
-- Balance" button could never repair it either: its route names the missing
-- column in a select list, PostgREST answers 42703, and the handler maps that
-- to "Project not found".
--
-- This is the exact bug class #946 fixed one level down, for wallets: "an
-- unchecked balance is unknown, not zero" -- a fabricated zero presented as
-- freshly read from the blockchain. A project holding Bitcoin looked empty.
--
-- Both columns are NULLABLE ON PURPOSE and are NOT defaulted to 0. NULL is the
-- third state the old code could not express: nobody has ever asked the chain.
-- The UI renders that as an em dash, never as a balance.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS bitcoin_balance_btc NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS bitcoin_balance_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.projects.bitcoin_balance_btc IS
  'Last on-chain balance read for bitcoin_address, in BTC. NULL = never checked; do not render NULL as zero.';
COMMENT ON COLUMN public.projects.bitcoin_balance_updated_at IS
  'When bitcoin_balance_btc was last read from the chain. NULL = never checked.';

-- 2. FOUR WALLETS THAT ALL CLAIMED TO BE PRIMARY
--
-- "Exactly one primary per entity" was enforced only in application code, and
-- that code had three holes, each of which leaks a stranded flag:
--
--   * enforceSinglePrimary() clears other primaries with `.eq('is_active',
--     true)` -- so a DEACTIVATED wallet keeps is_primary = true forever, out of
--     reach of every later sweep.
--   * createWallet() decides is_primary from a count of ACTIVE wallets, so once
--     an entity's wallets are all soft-deleted the next one is born primary.
--   * The soft delete sets is_active = false and leaves is_primary alone.
--
-- Run that cycle four times and you get four primary wallets, all deactivated,
-- while the two live ones are not primary at all -- which is the state this
-- migration found in production. Any "the primary wallet" lookup then resolves
-- to a deleted row, non-deterministically.
--
-- Clear the stranded flags, then make the invariant the database's job so the
-- application cannot strand another one.
UPDATE public.wallets
   SET is_primary = false
 WHERE is_primary
   AND NOT is_active;

-- Partial and scoped to LIVE rows: a soft-deleted wallet is not competing to be
-- primary, and two entities may each have their own. Verified before writing:
-- zero entities platform-wide hold more than one active primary, so these apply
-- without a backfill conflict.
CREATE UNIQUE INDEX IF NOT EXISTS wallets_one_active_primary_per_profile
    ON public.wallets (profile_id)
 WHERE is_primary AND is_active AND profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS wallets_one_active_primary_per_project
    ON public.wallets (project_id)
 WHERE is_primary AND is_active AND project_id IS NOT NULL;
