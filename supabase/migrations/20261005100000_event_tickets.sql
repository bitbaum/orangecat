-- Event tickets: one row per person per event, with a code the door scans.
--
-- public.event_attendees has existed since the baseline and nothing ever wrote
-- it: a paid ticket left an order and nothing else, so nobody knew who was
-- coming, capacity was never enforced and current_attendees stayed 0.
--
-- Its policies were also unsafe for the moment anything did write it:
--   * SELECT let anyone read every attendee of a public event — a guest list,
--     and (with this migration) the codes that get people in.
--   * INSERT/UPDATE let a person write their own row freely — including
--     payment_status = 'paid' and status = 'attended'. A forged ticket.
-- So people no longer write the table directly. Four functions do, each with
-- the one rule it exists for:
--   claim_free_ticket(event)       a person, for a free event, while seats last
--   cancel_free_ticket(event)      a person, giving a free seat back
--   issue_paid_ticket(event,user,intent)  settlement only (service_role)
--   check_in_ticket(event, code)   the event's organizer, at the door
-- The organizer keeps direct read/delete of their own event's rows (and may
-- insert comp tickets). A person reads only their own.
--
-- Capacity: seats in use = sum(ticket_count) of registered + attended rows.
-- Claims lock the event row, so two people cannot take the last seat. A PAID
-- ticket is always issued even past capacity (the money has moved; refusing
-- would strand it) — checkout refuses when full instead, before anyone pays.
-- The event flips to 'full' at capacity and back to 'open' when a seat frees.
--
-- Rollback: DROP FUNCTION public.claim_free_ticket(uuid),
--   public.cancel_free_ticket(uuid), public.issue_paid_ticket(uuid, uuid, uuid),
--   public.check_in_ticket(uuid, text), public.event_seats_left(uuid),
--   public.refresh_event_attendance(uuid);
--   ALTER TABLE public.event_attendees DROP COLUMN ticket_code;
--   restore the four baseline policies (20240101000001, event_attendees_*).

ALTER TABLE public.event_attendees
  ADD COLUMN IF NOT EXISTS ticket_code text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');

CREATE UNIQUE INDEX IF NOT EXISTS event_attendees_ticket_code_key ON public.event_attendees (ticket_code);

-- A free seat is neither pending nor paid. The check is dropped only to be
-- re-added WIDER in the same transaction: every value the previous release
-- writes is still allowed, so a code rollback is unaffected.
-- migration-safety: contract-ok the CHECK is widened, never narrowed
ALTER TABLE public.event_attendees DROP CONSTRAINT IF EXISTS event_attendees_payment_status_check;
ALTER TABLE public.event_attendees ADD CONSTRAINT event_attendees_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'refunded', 'free'));

-- ---------------------------------------------------------------- policies
DROP POLICY IF EXISTS event_attendees_select ON public.event_attendees;
DROP POLICY IF EXISTS event_attendees_insert ON public.event_attendees;
DROP POLICY IF EXISTS event_attendees_update ON public.event_attendees;
DROP POLICY IF EXISTS event_attendees_delete ON public.event_attendees;
DROP POLICY IF EXISTS event_attendees_organizer_write ON public.event_attendees;

CREATE POLICY event_attendees_select ON public.event_attendees FOR SELECT USING (
  user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_attendees.event_id AND e.user_id = (SELECT auth.uid())
  )
);

-- Organizer only: comp tickets, corrections, removals.
CREATE POLICY event_attendees_organizer_write ON public.event_attendees
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_attendees.event_id AND e.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_attendees.event_id AND e.user_id = (SELECT auth.uid())
  ));

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.event_seats_left(p_event_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN e.max_attendees IS NULL THEN NULL
    ELSE greatest(e.max_attendees - coalesce((
      SELECT sum(a.ticket_count) FROM public.event_attendees a
      WHERE a.event_id = e.id AND a.status IN ('registered', 'attended')
    ), 0), 0)::integer
  END
  FROM public.events e
  WHERE e.id = p_event_id
    AND e.status IN ('published', 'open', 'full', 'ongoing', 'completed');
$$;

COMMENT ON FUNCTION public.event_seats_left(uuid) IS
  'Seats left at a public event; NULL when it has no capacity limit (or is not public).';

CREATE OR REPLACE FUNCTION public.refresh_event_attendance(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_used integer;
BEGIN
  SELECT coalesce(sum(ticket_count), 0) INTO v_used
  FROM public.event_attendees
  WHERE event_id = p_event_id AND status IN ('registered', 'attended');

  UPDATE public.events e
  SET current_attendees = v_used,
      status = CASE
        WHEN e.max_attendees IS NOT NULL AND v_used >= e.max_attendees
             AND e.status IN ('published', 'open') THEN 'full'
        WHEN e.status = 'full' AND (e.max_attendees IS NULL OR v_used < e.max_attendees) THEN 'open'
        ELSE e.status
      END
  WHERE e.id = p_event_id;
END;
$$;

-- ---------------------------------------------------------------- free
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

CREATE OR REPLACE FUNCTION public.cancel_free_ticket(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first' USING ERRCODE = '28000';
  END IF;
  -- Paid tickets are not cancelled here: that is a refund, the organizer's call.
  UPDATE public.event_attendees
  SET status = 'cancelled'
  WHERE event_id = p_event_id AND user_id = auth.uid()
    AND payment_status = 'free' AND status = 'registered';
  PERFORM public.refresh_event_attendance(p_event_id);
END;
$$;

-- ---------------------------------------------------------------- paid
CREATE OR REPLACE FUNCTION public.issue_paid_ticket(
  p_event_id uuid, p_user_id uuid, p_payment_intent_id uuid
)
RETURNS public.event_attendees
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.event_attendees;
BEGIN
  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;

  SELECT * INTO v_row FROM public.event_attendees
  WHERE event_id = p_event_id AND user_id = p_user_id;

  IF FOUND AND v_row.transaction_id = p_payment_intent_id THEN
    RETURN v_row; -- this payment already issued its ticket
  END IF;

  IF FOUND AND v_row.status IN ('registered', 'attended') THEN
    -- A second purchase adds a seat to the same ticket.
    UPDATE public.event_attendees
    SET ticket_count = ticket_count + 1, payment_status = 'paid',
        transaction_id = p_payment_intent_id
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  ELSE
    INSERT INTO public.event_attendees
      (event_id, user_id, status, ticket_count, payment_status, transaction_id)
    VALUES (p_event_id, p_user_id, 'registered', 1, 'paid', p_payment_intent_id)
    ON CONFLICT (event_id, user_id) DO UPDATE
      SET status = 'registered', ticket_count = 1, payment_status = 'paid',
          transaction_id = p_payment_intent_id, registered_at = now(), checked_in_at = NULL
    RETURNING * INTO v_row;
  END IF;

  PERFORM public.refresh_event_attendance(p_event_id);
  RETURN v_row;
END;
$$;

-- ---------------------------------------------------------------- door
CREATE OR REPLACE FUNCTION public.check_in_ticket(p_event_id uuid, p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.event_attendees;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the organizer can check people in' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.event_attendees
  WHERE event_id = p_event_id AND ticket_code = p_code;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('result', 'cancelled', 'user_id', v_row.user_id);
  END IF;
  IF v_row.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'result', 'already', 'user_id', v_row.user_id,
      'ticket_count', v_row.ticket_count, 'checked_in_at', v_row.checked_in_at
    );
  END IF;

  UPDATE public.event_attendees
  SET checked_in_at = now(), status = 'attended'
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'result', 'checked_in', 'user_id', v_row.user_id,
    'ticket_count', v_row.ticket_count, 'checked_in_at', v_row.checked_in_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_event_attendance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_paid_ticket(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_event_attendance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_paid_ticket(uuid, uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_free_ticket(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_free_ticket(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_in_ticket(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_free_ticket(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_free_ticket(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(uuid, text) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.event_seats_left(uuid) TO anon, authenticated, service_role;
