-- A concert is an event type, not "Other".
--
-- "Konzert heute Abend in der Roten Fabrik" (2026-10-07) had to be filed under
-- Other, with Music as a category, because events_event_type_check listed
-- meetup, conference, workshop, party, exhibition, festival, retreat and other
-- — and a concert is the thing people most often make here. The list in
-- src/config/events.ts → EVENT_TYPES is the one the form, the Cat and the
-- validation read; this keeps the table's own rule equal to it.
--
-- Rollback: ALTER TABLE public.events DROP CONSTRAINT events_event_type_check;
-- ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK
-- (event_type = ANY (ARRAY['meetup','conference','workshop','party',
-- 'exhibition','festival','retreat','other'])); — after moving any 'concert'
-- rows to 'other'.

-- migration-safety: contract-ok the new check is a superset of the old one — every
-- existing row stays valid, and the previous release never writes 'concert',
-- so a code rollback keeps working against this constraint.
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE public.events
  ADD CONSTRAINT events_event_type_check CHECK (
    event_type = ANY (
      ARRAY[
        'meetup'::text,
        'concert'::text,
        'conference'::text,
        'workshop'::text,
        'party'::text,
        'exhibition'::text,
        'festival'::text,
        'retreat'::text,
        'other'::text
      ]
    )
  );
