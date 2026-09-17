-- A rename has to record the handle it retired.
--
-- profile_username_history (20260826160000) is what makes renaming an account
-- safe: /profiles/<old> 301s to the new handle, and <old>@orangecat.ch keeps
-- resolving through it. But the only thing that ever wrote a row there was the
-- one-off admin script scripts/rename-email-derived-usernames.sql.
--
-- The product's own rename path recorded nothing. PUT /api/profile accepts a
-- new username from any signed-in user — the profile editor has an editable
-- handle field — checks it is not taken, and UPDATEs profiles.username. No
-- history row. So a user who renamed themselves got precisely the breakage this
-- table exists to prevent: the old profile URL 404s, and the Lightning address
-- <old>@orangecat.ch stops resolving. Silently, on both counts. A payment sent
-- to the address they had published simply does not arrive, and nobody — not
-- the sender, not the recipient, not us — sees an error.
--
-- WHY THE TRIGGER AND NOT THE ROUTE. A username here is a payment identifier,
-- so "a rename is recorded" has to hold for every writer: this route, the SQL
-- scripts in this repo, a psql session someone opens on the box, and whatever
-- path gets written next. Those are many places to remember one rule. There is
-- exactly one place a username can change — an UPDATE on this table — so the
-- rule belongs there, where it cannot be bypassed by a caller that never heard
-- of it. Fixing only the route would leave the same bug one new caller away.

CREATE OR REPLACE FUNCTION public.profiles_username_rename_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  retired_owner uuid;
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;

  -- A write that leaves the handle alone is not a rename. The app saves the
  -- whole profile on every edit, so this fires on bio edits too; without this
  -- the row's own handle would be recorded as retired while it is still live.
  IF TG_OP = 'UPDATE' AND NOT (NEW.username IS DISTINCT FROM OLD.username) THEN
    RETURN NEW;
  END IF;

  -- A handle another account retired is not free to take. The lookup order is
  -- what makes this dangerous rather than untidy: the profile page and the
  -- LNURL endpoint both resolve the live profiles table FIRST and only fall
  -- back to history on a miss. So whoever holds the handle live intercepts
  -- everything still pointing at its previous owner — including payments to
  -- their saved Lightning address. 20260826160000 named this risk in a comment
  -- ("re-issuing it to somebody else would silently redirect the first person's
  -- payments to the second") and nothing enforced it: availability was checked
  -- against profiles alone, so a retired handle read as free.
  SELECT profile_id INTO retired_owner
  FROM public.profile_username_history
  WHERE old_username = lower(btrim(NEW.username));

  IF retired_owner IS NOT NULL AND retired_owner <> NEW.id THEN
    RAISE EXCEPTION 'username "%" was retired by another account and cannot be reissued', NEW.username
      USING ERRCODE = 'unique_violation';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.username IS NOT NULL THEN
    -- ON CONFLICT DO NOTHING covers a handle retired twice by the same account
    -- (a -> b -> a -> b). The row already maps it to this profile, and the
    -- guard above means it cannot belong to anyone else.
    INSERT INTO public.profile_username_history (old_username, profile_id)
    VALUES (lower(btrim(OLD.username)), NEW.id)
    ON CONFLICT (old_username) DO NOTHING;
  END IF;

  -- Taking back your own retired handle makes it live again, so it must stop
  -- being listed as retired: a row saying "this handle used to be theirs" is
  -- false once it is theirs again. Runs after the INSERT above so that a
  -- case-only change (Mao -> mao) nets out to no row, which is right — nothing
  -- was retired, the two forms resolve to the same lowercase handle.
  DELETE FROM public.profile_username_history
  WHERE old_username = lower(btrim(NEW.username))
    AND profile_id = NEW.id;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_username_rename_guard() IS
  'Records the old handle in profile_username_history on every rename, and refuses a handle another account retired. On profiles.username because that is the one place a username changes.';

DROP TRIGGER IF EXISTS profiles_username_rename_guard ON public.profiles;
CREATE TRIGGER profiles_username_rename_guard
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_username_rename_guard();
