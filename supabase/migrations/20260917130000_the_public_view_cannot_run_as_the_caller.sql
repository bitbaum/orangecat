-- public_profiles was created with `security_invoker = true`. That is wrong
-- here, and it took the public profile pages down for real.
--
-- WHAT HAPPENED
-- 20260917120000 created the view with security_invoker = true, on the
-- reasoning that a view which runs as its owner is a way around RLS. True in
-- general — but it is exactly backwards for THIS view.
--
-- security_invoker = true means the view is evaluated with the CALLING role's
-- privileges on the underlying table. The whole point of 20260917120100 is that
-- `anon` no longer holds SELECT on profiles.email / .phone / .contact_email. So
-- the moment that revoke landed, `SELECT * FROM public_profiles` as anon tried
-- to read profiles.phone and profiles.contact_email to evaluate the masking
-- CASE expressions, and Postgres refused:
--
--     42501  permission denied for table profiles
--
-- Every /profiles/<username> page 404'd, because the page treats a failed
-- profile fetch as "no such profile".
--
-- It passed every check beforehand because the two halves were tested apart:
-- the view was probed while the table grant still existed, and the revoke was
-- dry-run in a transaction that rolled back before anything read the view as
-- anon. Neither test ever had BOTH halves in place at once — which is the only
-- state that reproduces it, and is the state production ended up in.
--
-- THE FIX
-- Owner rights (security_invoker = false, the default). The view then reads the
-- base table as its owner, the masking CASE evaluates, and `anon` needs nothing
-- on `profiles` beyond SELECT on the view itself. That is what makes a curated
-- public projection over a locked-down table work at all.
--
-- IS THAT AN RLS BYPASS? Yes, and deliberately so — bounded by two facts:
--   1. The only SELECT policy on profiles is "Public profiles are viewable by
--      everyone", `USING (true)`. There is no row filtering to lose. Verified
--      against production: the view returns the same row count as the table
--      did, 91 of 91.
--   2. The view's projection is the boundary instead: no `email` column at all,
--      and phone/contact_email/website/social_links nulled by the owner's
--      privacy_settings. A row being visible is not the same as its private
--      columns being visible.
-- The assertion at the bottom pins fact 1, so if anyone ever narrows that
-- policy, the next migration PR fails and this view gets revisited rather than
-- silently over-exposing. The two baseline timeline views on profiles already
-- run with owner rights for the same reason.

BEGIN;

ALTER VIEW public.public_profiles SET (security_invoker = false);

-- The gate that would have caught this: read the view AS anon, with the revoke
-- already in place. Nothing else in the suite exercises both halves together.
DO $$
DECLARE
  n int;
BEGIN
  SET LOCAL ROLE anon;
  SELECT count(*) INTO n FROM (SELECT * FROM public.public_profiles LIMIT 1) t;
  RESET ROLE;
EXCEPTION
  WHEN insufficient_privilege THEN
    RESET ROLE;
    RAISE EXCEPTION
      'anon cannot SELECT * from public_profiles — every profile page would 404';
END $$;

-- ...and anon must still not reach the private columns on the table itself.
DO $$
BEGIN
  IF has_column_privilege('anon', 'public.profiles', 'email', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'phone', 'SELECT')
     OR has_column_privilege('anon', 'public.profiles', 'contact_email', 'SELECT')
  THEN
    RAISE EXCEPTION 'anon regained SELECT on a private profiles column';
  END IF;
END $$;

-- Pin the assumption that makes owner rights safe here (see fact 1 above).
DO $$
DECLARE
  qual text;
BEGIN
  SELECT pg_get_expr(polqual, polrelid) INTO qual
  FROM pg_policy
  WHERE polrelid = 'public.profiles'::regclass
    AND polcmd = 'r'
    AND polname = 'Public profiles are viewable by everyone';

  IF qual IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'profiles SELECT policy is no longer USING(true) (now: %) — public_profiles '
      'runs with owner rights and would bypass the narrower rule; revisit it',
      COALESCE(qual, 'policy missing');
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
