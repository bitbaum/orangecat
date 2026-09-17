-- A system account's handle is not a leaked email address. Stop retiring it.
--
-- WHAT BROKE: scripts/rename-email-derived-usernames.sql retires every profile
-- where `username = split_part(email, '@', 1)`. That predicate is exactly right
-- for a person — it means their public, crawlable handle republishes their
-- email local part. It is exactly wrong for the Cat, because deriving the
-- handle from the address is HOW the Cat is created: cat-account.ts registers
-- `cat@orangecat.invalid` precisely so `handle_new_user` mints the handle
-- `cat`. So the retirement matched, and on 2026-08-26 21:58:59Z the Cat's
-- handle became `user_0234d5e38e66`.
--
-- The damage was total and silent. `@cat` is the platform's advertised
-- interface — it is in the Cat's own bio, in the composer placeholder, and in
-- the docs — and it resolves by username. With no profile named `cat`:
--
--   * every `@cat` in a message or under a post resolved to nobody, so nothing
--     was queued and the Cat answered nothing, for two days;
--   * ensureCatAccount() could not even repair it. It looked the Cat up BY
--     USERNAME, found nothing, tried to create the auth user, got "already
--     registered", looked again, still found nothing, and returned null —
--     permanently. Its self-healing was written for a DELETED profile and a
--     rename walks straight past it.
--
-- Nothing went red. The retirement is correct-by-design for people, the profile
-- still existed, /profiles/cat still 301'd through profile_username_history,
-- and health stayed 200.
--
-- WHY `.invalid` IS THE RIGHT LINE, and not a list of names to maintain:
-- RFC 2606 reserves `.invalid` for addresses that are guaranteed undeliverable.
-- An account there has no mailbox, so it has no owner and no correspondence,
-- so its local part cannot be anybody's personal information. That is the
-- actual property the retirement cares about — "this handle republishes a
-- person's email" — rather than a hardcoded 'cat', which would put a second
-- definition of the Cat's handle in SQL, to drift against
-- src/config/cat-identity.ts. Any future system identity gets this for free by
-- using a `.invalid` address, which it should be doing anyway.

-- 1. The counting function the nightly gate reads (check-data-invariants.mjs,
--    EMAIL_DERIVED_USERNAME_BASELINE = 0). Without this exclusion, putting the
--    Cat's handle back would take the count from 0 to 1 and turn the gate red
--    for a profile that is fine — which is how a gate teaches people to ignore
--    it.
CREATE OR REPLACE FUNCTION public.count_email_derived_usernames()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT count(*)::bigint
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.username = split_part(u.email, '@', 1)
    -- RFC 2606: undeliverable by definition, so there is no person and no leak.
    AND u.email NOT LIKE '%.invalid';
$$;

COMMENT ON FUNCTION public.count_email_derived_usernames() IS
  'How many profiles still publish their email local part as a public handle. Excludes RFC 2606 .invalid addresses, which have no mailbox and therefore no owner to expose. A ratchet for check-data-invariants.mjs: it may fall or hold, never rise.';

-- 2. Put back what the retirement should never have taken. Written as a
--    property of system accounts rather than as `username = 'cat'`, so it
--    repairs any system identity caught the same way and states no handle
--    literal of its own.
UPDATE public.profiles p
SET username = h.old_username,
    updated_at = now()
FROM public.profile_username_history h
JOIN auth.users u ON u.id = h.profile_id
WHERE h.profile_id = p.id
  AND u.email LIKE '%.invalid'
  AND p.username IS DISTINCT FROM h.old_username;

-- 3. Drop the history rows that claim a system handle is retired. Leaving them
--    would be a contradiction in the data — `cat` recorded as a former handle
--    of the very profile that currently holds it — and `old_username` is the
--    primary key, so a stale row would also block recording a real future
--    rename. Nothing is lost: history exists to keep OLD handles resolving, and
--    this handle is current again, so the direct lookup answers first.
DELETE FROM public.profile_username_history h
USING auth.users u
WHERE u.id = h.profile_id
  AND u.email LIKE '%.invalid';
