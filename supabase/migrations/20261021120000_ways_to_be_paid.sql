-- Ways to be paid: every door an account accepts money through that is not
-- a Bitcoin wallet — Twint, PayPal, Revolut, Cash App, Venmo, Wise, a bank.
--
-- OrangeCat is currency-agnostic by principle. Bitcoin stays the native rail
-- (wallets, invoices, settlement watched by the system). These rows are the
-- rest: a handle the public pay page shows so a payer can pay in the app they
-- already have. They settle OUTSIDE OrangeCat, so nothing here records a
-- payment — the owner confirms in their own app.
--
-- The set of methods is SSOT in src/config/payment-methods.ts and validated at
-- the write boundary; no CHECK on `method`, because a hand-synced list in SQL
-- is the kind that drifts.
--
-- Keyed by profile like payment_requests and wallets (the money tables), not
-- by actor: a way to be paid belongs to the person who is paid.

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  method TEXT NOT NULL,
  -- Normalised by the app: no spaces in an IBAN, no "@" on a username.
  handle TEXT NOT NULL CHECK (char_length(handle) BETWEEN 1 AND 160),
  -- The owner's own word for it ("Business account"), shown beside the name.
  label TEXT CHECK (label IS NULL OR char_length(label) <= 40),

  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_profile
  ON public.payment_methods (profile_id, display_order, created_at);

DROP TRIGGER IF EXISTS payment_methods_touch_updated_at ON public.payment_methods;
CREATE TRIGGER payment_methods_touch_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- The owner manages their own rows. The public pay page reads active rows
-- server-side (admin client), scoped to one username per request, so a phone
-- number or IBAN is never selectable table-wide by an anonymous client.
DROP POLICY IF EXISTS payment_methods_owner_select ON public.payment_methods;
CREATE POLICY payment_methods_owner_select ON public.payment_methods
  FOR SELECT USING ((SELECT auth.uid()) = profile_id);

DROP POLICY IF EXISTS payment_methods_owner_insert ON public.payment_methods;
CREATE POLICY payment_methods_owner_insert ON public.payment_methods
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = profile_id);

DROP POLICY IF EXISTS payment_methods_owner_update ON public.payment_methods;
CREATE POLICY payment_methods_owner_update ON public.payment_methods
  FOR UPDATE USING ((SELECT auth.uid()) = profile_id)
  WITH CHECK ((SELECT auth.uid()) = profile_id);

DROP POLICY IF EXISTS payment_methods_owner_delete ON public.payment_methods;
CREATE POLICY payment_methods_owner_delete ON public.payment_methods
  FOR DELETE USING ((SELECT auth.uid()) = profile_id);

COMMENT ON TABLE public.payment_methods IS
  'Ways an account accepts money other than Bitcoin. Settled outside OrangeCat; shown on the pay page, never marked paid by the system.';
