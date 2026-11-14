-- A purchase is an order, with or without an account; a booking is paid through one.
--
-- Two gaps in the same table:
--
-- 1. orders.buyer_id is NOT NULL, so a purchase made without an account could
--    not be an order at all. A signed-out buyer was shown the seller's bare
--    address and typed the price into their wallet by hand: nothing recorded
--    the sale, the seller had no order to fulfil and the buyer no receipt.
--    payment_intents.buyer_id has been nullable since 20260723000000 (public
--    support) and carries the guest's name since 20261011220000 (guest
--    tickets); the order row is the piece that was missing. A guest order has
--    buyer_id NULL; the name is on its payment intent and the buyer's note for
--    the seller in orders.buyer_note.
--
-- 2. A booking the provider accepted was "paid" the same way, to a bare
--    address, and nothing ever told the booking so. orders.booking_id ties the
--    order of a booking's payment to the booking, so settlement can mark the
--    booking paid. Orders are written by the server only (20261008170000), so
--    the link cannot be forged from a client.
--
-- Reads are unchanged: "Orders viewable by buyer or seller" already lets the
-- seller see an order with no buyer. order_becomes_a_deal() already returns
-- early when either side has no actor, so a guest order is an order and not a
-- deal (a review needs two accounts).
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_orders_booking_id;
--   ALTER TABLE public.orders DROP COLUMN IF EXISTS booking_id;
--   -- only once no order has a NULL buyer:
--   ALTER TABLE public.orders ALTER COLUMN buyer_id SET NOT NULL;

ALTER TABLE public.orders ALTER COLUMN buyer_id DROP NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_booking_id
  ON public.orders (booking_id)
  WHERE booking_id IS NOT NULL;

COMMENT ON COLUMN public.orders.buyer_id IS
  'The buyer''s account; NULL for a purchase made without one (the name is payment_intents.guest_name).';
COMMENT ON COLUMN public.orders.booking_id IS
  'The booking this order pays for, when it is the payment of an accepted booking.';
