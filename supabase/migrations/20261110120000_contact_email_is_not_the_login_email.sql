-- A member's sign-in email was published as their public Contact email.
--
-- The profile editor pre-filled the PUBLIC `contact_email` field with the
-- account's sign-in email (`contact_email || userEmail`), so any save of the
-- editor — uploading an avatar is enough — wrote the login address into the
-- public Contact block, readable signed out (QA 2026-11-10,
-- /profiles/user_82732e99fdc2). The editor is fixed in #1589; this clears
-- the rows it already wrote.
--
-- A member who typed their login address into Contact email on purpose loses
-- it and can add it back; one who never chose it stops being exposed. The
-- second matters more.

DO $$
DECLARE
  cleared integer;
BEGIN
  UPDATE public.profiles p
     SET contact_email = NULL
    FROM auth.users u
   WHERE u.id = p.id
     AND p.contact_email IS NOT NULL
     AND u.email IS NOT NULL
     AND lower(btrim(p.contact_email)) = lower(btrim(u.email));
  GET DIAGNOSTICS cleared = ROW_COUNT;
  RAISE NOTICE 'contact_email cleared where it equalled the sign-in email: % rows', cleared;
END
$$;
