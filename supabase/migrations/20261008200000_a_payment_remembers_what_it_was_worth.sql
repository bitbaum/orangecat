-- A payment remembers what it was worth when it arrived.
--
-- payment_intents held the amount in BTC and nothing else, so every fiat figure
-- built from them — "Your money", the tax estimate — converted a year of income
-- at TODAY's price. Income is valued on the day it is received; Bitcoin moves
-- enough in a year that the difference is the whole estimate.
--
-- rates_at_paid is the BTC price at the moment the payment counted as paid, in
-- every currency OrangeCat prices in: { "CHF": 52199, "EUR": …, … }. One fact,
-- currency-agnostic, so a reader in any currency gets their own value without a
-- second column per currency. It is written in the same statement that marks
-- the intent paid (claimPaidTransition), so value and paid_at never disagree.
--
-- NULL means unknown — no trustworthy rate at that moment, or paid before this
-- column existed. It is never filled with a placeholder.
--
-- Additive only: the running release ignores it, and readers treat a missing
-- value as unknown. Clients may read it under the existing SELECT policies (it
-- is a market price, not a secret) and cannot write it — client roles hold no
-- write on payment_intents (20261008170000).

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS rates_at_paid jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'payment_intents_rates_at_paid_is_object'
       AND conrelid = 'public.payment_intents'::regclass
  ) THEN
    ALTER TABLE public.payment_intents
      ADD CONSTRAINT payment_intents_rates_at_paid_is_object
      CHECK (rates_at_paid IS NULL OR jsonb_typeof(rates_at_paid) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.payment_intents.rates_at_paid IS
  'BTC price at the moment this intent counted as paid, per currency code ({"CHF": n, ...}). Written with paid_at. NULL = unknown, never a placeholder.';
