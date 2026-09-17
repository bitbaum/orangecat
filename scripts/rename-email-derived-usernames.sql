-- Retire the handles that publish someone's email address.
--
-- WHAT: every profile whose public username is exactly its owner's email local
-- part gets a neutral `user_<12 hex>` handle, and any display name that is also
-- the email local part is cleared. The old handle is recorded in
-- profile_username_history first, so:
--
--   * /profiles/<old> keeps working — it 301s to the new handle
--   * <old>@orangecat.ch keeps working — LNURL resolves through history
--
-- That is the whole reason this is safe to run. A username here is a payment
-- identifier, not just a label; without the history row this script would
-- silently break saved Lightning addresses and every inbound link, and nobody
-- would find out until a payment failed to arrive.
--
-- NOT a migration on purpose. It rewrites rows for real accounts, so it is a
-- deliberate operation someone runs and checks, not something that rides along
-- with a deploy. (apply-schema.sh would refuse it anyway — see the destructive
-- guard.)
--
-- DRY RUN first — this prints what would change and touches nothing:
--
--   sudo docker exec supabase-db psql -U postgres -c "
--     SELECT p.username AS old_handle,
--            'user_' || left(replace(p.id::text,'-',''),12) AS new_handle,
--            (p.name = split_part(u.email,'@',1)) AS name_also_leaks
--     FROM public.profiles p JOIN auth.users u ON u.id = p.id
--     WHERE p.username = split_part(u.email,'@',1)
--       AND u.email NOT LIKE '%.invalid' ORDER BY 1;"
--
-- THEN:  sudo docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 \
--          -f - < scripts/rename-email-derived-usernames.sql
--
-- REVERSIBLE: profile_username_history holds the old handle for every row this
-- touches, so `UPDATE profiles SET username = h.old_username FROM
-- profile_username_history h WHERE h.profile_id = profiles.id` puts them back.
--
-- SYSTEM ACCOUNTS ARE EXCLUDED (`.invalid`, RFC 2606). Learned the hard way:
-- the first run retired the Cat. Deriving the handle from the address is HOW
-- the Cat is created — cat-account.ts registers `cat@orangecat.invalid` so that
-- handle_new_user mints `cat` — so it matched the predicate perfectly while
-- leaking nothing, and `@cat` resolved to nobody for two days. An undeliverable
-- address has no mailbox, so no owner, so no personal information in its local
-- part. See 20260828070000_system_accounts_keep_their_handles.sql.

BEGIN;

-- Record first. If this half fails the rename never happens, which is the
-- correct order: a renamed profile with no history row is a dangling payment
-- address.
INSERT INTO public.profile_username_history (old_username, profile_id)
SELECT lower(p.username), p.id
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.username = split_part(u.email, '@', 1)
  AND u.email NOT LIKE '%.invalid'
ON CONFLICT (old_username) DO NOTHING;

-- Same shape as handle_new_user() and neutralUsernameFor(); see
-- 20260826130000. A uuid-derived handle cannot collide, so the unique index
-- cannot abort this.
UPDATE public.profiles p
SET username = 'user_' || left(replace(p.id::text, '-', ''), 12),
    updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND p.username = split_part(u.email, '@', 1)
  AND u.email NOT LIKE '%.invalid';

-- A display name set to the email local part is the same leak wearing another
-- label. NULL rather than a placeholder: the UI already falls back to the
-- handle, and inventing a name for someone is worse than showing none.
UPDATE public.profiles p
SET name = NULL,
    updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND p.name = split_part(u.email, '@', 1)
  AND u.email NOT LIKE '%.invalid';

COMMIT;
