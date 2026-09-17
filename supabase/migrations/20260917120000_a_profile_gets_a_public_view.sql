-- `public_profiles`: what a logged-out visitor may read of a profile.
--
-- This migration is ADDITIVE and changes nothing about what anyone can already
-- read. It is deliberately separate from the migration that follows it
-- (20260917120100), which takes `anon`'s read access to the private columns
-- away. They are split because this repo's CD does not run migrations — the box
-- database is migrated by hand — so the schema and the code roll out at
-- different moments, and a single migration would break the site in whichever
-- order it was applied:
--
--   revoke first  -> the deployed code still does select('*') on the table,
--                    which now fails, and every public profile page 404s.
--   deploy first  -> the new code reads a view that does not exist yet,
--                    and every public profile page 404s.
--
-- So the safe cutover is: apply THIS migration, deploy the code, then apply
-- 20260917120100. Each step is individually safe, and after step 2 the site is
-- already reading the view, so step 3 takes nothing away from it.
--
-- WHY A VIEW RATHER THAN A COLUMN LIST IN THE APPLICATION
-- The alternative is to write out the allowed columns at each call site. That is
-- the mistake this codebase has already made once and documented: the comment on
-- SENSITIVE_PROFILE_FIELDS in src/services/profile/publicProfile.server.ts
-- rejected an allowlist because the typed schema drifts from production
-- (`background`, `inspiration_statement` and `location_context` are all real
-- columns an allowlist written from the types would silently have dropped). A
-- hand-written allowlist fails CLOSED but INVISIBLY — the next column someone
-- adds just stops appearing on public pages and nobody finds out. The view is
-- built from the live catalog, so it cannot drift on the day it is written, and
-- `select('*')` against it keeps working.
--
-- WHY phone AND contact_email ARE STILL HERE
-- They are not secrets the way the account email is: the product publishes them
-- on the profile page unless the owner hides them (HIDEABLE_PROFILE_FIELDS in
-- src/config/profile-privacy.ts). Blanket-revoking them would have deleted real,
-- opted-in content from live pages — measured on production 2026-09-17, four
-- profiles published a contact email and one a phone.
--
-- So they are re-exposed here with the owner's own choice applied IN SQL, the
-- same rule applyProfilePrivacy() applies in TypeScript. Until now that rule was
-- advisory: a profile that had hidden its phone was still readable straight off
-- the table by anyone holding the anon key, which made the privacy toggle
-- decorative. One profile was in exactly that position.
--
-- `email` is absent from the view entirely — the account login address is never
-- public, and the profile page already nulls it for every non-owner.
-- `privacy_settings` reads NULL, matching what applyProfilePrivacy already sends
-- to visitors.

BEGIN;

-- security_invoker = true (PG 15+; production runs 15.8) so this is not an RLS
-- bypass: the policies on `profiles` are still evaluated as the calling role.
-- Without it a view runs with its OWNER's rights, which is how a "public view"
-- quietly becomes a way around the very grants the next migration sets up.
DO $$
DECLARE
  cols text;
BEGIN
  SELECT string_agg(
    CASE
      -- The owner's per-field hide list, enforced by the database.
      WHEN c.column_name IN ('phone', 'contact_email', 'website', 'social_links')
        THEN format(
          'CASE WHEN COALESCE(p.privacy_settings->%L @> to_jsonb(%L::text), false)'
          ' THEN NULL ELSE p.%I END AS %I',
          'hidden_fields', c.column_name, c.column_name, c.column_name)
      WHEN c.column_name = 'privacy_settings'
        THEN format('NULL::jsonb AS %I', c.column_name)
      ELSE format('p.%I', c.column_name)
    END,
    E',\n  ' ORDER BY c.ordinal_position)
  INTO cols
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'profiles'
    AND c.column_name <> 'email';

  EXECUTE format(
    'CREATE OR REPLACE VIEW public.public_profiles'
    ' WITH (security_invoker = true) AS SELECT %s FROM public.profiles p', cols);
END $$;

COMMENT ON VIEW public.public_profiles IS
  'What a logged-out visitor may read of a profile: no account email, and '
  'phone/contact_email/website/social_links nulled when the owner listed them '
  'in privacy_settings.hidden_fields. anon reads this; authenticated callers '
  'that need the full row read public.profiles.';

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- The view must never carry the account email, however it was generated.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'public_profiles'
      AND column_name = 'email'
  ) THEN
    RAISE EXCEPTION 'public_profiles exposes the account email';
  END IF;
END $$;

COMMIT;

-- PostgREST caches the schema; without this the new view 404s until it reloads.
NOTIFY pgrst, 'reload schema';
