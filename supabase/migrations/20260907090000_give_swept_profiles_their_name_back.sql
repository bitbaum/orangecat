-- Give the swept profiles their display name back, from the name they gave us.
--
-- WHAT BROKE. scripts/rename-email-derived-usernames.sql, run 2026-08-26
-- 21:58:59Z, did two correct things in an order that made them wrong together:
--
--   1. UPDATE profiles SET username = 'user_' || left(hex(id), 12)
--   2. UPDATE profiles SET name = NULL   -- where name was the email local part
--
-- Both are right. A handle that republishes someone's email local part is a
-- leak on a crawlable page, and a display name quietly set to the same string
-- is that leak wearing another label. The script says so, and clears the name
-- rather than inventing a placeholder, justified like this:
--
--     "NULL rather than a placeholder: the UI already falls back to the
--      handle, and inventing a name for someone is worse than showing none."
--
-- That sentence was true when it was written and false by the time it ran.
-- Step 1 had just replaced the handle it refers to with twelve hex characters.
-- The two halves of one script invalidated each other's assumption, so a person
-- ended up with no name AND no readable handle: `user_a3eaa53c23cd`.
--
-- 72 of 99 profiles matched the predicate (measured in 20260826130000), so this
-- is most of the user base rendering as hex to each other in every message
-- thread, mention and profile card. Nothing went red. The sweep is
-- correct-by-design, the rows still exist, and health stayed 200 — the same
-- silence that hid the Cat's two-day outage from the identical sweep
-- (20260828070000).
--
-- WHAT THIS DOES. Restores `name` from the display name the user gave their
-- OAuth provider — `raw_user_meta_data->>'full_name'`, else `->>'name'`.
--
-- That is not a new source of truth invented here: it is EXACTLY what
-- handle_new_user() has used for every signup since 20260826130000. Accounts
-- created before that trigger existed never had it applied, which is the whole
-- reason they fell back to the email in the first place. This is parity, not a
-- policy change — new users already get this, old users are getting what they
-- would have got had they signed up a week later.
--
-- WHAT IT DELIBERATELY DOES NOT DO:
--
--   * It does not restore usernames. profile_username_history holds them, and
--     they are the leak. Reversing the sweep would re-publish the addresses.
--   * It never writes a name equal to the email local part, under any path —
--     that is the exact string the sweep removed, and re-deriving it from a
--     different column would smuggle the leak back in through metadata.
--     Some providers set `name` to the address when the user gave no name.
--   * It does not touch a profile that already has a name. A user who has since
--     chosen one must not be overwritten by stale provider metadata.
--   * It invents nothing. A profile whose provider metadata carries no usable
--     name keeps NULL and still shows its handle; the honest fix for those is
--     to ask, not to guess. See the follow-up note at the end.

DO $$
DECLARE
  restored int;
  remaining int;
BEGIN
  WITH candidate AS (
    SELECT
      p.id,
      NULLIF(TRIM(COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name'
      )), '') AS provider_name,
      split_part(u.email, '@', 1) AS email_local
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.name IS NULL OR TRIM(p.name) = ''
  )
  UPDATE public.profiles p
  SET name = c.provider_name,
      updated_at = now()
  FROM candidate c
  WHERE c.id = p.id
    AND c.provider_name IS NOT NULL
    -- The guard that keeps this from undoing the sweep. Case-insensitive:
    -- "Adelina" and "adelina" are the same leak.
    AND lower(c.provider_name) <> lower(c.email_local);

  GET DIAGNOSTICS restored = ROW_COUNT;

  SELECT count(*) INTO remaining
  FROM public.profiles
  WHERE (name IS NULL OR TRIM(name) = '')
    AND username LIKE 'user\_%';

  RAISE NOTICE 'display names restored from provider metadata: %', restored;
  RAISE NOTICE 'profiles still nameless behind a user_<hex> handle: %', remaining;
  RAISE NOTICE 'those % cannot be repaired from data we hold — they must be asked.', remaining;
END $$;

-- FOLLOW-UP, deliberately not done in SQL: every profile still counted by
-- `remaining` above renders as hex to other humans. The fix is a prompt on next
-- sign-in asking for a display name, seeded from nothing and skippable. That is
-- a product surface, not a schema change, and a migration that silently
-- invented names for real people would repeat the mistake this one repairs.

-- The detection half, so the leak cannot come back through the door this
-- migration just opened.
--
-- count_email_derived_usernames() watches handles. Nothing watched NAMES, and
-- the name is the same leak wearing another label — which is precisely why the
-- sweep cleared it. Now that a write path exists which sets `name` from
-- provider metadata, and some providers put the address in that field, the
-- guard above needs a gate behind it: a predicate is only as good as the next
-- person who writes to the column.
--
-- Same shape as its sibling: SECURITY DEFINER because auth.users is not
-- reachable through PostgREST, service_role only so nothing user-facing can
-- enumerate it, and a COUNT rather than rows — a list of "profiles whose
-- display name is their email prefix" is exactly what must not be published.
CREATE OR REPLACE FUNCTION public.count_email_derived_names()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::bigint
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.name IS NOT NULL
    AND lower(TRIM(p.name)) = lower(split_part(u.email, '@', 1))
    AND u.email NOT LIKE '%.invalid';
$$;

REVOKE ALL ON FUNCTION public.count_email_derived_names() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_email_derived_names() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.count_email_derived_names() TO service_role;

COMMENT ON FUNCTION public.count_email_derived_names() IS
  'How many profiles publish their email local part as a display NAME - the same leak count_email_derived_usernames() watches, one column over. A ratchet for check-data-invariants.mjs: may fall or hold, never rise.';
