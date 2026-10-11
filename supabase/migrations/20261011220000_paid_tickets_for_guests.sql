-- A paid ticket without an account: a name, Bitcoin, and the ticket's own link.
--
-- Free events took guests by name alone (20261007160000); a paid event still
-- said "sign in to buy one", because paying without an account "needs the
-- checkout rails that are not built yet". For Bitcoin they are built: public
-- support and tips already take account-free Lightning payments, polled with a
-- bearer status token and settled by the same handlePaymentConfirmed as any
-- purchase. A ticket is one more thing that settlement can hand out.
--
-- 1. payment_intents.guest_name — the name the guest gave at checkout, carried
--    to settlement, where the ticket is issued to it. Null for every other
--    intent. Readable only where payment_intents already is (server-side).
-- 2. issue_paid_guest_ticket(event, intent, name) — settlement only
--    (service_role). Idempotent on the intent: a second confirmation of the
--    same payment returns the same ticket. Like issue_paid_ticket, it issues
--    even past capacity (the money has moved); checkout refuses a full event
--    before anyone pays.
-- 3. guest_ticket(code) also returns payment_status, so the ticket page offers
--    "give it back" only for a free ticket — a paid one is a refund, the
--    organizer's call.
-- 4. claim_guest_ticket (the FREE claim) no longer tells a guest at a paid
--    event to sign in; it points at the purchase. Body otherwise unchanged.
-- 5. event_payouts.recipient_user_id becomes nullable: a refund to a guest has
--    no account to name. Such a refund is recorded as given back another way;
--    there is no wallet on record to send Bitcoin to.
--
-- Rollback: DROP FUNCTION public.issue_paid_guest_ticket(uuid, uuid, text);
--   restore guest_ticket and claim_guest_ticket from 20261007160000;
--   ALTER TABLE public.payment_intents DROP COLUMN guest_name;
--   (recipient_user_id stays nullable — re-adding NOT NULL needs guest refunds gone)

ALTER TABLE public.payment_intents ADD COLUMN IF NOT EXISTS guest_name text;

-- migration-safety: contract-ok a new CHECK on a new column, re-created so a re-run is clean
ALTER TABLE public.payment_intents DROP CONSTRAINT IF EXISTS payment_intents_guest_name_length;
ALTER TABLE public.payment_intents ADD CONSTRAINT payment_intents_guest_name_length
  CHECK (guest_name IS NULL OR length(btrim(guest_name)) BETWEEN 1 AND 80);

ALTER TABLE public.event_payouts ALTER COLUMN recipient_user_id DROP NOT NULL;

-- ---------------------------------------------------------------- issue
CREATE OR REPLACE FUNCTION public.issue_paid_guest_ticket(
  p_event_id uuid, p_payment_intent_id uuid, p_name text
)
RETURNS public.event_attendees
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_row public.event_attendees;
BEGIN
  IF length(v_name) < 1 OR length(v_name) > 80 THEN
    RAISE EXCEPTION 'A guest ticket needs the name it was bought for' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;

  SELECT * INTO v_row FROM public.event_attendees
  WHERE event_id = p_event_id AND transaction_id = p_payment_intent_id;
  IF FOUND THEN
    RETURN v_row; -- this payment already issued its ticket
  END IF;

  INSERT INTO public.event_attendees
    (event_id, user_id, guest_name, status, ticket_count, payment_status, transaction_id)
  VALUES (p_event_id, NULL, v_name, 'registered', 1, 'paid', p_payment_intent_id)
  RETURNING * INTO v_row;

  PERFORM public.refresh_event_attendance(p_event_id);
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_paid_guest_ticket(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_paid_guest_ticket(uuid, uuid, text) TO service_role;

-- ---------------------------------------------------------------- read
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
      'checked_in_at', a.checked_in_at,
      'payment_status', a.payment_status
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

-- ---------------------------------------------------------------- free claim
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
