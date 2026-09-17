-- `anon` could read every column of every profile, including account emails.
--
-- THE HOLE
-- `profiles` has RLS enabled with the policy "Public profiles are viewable by
-- everyone" — `USING (true)` — and the baseline granted `ALL` on the table to
-- `anon` (20240101000001_baseline_public_schema.sql:13302 and :17149). RLS is
-- ROW-level: it decides which rows you may see, never which COLUMNS. The two
-- together meant `anon` could read all 50 columns of all rows.
--
-- `anon` is not a secret. Its key ships inside the JavaScript bundle at
-- https://orangecat.ch by design, so "anon can read it" means "the whole
-- internet can read it, and can page through it". Measured against production
-- on 2026-09-17, before this migration: 87 profiles, 65 carrying a real account
-- email, plus 5 contact emails and 2 phone numbers — all enumerable with curl
-- and a key anyone can copy out of the page source.
--
-- WHY COLUMN GRANTS, AND WHY THE TABLE GRANT HAS TO GO FIRST
-- Column-level privileges are the only column-level mechanism Postgres has, and
-- a column-level REVOKE cannot subtract from a table-level grant: the table
-- grant is checked first and satisfies everything. The table grant has to be
-- revoked, then the allowed columns granted back. This is the same shape as
-- 20260802120000_wallets_select_lockdown, which locked `nwc_connection_uri` out
-- of the wallets table the same way.
--
-- WHY A DENYLIST, COMPUTED FROM THE LIVE CATALOG
-- The private set is named explicitly and everything else is derived from
-- information_schema at migration time, rather than writing out 47 allowed
-- column names. See the header of 20260917120000 for why an allowlist is the
-- wrong shape here: it fails closed but invisibly. A column added later is
-- public by default — the same default it has today — and anything genuinely
-- private is added to the list below, in the migration that creates it.
--
-- WHAT STAYS READABLE, DELIBERATELY
-- `bitcoin_address` and `lightning_address` remain world-readable. On a funding
-- platform a published payment address is the product, not a leak.
--
-- ORDER OF APPLICATION — this one goes LAST.
-- Apply 20260917120000 (the view), deploy the application, and only then apply
-- this. CD does not run migrations, so the two halves land at different times;
-- applying this before the code is deployed 404s every public profile page,
-- because the running code still does select('*') on the table. See the header
-- of 20260917120000.
--
-- SCOPE: `anon` only. `authenticated` keeps its table grant, so the owner's own
-- profile, the settings/edit flow and every withAuth route behave exactly as
-- before. That leaves a signed-in user still able to read every row's email —
-- a smaller hole than a key published in the page source, but a real one, and
-- it needs an owner-scoped design rather than a grant change. See the PR.

BEGIN;

-- 1. The three columns `anon` must not be able to read.
--    `email` is the account login address and is never public: the profile page
--    already nulls it for every non-owner (src/app/profiles/[username]/page.tsx).
--    `phone` and `contact_email` come back through public_profiles, which
--    honours the owner's hide list — see 20260917120000.
CREATE TEMPORARY TABLE private_profile_columns (column_name text PRIMARY KEY)
  ON COMMIT DROP;
INSERT INTO private_profile_columns (column_name)
VALUES ('email'), ('phone'), ('contact_email');

-- 2. Drop the table-wide SELECT, and any column-level SELECT left over from
--    earlier manual experimentation on this table, so that what remains is
--    exactly what step 3 grants and nothing else.
REVOKE SELECT ON TABLE public.profiles FROM anon;

DO $$
DECLARE
  col text;
BEGIN
  FOR col IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
  LOOP
    EXECUTE format('REVOKE SELECT (%I) ON TABLE public.profiles FROM anon', col);
  END LOOP;
END $$;

-- 3. Grant back SELECT on every column that is not private.
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(format('%I', c.column_name), ', ' ORDER BY c.ordinal_position)
  INTO cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'profiles'
    AND c.column_name NOT IN (SELECT column_name FROM private_profile_columns);

  EXECUTE format('GRANT SELECT (%s) ON TABLE public.profiles TO anon', cols);
END $$;

-- 4. Prove it, here, rather than trusting that the above did what it reads like.
--    A grant migration that silently no-ops looks identical to one that worked,
--    and .github/workflows/migration-replay.yml replays this file against a
--    fresh database on every PR that touches supabase/migrations — so these
--    assertions are the thing that stops the hole being reopened later.
DO $$
DECLARE
  missing int;
BEGIN
  IF has_column_privilege('anon', 'public.profiles', 'email', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'phone', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'contact_email', 'SELECT')
  THEN
    RAISE EXCEPTION 'anon still holds SELECT on a private profiles column';
  END IF;

  -- ...and every public column must still be readable, or public pages break.
  SELECT count(*) INTO missing
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
    AND c.column_name NOT IN (SELECT column_name FROM private_profile_columns)
    AND NOT has_column_privilege('anon', 'public.profiles', c.column_name, 'SELECT');

  IF missing > 0 THEN
    RAISE EXCEPTION 'anon lost SELECT on % public profile column(s)', missing;
  END IF;

  -- The view is what keeps the public pages working once the table is locked
  -- down; if it is missing, this migration would take the site down.
  IF NOT has_table_privilege('anon', 'public.public_profiles', 'SELECT') THEN
    RAISE EXCEPTION 'anon cannot read public_profiles — apply 20260917120000 first';
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
