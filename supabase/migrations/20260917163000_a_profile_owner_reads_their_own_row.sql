-- `own_profile`: the caller's OWN profile row, private columns included.
--
-- WHY THIS EXISTS
-- 20260917120100 took the private profile columns away from `anon`, and the
-- note at the bottom of that file named what it deliberately left open:
--
--     SCOPE: `anon` only. `authenticated` keeps its table grant, so [...] a
--     signed-in user [is] still able to read every row's email — a smaller hole
--     than a key published in the page source, but a real one, and it needs an
--     owner-scoped design rather than a grant change.
--
-- Measured against production on 2026-09-17, from an account registered thirty
-- seconds earlier through the public signup endpoint (signup is open and
-- auto-confirms, so this costs one HTTP request and no human review): 95
-- profiles readable, 73 of them carrying an account login email, plus 5 contact
-- emails and 2 phone numbers. `select=*` returned every column of every row.
-- That is the same data the anon fix closed, behind a door anybody can open.
--
-- WHY A GRANT CHANGE ALONE CANNOT FIX IT
-- Column privileges are granted to a ROLE, and every signed-in user is the same
-- role — `authenticated`. There is no column grant that means "your own row",
-- so revoking email/phone/contact_email from `authenticated` also takes them
-- from the owner, who legitimately reads and edits them: the registration email
-- on the Info tab, and the phone / contact email that seed the profile editor.
-- The owner needs a path that is scoped by ROW, which is what this view is.
--
-- WHY A VIEW RATHER THAN A SECURITY DEFINER FUNCTION
-- Same reasoning as 20260917120000, and now also consistency: the callers are
-- PostgREST `.from(...).select(...)` chains, so a view is a one-word change at
-- each call site, while an RPC would need a hand-maintained return type per
-- caller — the drift this table has already been bitten by. The column list is
-- built from the live catalog for the same reason: a column added later appears
-- here automatically instead of silently vanishing from the owner's own view of
-- their profile.
--
-- WHY OWNER RIGHTS (security_invoker = false)
-- The point of this view is to be readable when the caller's own grants are
-- NOT sufficient — after the follow-up migration, `authenticated` will hold no
-- SELECT on profiles.email. With security_invoker = true the view would be
-- evaluated with the caller's privileges and fail exactly when it is needed.
-- That is not a theoretical concern: it is what took every profile page down on
-- 2026-09-17 and had to be undone by 20260917130000.
--
-- IS OWNER RIGHTS SAFE HERE? The projection is the whole row, so the boundary
-- is not the column list this time — it is the WHERE clause. `auth.uid()` reads
-- the JWT claims PostgREST sets per request; it does not depend on the
-- executing role, so it keeps working under owner rights. When there is no JWT
-- it is NULL, `p.id = NULL` is never true, and the view returns nothing. There
-- is no argument to this view and no way to ask it for somebody else's row.
--
-- security_barrier = true because the filter IS the security boundary: without
-- it the planner may evaluate a caller-supplied qual (PostgREST turns query
-- parameters into WHERE clauses) against rows this view has not yet filtered
-- out, and a non-leakproof operator could then report on a row the caller may
-- not see. The view returns at most one row by primary key, so blocking that
-- pushdown costs nothing.
--
-- THIS MIGRATION IS ADDITIVE. It takes nothing away from anyone; it only adds a
-- second, narrower way to read what `authenticated` can already read. It has to
-- land, and the code that reads it has to be deployed, BEFORE the grants are
-- revoked — see the header of the follow-up migration for why that order is
-- forced.

BEGIN;

DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(format('p.%I', c.column_name), E',\n  ' ORDER BY c.ordinal_position)
  INTO cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'profiles';

  EXECUTE format(
    'CREATE OR REPLACE VIEW public.own_profile'
    ' WITH (security_invoker = false, security_barrier = true)'
    ' AS SELECT %s FROM public.profiles p WHERE p.id = auth.uid()', cols);
END $$;

COMMENT ON VIEW public.own_profile IS
  'The calling user''s own profile row, all columns, private ones included. '
  'Scoped by auth.uid(), so it returns at most one row and never anyone '
  'else''s. Read this wherever a signed-in user needs their own email, phone '
  'or contact_email; read public_profiles for anybody else.';

GRANT SELECT ON public.own_profile TO anon, authenticated;

-- 1. The view must carry the private columns — that is the entire point, and a
--    catalog-built column list that quietly lost one would leave the owner
--    unable to see their own contact details with no error anywhere.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.column_name, ', ')
  INTO missing
  FROM (VALUES ('email'), ('phone'), ('contact_email')) AS c(column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns v
    WHERE v.table_schema = 'public' AND v.table_name = 'own_profile'
      AND v.column_name = c.column_name
  );

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'own_profile is missing the private column(s): %', missing;
  END IF;
END $$;

-- 2. ...and every other column too, so the owner's view of their own profile
--    cannot drift away from the table it mirrors.
DO $$
DECLARE
  missing int;
BEGIN
  SELECT count(*) INTO missing
  FROM information_schema.columns t
  WHERE t.table_schema = 'public' AND t.table_name = 'profiles'
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns v
      WHERE v.table_schema = 'public' AND v.table_name = 'own_profile'
        AND v.column_name = t.column_name
    );

  IF missing > 0 THEN
    RAISE EXCEPTION 'own_profile is missing % profiles column(s)', missing;
  END IF;
END $$;

-- 3. With no JWT there is no owner, so the view must be empty — for BOTH client
--    roles. This is the assertion that would fail if someone ever dropped the
--    WHERE clause, which is the only thing standing between this view and
--    handing every profile's email to anyone who can reach PostgREST.
DO $$
DECLARE
  n int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM public.own_profile;
  RESET ROLE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'own_profile returned % row(s) to an anonymous caller', n;
  END IF;

  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.own_profile;
  RESET ROLE;
  IF n <> 0 THEN
    RAISE EXCEPTION 'own_profile returned % row(s) with no JWT', n;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE EXCEPTION 'a client role cannot SELECT from own_profile at all';
END $$;

-- 4. The positive half: with a JWT naming a real user, the view returns exactly
--    that user's row and nobody else's. Skipped when there are no profiles to
--    name — .github/workflows/migration-replay.yml replays this file against an
--    empty database, where steps 1-3 are still meaningful but this one has
--    nothing to assert on. On a populated database (production) it runs, and it
--    is the only check here that proves auth.uid() is actually readable from
--    inside a view running with OWNER rights rather than the caller's.
DO $$
DECLARE
  target uuid;
  got    uuid;
  n      int;
BEGIN
  SELECT id INTO target FROM public.profiles ORDER BY created_at LIMIT 1;
  IF target IS NULL THEN
    RAISE NOTICE 'own_profile: no profiles to assert against, skipping the owner check';
    RETURN;
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', target)::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO n FROM public.own_profile;
  SELECT id INTO got FROM public.own_profile;
  RESET ROLE;

  IF n <> 1 OR got IS DISTINCT FROM target THEN
    RAISE EXCEPTION
      'own_profile returned % row(s) for a named owner (expected exactly their own)', n;
  END IF;
END $$;

COMMIT;

-- PostgREST caches the schema; without this the new view 404s until it reloads.
NOTIFY pgrst, 'reload schema';
