-- Money out of an event: paying the crew and refunding tickets, on record.
--
-- OrangeCat holds no money, so nothing here moves any. The organizer pays
-- from their own connected wallet through the existing send rail
-- (sendToRecipient, which writes its own audit record since #1240); this table
-- is the EVENT's account of it — who was paid for which role, which ticket was
-- refunded — so the organizer and the person paid can both see it.
--
-- A payout made outside OrangeCat (Twint, cash) can be recorded too, as
-- method 'other': the record should be true about how people were paid, not
-- only about the payments we carried.
--
-- event_payouts.kind / method / status are validated in the app
-- (src/config/event-payouts.ts) — enum CHECKs drifted elsewhere
-- (notifications_type_check). The table keeps the true invariants: amounts are
-- not negative, and one person is paid once per role and one ticket refunded
-- once (partial unique indexes on what succeeded).
--
-- Writes go through the server after it has checked the caller organizes the
-- event (a send has already happened by then); people read their own rows.
--
-- refund_ticket(event, attendee): organizer-only; the ticket is cancelled,
-- marked refunded and its seat freed.
--
-- Rollback: DROP FUNCTION public.refund_ticket(uuid, uuid);
--           DROP TABLE public.event_payouts;

CREATE TABLE IF NOT EXISTS public.event_payouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL,
  role_id uuid REFERENCES public.event_roles(id) ON DELETE SET NULL,
  attendee_id uuid REFERENCES public.event_attendees(id) ON DELETE SET NULL,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(18,8),
  currency text,
  amount_btc numeric(18,8),
  method text NOT NULL,
  status text NOT NULL,
  payment_hash text,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT event_payouts_amounts_not_negative CHECK (
    (amount IS NULL OR amount >= 0) AND (amount_btc IS NULL OR amount_btc >= 0)
  )
);

CREATE INDEX IF NOT EXISTS event_payouts_event_idx ON public.event_payouts (event_id, created_at);
CREATE INDEX IF NOT EXISTS event_payouts_recipient_idx ON public.event_payouts (recipient_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS event_payouts_one_crew_payment
  ON public.event_payouts (role_id, recipient_user_id)
  WHERE kind = 'crew' AND status = 'sent';
CREATE UNIQUE INDEX IF NOT EXISTS event_payouts_one_refund
  ON public.event_payouts (attendee_id)
  WHERE kind = 'refund' AND status = 'sent';

ALTER TABLE public.event_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_payouts_read ON public.event_payouts;
CREATE POLICY event_payouts_read ON public.event_payouts FOR SELECT USING (
  recipient_user_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_payouts.event_id AND e.user_id = (SELECT auth.uid())
  )
);

GRANT SELECT ON public.event_payouts TO authenticated;
GRANT ALL ON public.event_payouts TO service_role;

CREATE OR REPLACE FUNCTION public.refund_ticket(p_event_id uuid, p_attendee_id uuid)
RETURNS public.event_attendees
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.event_attendees;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events WHERE id = p_event_id AND user_id = auth.uid()
  ) AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Only the organizer can refund a ticket' USING ERRCODE = '42501';
  END IF;

  UPDATE public.event_attendees
  SET status = 'cancelled', payment_status = 'refunded'
  WHERE id = p_attendee_id AND event_id = p_event_id AND payment_status = 'paid'
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No paid ticket to refund' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public.refresh_event_attendance(p_event_id);
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_ticket(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_ticket(uuid, uuid) TO authenticated, service_role;
