-- A bar is an organization with a front door, and its events happen there.
--
-- 1. groups.street_address / postal_code / latitude / longitude — a group knew
--    WHICH locality it belongs to (20260928120000) but not where its door is.
--    A venue (a bar, a club, a hall) is found by its door: the page shows the
--    address and a map pin, and an event held there inherits both. All
--    optional; the place-bound rules for towns and local funds are unchanged.
--
-- 2. events.venue_group_id — the organization whose place the event is at.
--    The event keeps its own venue_* text and pin (an event can be at a place
--    with no page), and gains a link when the place has one. ON DELETE SET
--    NULL: a closed venue page must not delete the history of what happened
--    there.
--
-- 3. Who may list an event at a venue: its members. Otherwise anyone could
--    pin their event to a bar's page. Enforced by trigger, so the form, the
--    API and the Cat all meet the same rule; a write with no signed-in user
--    (service role, migrations) is a system write and passes.
--
-- Rollback: DROP TRIGGER events_venue_requires_membership ON public.events;
--   DROP FUNCTION public.events_venue_requires_membership();
--   ALTER TABLE public.events DROP COLUMN venue_group_id;
--   ALTER TABLE public.groups DROP COLUMN street_address, DROP COLUMN postal_code,
--     DROP COLUMN latitude, DROP COLUMN longitude;

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS latitude numeric(10,8),
  ADD COLUMN IF NOT EXISTS longitude numeric(11,8);

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_street_address_length;
ALTER TABLE public.groups ADD CONSTRAINT groups_street_address_length CHECK (
  (street_address IS NULL OR char_length(street_address) BETWEEN 1 AND 200)
  AND (postal_code IS NULL OR char_length(postal_code) BETWEEN 1 AND 20)
);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_venue_group ON public.events (venue_group_id, start_date)
  WHERE venue_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.events_venue_requires_membership()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.venue_group_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.venue_group_id IS DISTINCT FROM OLD.venue_group_id)
     AND auth.uid() IS NOT NULL
     AND NOT public.is_group_member(NEW.venue_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only members of a venue can list events there'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_venue_requires_membership ON public.events;
CREATE TRIGGER events_venue_requires_membership
  BEFORE INSERT OR UPDATE OF venue_group_id ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_venue_requires_membership();
