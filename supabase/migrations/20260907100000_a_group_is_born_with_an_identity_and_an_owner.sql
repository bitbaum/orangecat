-- A group is born with an identity and an owner.
--
-- Two things every group must have, and neither was guaranteed:
--
-- 1. AN ACTOR. `public.actors` is the polymorphic owner layer — entity tables
--    FK to actors(id), and "Create this on behalf of <my company>" resolves a
--    group actor before it can insert anything. Nothing in the application has
--    ever inserted one for a group: not `createGroup`
--    (src/services/groups/mutations/groups.ts), not Cat's
--    `create_organization`, not a trigger, not a backfill. The only
--    INSERT INTO public.actors in the schema is the baseline's, and it makes
--    *user* actors.
--
--    Production 2026-09-07: 9 groups, 3 group actors — all three from December
--    2025. Every group created since 2026-01-05 could not own an entity, could
--    not be picked as an owner, and could not receive funds.
--
-- 2. A FOUNDER. Both DELETE policies on `groups` ("Founders can delete groups"
--    and `groups_delete_auth`) require
--    `get_user_group_role(id, auth.uid()) = 'founder'`. `createGroup` inserts
--    that membership as a SECOND statement after the group row and treats
--    failure as `logger.warn`, still returning `{ success: true }`. A failed
--    insert therefore yields a group that exists, has a `created_by`, has no
--    members, and can be deleted by nobody — not its creator, not an admin.
--
--    Production 2026-09-07: 3 of 9 groups have ZERO memberships ("Bitcoin
--    Education Foundation", "Network State Community", "Bitcoin Developers
--    Circle"), all created by the same user.
--
--    Correction to ADR-0004 as first written: the cause is this swallowed
--    insert, NOT Cat's `create_organization` writing `role: 'admin'`.
--    Production contains ZERO memberships with role='admin' — all six are
--    'founder'. The counts coincided at 3, which made an untested mechanism
--    look confirmed. That 'admin' literal is still wrong and is corrected in
--    the same change, but it is a latent defect that has never fired.
--
-- Both belong in the database. Two independent code paths create groups today
-- and both forgot; a third would forget too. Doing it in an AFTER INSERT
-- trigger also makes both rows part of the same transaction as the group
-- itself, which a second application statement can never be.

-- One actor per group: gives the trigger a well-defined conflict target and
-- makes a duplicate impossible rather than merely unlikely.
CREATE UNIQUE INDEX IF NOT EXISTS actors_group_id_unique
  ON public.actors (group_id)
  WHERE actor_type = 'group';

-- SECURITY DEFINER because the caller is the creating user, and the INSERT
-- policy on `actors` requires the group to already appear in that user's
-- `group_members` — which is not yet true at AFTER INSERT time on `groups`.
-- The function takes no caller-supplied input: it reads NEW.id and
-- NEW.created_by only.
CREATE OR REPLACE FUNCTION public.group_gets_an_identity_and_an_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.actors (actor_type, group_id)
  VALUES ('group', NEW.id)
  ON CONFLICT DO NOTHING;

  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'founder')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS groups_get_an_identity_and_an_owner ON public.groups;
CREATE TRIGGER groups_get_an_identity_and_an_owner
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.group_gets_an_identity_and_an_owner();

-- Backfill: the six groups with no actor.
INSERT INTO public.actors (actor_type, group_id)
SELECT 'group', g.id
FROM public.groups g
WHERE NOT EXISTS (
  SELECT 1
  FROM public.actors a
  WHERE a.group_id = g.id
    AND a.actor_type = 'group'
)
ON CONFLICT DO NOTHING;

-- Backfill: the three groups nobody can delete. Only groups with NO members at
-- all are touched — this never overrides an existing role, and never invents a
-- founder for a group that deliberately has other members.
INSERT INTO public.group_members (group_id, user_id, role)
SELECT g.id, g.created_by, 'founder'
FROM public.groups g
WHERE g.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.group_members m
    WHERE m.group_id = g.id
  )
ON CONFLICT (group_id, user_id) DO NOTHING;
