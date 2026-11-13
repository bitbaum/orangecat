-- An event that is over takes no more tickets.
--
-- The ticket functions open on status alone, and nothing ever moves a past
-- event to 'completed'. So an event kept handing out tickets after it had
-- happened: on orangecat.ch on 2026-11-12 an event dated Sunday, September 13,
-- 2026 still offered "Get a free ticket". The page now says the event has
-- ended (eventHasEnded, src/domain/events/time.ts); this holds the same rule
-- where tickets are written.
--
-- 1. event_has_ended(event): the rule, once. Over when the organizer marked it
--    completed, or when its last moment has passed. The last moment is its
--    end, else its start; an all-day event runs to midnight after its last
--    day on the venue's clock. eventEndsAt/eventHasEnded is the same rule in
--    TypeScript, so a page never offers a ticket these functions refuse.
-- 2. claim_free_ticket and claim_guest_ticket refuse an event that has ended,
--    with P0002 like any event that is not open for tickets. Bodies otherwise
--    as in 20261005100000 and 20261011220000.
--
-- The paid issuers (issue_paid_ticket, issue_paid_guest_ticket) stay as they
-- are, on purpose: they run at settlement, after the money has moved, and
-- refusing there would strand it — the same reason they issue past capacity.
-- Checkout refuses an ended event before an invoice exists (initiatePayment,
-- initiateGuestTicketPurchase), as it refuses a sold-out one.
--
-- Rollback: restore claim_free_ticket from 20261005100000 and
--   claim_guest_ticket from 20261011220000, then
--   DROP FUNCTION public.event_has_ended(public.events);

-- ---------------------------------------------------------------- the rule
CREATE OR REPLACE FUNCTION public.event_has_ended(p_event public.events)
RETURNS boolean
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_last timestamptz := coalesce(p_event.end_date, p_event.start_date);
  v_zone text := coalesce(nullif(btrim(p_event.timezone), ''), 'UTC');
BEGIN
  IF p_event.status = 'completed' THEN
    RETURN true;
  END IF;
  IF v_last IS NULL THEN
    RETURN false;
  END IF;
  IF p_event.is_all_day THEN
    BEGIN
      v_last := ((v_last AT TIME ZONE v_zone)::date + 1)::timestamp AT TIME ZONE v_zone;
    EXCEPTION WHEN invalid_parameter_value THEN
      -- A zone Postgres does not know is read as UTC, as the pages read it.
      v_last := ((v_last AT TIME ZONE 'UTC')::date + 1)::timestamp AT TIME ZONE 'UTC';
    END;
  END IF;
  RETURN v_last < now();
END;
$$;

COMMENT ON FUNCTION public.event_has_ended(public.events) IS
  'Whether an event is over: completed, or past its end (its start when it has none; an all-day event at midnight after its last day, in its zone).';

REVOKE ALL ON FUNCTION public.event_has_ended(public.events) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_has_ended(public.events) TO service_role;

-- ---------------------------------------------------------------- free claim
CREATE OR REPLACE FUNCTION public.claim_free_ticket(p_event_id uuid)
RETURNS public.event_attendees
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events;
  v_used integer;
  v_row public.event_attendees;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in to get a ticket' USING ERRCODE = '28000';
  END IF;

  -- The lock is what makes the last seat go to exactly one person.
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND OR v_event.status NOT IN ('published', 'open', 'full', 'ongoing') THEN
    RAISE EXCEPTION 'This event is not open for tickets' USING ERRCODE = 'P0002';
  END IF;
  IF public.event_has_ended(v_event) THEN
    RAISE EXCEPTION 'This event has ended' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_event.is_free OR coalesce(v_event.ticket_price, 0) = 0) THEN
    RAISE EXCEPTION 'This event has paid tickets' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.event_attendees
  WHERE event_id = p_event_id AND user_id = v_user;
  IF FOUND AND v_row.status IN ('registered', 'attended') THEN
    RETURN v_row; -- already has one; asking twice is not an error
  END IF;

  SELECT coalesce(sum(ticket_count), 0) INTO v_used
  FROM public.event_attendees
  WHERE event_id = p_event_id AND status IN ('registered', 'attended');
  IF v_event.max_attendees IS NOT NULL AND v_used >= v_event.max_attendees THEN
    RAISE EXCEPTION 'This event is full' USING ERRCODE = '23P01';
  END IF;

  INSERT INTO public.event_attendees (event_id, user_id, status, ticket_count, payment_status)
  VALUES (p_event_id, v_user, 'registered', 1, 'free')
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET status = 'registered', ticket_count = 1, payment_status = 'free',
        registered_at = now(), checked_in_at = NULL
  RETURNING * INTO v_row;

  PERFORM public.refresh_event_attendance(p_event_id);
  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------- guest claim
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
  IF public.event_has_ended(v_event) THEN
    RAISE EXCEPTION 'This event has ended' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (v_event.is_free OR coalesce(v_event.ticket_price, 0) = 0) THEN
    RAISE EXCEPTION 'This event has paid tickets — buy one with your name on the event page' USING ERRCODE = '22023';
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
