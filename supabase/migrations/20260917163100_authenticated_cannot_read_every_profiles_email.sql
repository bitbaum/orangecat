-- A signed-in user could read every profile's account email.
--
-- THE HOLE
-- 20260917120100 revoked the private profile columns from `anon` and said in
-- its own footer what it had not closed:
--
--     SCOPE: `anon` only. `authenticated` keeps its table grant, so [...] a
--     signed-in user [is] still able to read every row's email — a smaller hole
--     than a key published in the page source, but a real one.
--
-- "Smaller" turned out to be one HTTP request wide. Signup on this deployment
-- is open and auto-confirming (GOTRUE_DISABLE_SIGNUP=false,
-- GOTRUE_MAILER_AUTOCONFIRM=true), so POST /auth/v1/signup returns a usable
-- `authenticated` token immediately — no mailbox, no approval, no human in the
-- loop. Measured against production on 2026-09-17 from an account created that
-- way, seconds earlier:
--
--     profiles readable ............ 95
--     ... with an account email ..... 73
--     ... with a phone .............. 2
--     ... with a contact email ...... 5
--     select=* on every row ......... 200 OK
--
-- Same data the anon fix closed; the door just needed opening first.
--
-- WHY A GRANT CHANGE ALONE WAS NOT ENOUGH
-- Column privileges belong to a ROLE, and every signed-in user is the same role.
-- There is no grant that means "your own row", so this revoke also takes the
-- owner's email, phone and contact email away from the owner — who reads them
-- on their own Info tab and edits them in the profile editor. That is why this
-- migration is second: 20260917163000 added `own_profile`, a view scoped to
-- auth.uid() that gives the owner their own row back, and the application was
-- deployed reading it BEFORE this file revokes anything.
--
-- ORDER OF APPLICATION — this one goes LAST, in a LATER deploy.
-- scripts/deploy-selfhost.sh applies pending migrations BEFORE it swaps the new
-- release in (line ~128, deliberately: the schema must be ready before the code
-- that needs it goes live). That order is right in general and wrong for a
-- revoke: shipping this in the same deploy as the code would take the columns
-- away while the PREVIOUS release — which still reads them — is the one being
-- served, for the length of a build, a boot test and a health check. That is
-- not hypothetical; it is what happened on 2026-09-17 when the anon half landed
-- with its code, and every profile page 404'd until 20260917130000 undid it.
-- So: PR one ships 20260917163000 + the application change; PR two ships this,
-- once the first is deployed and verified.
--
-- WHAT STAYS READABLE, DELIBERATELY
-- Everything else, including `bitcoin_address` and `lightning_address` — on a
-- funding platform a published payment address is the product, not a leak. And
-- `phone` / `contact_email` still reach visitors through `public_profiles`,
-- which applies the owner's own privacy_settings.hidden_fields in SQL. This
-- migration removes the raw table read, not the published field.

BEGIN;

-- 1. The three columns no client role may read off the table.
CREATE TEMPORARY TABLE private_profile_columns (column_name text PRIMARY KEY)
  ON COMMIT DROP;
INSERT INTO private_profile_columns (column_name)
VALUES ('email'), ('phone'), ('contact_email');

-- 2. Drop the table-wide SELECT, then every column-level SELECT. A column-level
--    REVOKE cannot subtract from a table-level GRANT — the table grant is
--    checked first and satisfies everything — so the table grant has to go and
--    the allowed columns be granted back. Same shape as 20260917120100 for
--    `anon` and 20260802120000 for the wallets secret.
REVOKE SELECT ON TABLE public.profiles FROM authenticated;

DO $$
DECLARE
  col text;
BEGIN
  FOR col IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
  LOOP
    EXECUTE format('REVOKE SELECT (%I) ON TABLE public.profiles FROM authenticated', col);
  END LOOP;
END $$;

-- 3. Grant back SELECT on every column that is not private. Computed from the
--    live catalog rather than written out, so a column added later is public by
--    default — the same default it has today — and anything genuinely private
--    is added to the list in step 1 by the migration that creates it.
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

  EXECUTE format('GRANT SELECT (%s) ON TABLE public.profiles TO authenticated', cols);
END $$;

-- 4. Neither client role may reach the private columns on the table.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF has_column_privilege(r, 'public.profiles', 'email', 'SELECT')
       OR has_column_privilege(r, 'public.profiles', 'phone', 'SELECT')
       OR has_column_privilege(r, 'public.profiles', 'contact_email', 'SELECT')
    THEN
      RAISE EXCEPTION '% still holds SELECT on a private profiles column', r;
    END IF;
  END LOOP;
END $$;

-- 5. ...and every public column must still be readable, or signed-in pages break.
DO $$
DECLARE
  missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'profiles'
    AND c.column_name NOT IN (SELECT column_name FROM private_profile_columns)
    AND NOT has_column_privilege('authenticated', 'public.profiles', c.column_name, 'SELECT');

  IF missing > 0 THEN
    RAISE EXCEPTION 'authenticated lost SELECT on % public profile column(s)', missing;
  END IF;
END $$;

-- 6. THE CHECK THAT WAS MISSING LAST TIME.
--    Read the owner's view AS `authenticated`, with the revoke already in place,
--    naming a real user — both halves at once, in one transaction. The anon half
--    of this work passed every check beforehand and still took the site down,
--    because the view was probed while the table grant still existed and the
--    revoke was dry-run in a transaction that never read the view. Neither test
--    ever had both halves in place, which is the only state that reproduces it
--    and the state production ended up in.
--
--    This is what proves `own_profile` runs with OWNER rights: if it were
--    security_invoker, it would have to read profiles.email as the caller — who
--    just lost that privilege two statements ago — and fail with 42501, taking
--    the Info tab, the profile editor and the account export with it.
DO $$
DECLARE
  target uuid;
  got    uuid;
  n      int;
BEGIN
  SELECT id INTO target FROM public.profiles ORDER BY created_at LIMIT 1;
  IF target IS NULL THEN
    RAISE NOTICE 'no profiles to assert the owner path against, skipping';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', target)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.own_profile;
  SELECT id INTO got FROM public.own_profile;
  RESET ROLE;

  IF n <> 1 OR got IS DISTINCT FROM target THEN
    RAISE EXCEPTION
      'own_profile returned % row(s) for its owner after the revoke (expected 1)', n;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE EXCEPTION
      'authenticated cannot read own_profile after the revoke — the owner would '
      'lose their own email, phone and contact email. Is the view still '
      'security_invoker? See 20260917130000.';
END $$;

-- 7. A signed-in user must still be able to read OTHER people through the public
--    view, or every profile page breaks for exactly the people who are logged in.
DO $$
DECLARE
  n int;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM (SELECT * FROM public.public_profiles LIMIT 1) t;
  RESET ROLE;
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE EXCEPTION
      'authenticated cannot SELECT * from public_profiles — every profile page '
      'would 404 for signed-in visitors';
END $$;

-- 8. And the table itself must still be readable for its public columns, which
--    is what every username lookup, people picker and mention resolver does.
DO $$
DECLARE
  n int;
BEGIN
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM (SELECT id, username, name FROM public.profiles LIMIT 1) t;
  RESET ROLE;
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE EXCEPTION 'authenticated lost the public columns of profiles';
END $$;

-- 9. No OTHER view may reach a private column with the caller's own rights.
--    A view declared `security_invoker = true` evaluates against the caller's
--    grants, so one that joins profiles and selects an email would simply stop
--    working for every signed-in user the moment this migration lands — the
--    same failure mode as 20260917130000, one level of indirection away and
--    correspondingly harder to spot.
--
--    Checked against production before writing this: `public` holds five views
--    over profiles. `conversation_details` and `message_details` are
--    security_invoker, and both select only id / username / name / avatar_url.
--    `public_profiles` does read phone and contact_email, and is precisely the
--    one that runs with owner rights. This assertion pins that arrangement so
--    the next view to join profiles has to make the same choice deliberately.
DO $$
DECLARE
  offender text;
BEGIN
  SELECT string_agg(c.relname, ', ')
  INTO offender
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('v', 'm')
    AND n.nspname = 'public'
    AND 'security_invoker=true' = ANY (COALESCE(c.reloptions, '{}'))
    AND pg_get_viewdef(c.oid) ~* '\mprofiles\M'
    AND pg_get_viewdef(c.oid) ~* '\m(email|phone|contact_email)\M';

  IF offender IS NOT NULL THEN
    RAISE EXCEPTION
      'security_invoker view(s) read a private profiles column and will break '
      'for every signed-in user: %. Give the view owner rights (and a narrow '
      'projection), or drop the column from it.', offender;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
