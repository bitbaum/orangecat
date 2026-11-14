-- A booking's money is written by the server only.
--
-- A booking is paid once the provider accepts it (20261114091700), for the
-- price the booking recorded. But the baseline let a client write that record:
--
--   "Customers can create bookings"       INSERT, any columns, own bookings
--   "Customers can update their bookings" UPDATE, any columns, while pending
--                                         or confirmed
--
-- so through PostgREST a customer could set price_btc to a satoshi, or set
-- total_paid_btc to the price and have the booking read "paid" with nothing
-- sent. They could also set status to 'confirmed' themselves, without the
-- provider.
--
-- What the app actually writes from a person's own session (checked in
-- src/services/bookings/index.ts and src/app/api/bookings/):
--   provider: status, confirmed_at, cancelled_at, completed_at,
--             cancellation_reason   (confirm / reject / complete)
--   customer: status, cancelled_at, cancellation_reason        (cancel)
-- Everything else is written by the server: the insert (it derives the
-- provider and the price from the listing) and total_paid_btc (settlement).
--
-- So:
--   * clients lose INSERT, DELETE and TRUNCATE, and table-wide UPDATE;
--   * they keep UPDATE on exactly the five columns above;
--   * the customer's update policy now only allows moving their own pending
--     or confirmed booking to 'cancelled'.
-- Reads are untouched. The provider's policy ("Providers can update
-- bookings") is unchanged; the column grant bounds what it can touch.
--
-- For the release that is running while this applies: its confirm, reject,
-- complete and cancel keep working (they write only the granted columns). Its
-- booking INSERT goes through the customer's session and is refused until the
-- new release, which inserts through the service role, is live — a failed
-- "book" for the length of the switch, never a wrong record.
--
-- __tests__/unit/bookings/booking-money-server-writes.test.ts replays every
-- migration and fails if a later one gives client roles these writes back.
--
-- migration-safety: contract-ok TRUNCATE here is a PRIVILEGE being revoked, not a table being emptied; no data or schema changes.
--
-- Rollback:
--   DROP POLICY IF EXISTS "Customers can cancel their bookings" ON public.bookings;
--   CREATE POLICY "Customers can update their bookings" ON public.bookings FOR UPDATE
--     USING ((customer_user_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'confirmed'::text])))
--     WITH CHECK (customer_user_id = auth.uid());
--   CREATE POLICY "Customers can create bookings" ON public.bookings FOR INSERT
--     WITH CHECK (customer_user_id = auth.uid());
--   GRANT INSERT, UPDATE, DELETE, TRUNCATE ON public.bookings TO anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.bookings FROM anon, authenticated;

GRANT UPDATE (status, confirmed_at, cancelled_at, completed_at, cancellation_reason)
  ON public.bookings TO authenticated;

DROP POLICY IF EXISTS "Customers can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can update their bookings" ON public.bookings;
DROP POLICY IF EXISTS "Customers can cancel their bookings" ON public.bookings;

CREATE POLICY "Customers can cancel their bookings" ON public.bookings
  FOR UPDATE
  USING (
    customer_user_id = (SELECT auth.uid())
    AND status = ANY (ARRAY['pending'::text, 'confirmed'::text])
  )
  WITH CHECK (
    customer_user_id = (SELECT auth.uid())
    AND status = 'cancelled'::text
  );
