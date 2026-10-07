-- A free ticket without an account: a name, and the ticket's own link.
--
-- Until now claim_free_ticket refused anyone signed out ("Sign in to get a
-- ticket"). That is the right rule for a paid seat and the wrong one for a
-- birthday: the people a host invites mostly have no OrangeCat account, and
-- asking them to make one to say "I'm coming" is the step where they don't.
--
-- So a free event takes a guest by NAME alone. No email, no phone: the
-- privacy principle is pseudonymous by default, and a name is all the door
-- needs to find someone on the list. The ticket's code (32 hex characters,
-- unguessable) is the guest's key — the ticket page at
-- /events/<id>/ticket/<code> shows the QR the door scans, and the same code
-- is the only thing that can give the seat back. Holding the link is holding
-- the ticket, exactly as a screenshot of the QR already was.
--
-- Rules, each in the one function that needs it:
--   claim_guest_ticket(event, name)   anyone, FREE events only, while seats last
--   guest_ticket(code)                anyone holding the code: that one ticket
--   cancel_guest_ticket(code)         anyone holding the code, before check-in
-- Paid tickets still require an account: paying without one needs the
-- checkout rails that are not built yet.
--
-- event_attendees.user_id becomes nullable; a row has a person OR a guest
-- name, never neither. (event_id, user_id) stays UNIQUE — NULLs are distinct,
-- so many guests fit — and signed-in people keep one ticket per event.
-- Abuse: the API route rate-limits guest claims per IP; capacity is enforced
-- here under the same row lock as every other claim.
--
-- Rollback: DROP FUNCTION public.claim_guest_ticket(uuid, text),
--   public.guest_ticket(text), public.cancel_guest_ticket(text);
--   DELETE guest rows (user_id IS NULL) first, then
--   ALTER TABLE public.event_attendees DROP CONSTRAINT event_attendees_has_a_holder,
--     DROP COLUMN guest_name, ALTER COLUMN user_id SET NOT NULL.

ALTER TABLE public.event_attendees ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.event_attendees ADD COLUMN IF NOT EXISTS guest_name text;

-- New constraint on new columns; every existing row has a user_id, so it holds.
-- migration-safety: contract-ok a new constraint every existing row already satisfies
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_has_a_holder;
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_has_a_holder
  CHECK (user_id IS NOT NULL OR (guest_name IS NOT NULL AND length(btrim(guest_name)) BETWEEN 1 AND 80));

-- ---------------------------------------------------------------- claim
CREATE OR REPLACE FUNCTION public.claim_guest_ticket(p_event_id uuid, p_name text)
RETURNS public.event_attendees
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_event public.events;
  v_used integer;
  v_row public.event_attendees;
BEGIN
  IF length(v_name) < 1 OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'Tell the host your name (up to 80 characters)' USING ERRCODE = '22023';
  END IF;

  -- The same lock as claim_free_ticket: the last seat goes to exactly one person.
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status NOT IN ('published', 'open', 'full', 'ongoing') THEN
    RAISE EXCEPTION 'This event is not open for tickets' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_event.is_free OR coalesce(v_event.ticket_price, 0) = 0) THEN
    RAISE EXCEPTION 'This event has paid tickets — sign in to buy one' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(sum(ticket_count), 0) INTO v_used
  FROM public.event_attendees
  WHERE event_id = p_event_id AND status IN ('registered', 'attended');
  IF v_event.max_attendees IS NOT NULL AND v_used >= v_event.max_attendees THEN
    RAISE EXCEPTION 'This event is full' USING ERRCODE = '23P01';
  END IF;

  INSERT INTO public.event_attendees (event_id, user_id, guest_name, status, ticket_count, payment_status)
  VALUES (p_event_id, NULL, v_name, 'registered', 1, 'free')
  RETURNING * INTO v_row;

  PERFORM public.refresh_event_attendance(p_event_id);
  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------- read
-- The guest's own ticket, by its code: the ticket and the few event facts the
-- ticket page shows. Nothing else is reachable through a code.
CREATE OR REPLACE FUNCTION public.guest_ticket(p_code text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'ticket', jsonb_build_object(
      'event_id', a.event_id,
      'guest_name', a.guest_name,
      'status', a.status,
      'ticket_count', a.ticket_count,
      'ticket_code', a.ticket_code,
      'checked_in_at', a.checked_in_at
    ),
    'event', jsonb_build_object(
      'id', e.id,
      'title', e.title,
      'start_date', e.start_date,
      'timezone', e.timezone,
      'venue_name', e.venue_name,
      'venue_address', e.venue_address,
      'status', e.status
    )
  )
  FROM public.event_attendees a
  JOIN public.events e ON e.id = a.event_id
  WHERE a.ticket_code = p_code AND a.user_id IS NULL;
$$;

-- ---------------------------------------------------------------- give back
CREATE OR REPLACE FUNCTION public.cancel_guest_ticket(p_code text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event uuid;
BEGIN
  UPDATE public.event_attendees
  SET status = 'cancelled'
  WHERE ticket_code = p_code AND user_id IS NULL
    AND payment_status = 'free' AND status = 'registered' AND checked_in_at IS NULL
  RETURNING event_id INTO v_event;
  IF v_event IS NOT NULL THEN
    PERFORM public.refresh_event_attendance(v_event);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_guest_ticket(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guest_ticket(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_guest_ticket(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_guest_ticket(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guest_ticket(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_guest_ticket(text) TO anon, authenticated, service_role;
