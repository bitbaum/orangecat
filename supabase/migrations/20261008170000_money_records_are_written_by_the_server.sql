-- Money records are written by the server only.
--
-- payment_intents, orders and contributions are created, settled and refunded
-- by OrangeCat's server through the service role, which RLS does not apply to.
-- Client roles still held what the baseline gave every table — table-level
-- INSERT, UPDATE, DELETE and TRUNCATE — plus five write policies that no code
-- path needs any more: every write now goes through the server (the purchase,
-- support and Cat funding paths were the last to move).
--
-- Withdrawing them makes the server the only writer. Reads are untouched:
-- SELECT grants and the SELECT policies stay exactly as they are, so buyers,
-- sellers and the public see what they saw before.
--
-- Not destructive for the release that is running while this applies: it
-- already writes these tables through the service role only. REVOKE and
-- DROP POLICY change who may write, never what is stored.
--
-- __tests__/unit/payments/money-tables-server-writes.test.ts replays every
-- migration and fails if a later one gives client roles a write back.
--
-- migration-safety: contract-ok TRUNCATE here is a PRIVILEGE being revoked, not a table being emptied; no data or schema changes.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.payment_intents FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.contributions FROM anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users create payments" ON public.payment_intents;
DROP POLICY IF EXISTS "Buyers update own payments" ON public.payment_intents;
DROP POLICY IF EXISTS "Authenticated users create orders" ON public.orders;
DROP POLICY IF EXISTS "Orders updatable by buyer or seller" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users create contributions" ON public.contributions;
