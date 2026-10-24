-- A request is held in the currency it was asked in.
--
-- "Lena asks Marco for CHF 20" stays CHF 20 until it is paid, however Bitcoin
-- moves overnight. Until now the ask was frozen as a BTC decimal at the moment
-- of asking, so the person asked could open the link tomorrow and be shown a
-- different number of francs than the one that was asked.
--
-- amount_btc stays: it is what the ask was worth when it was made, it is the
-- whole ask for a request made in BTC, and it is what the lists sort and the
-- bounds were checked against. ask_amount / ask_currency are present only when
-- the ask was made in a fiat currency; the BTC to pay is then worked out from
-- them on the day the payer arrives (and again, with a tolerance, on settlement).
--
-- Rollback: ALTER TABLE payment_requests DROP COLUMN ask_amount, DROP COLUMN ask_currency;

ALTER TABLE payment_requests
  ADD COLUMN IF NOT EXISTS ask_amount NUMERIC(18, 2) CHECK (ask_amount > 0),
  ADD COLUMN IF NOT EXISTS ask_currency TEXT CHECK (ask_currency ~ '^[A-Z]{3}$');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_requests_ask_whole'
  ) THEN
    -- Both or neither: an amount with no currency is not an ask.
    ALTER TABLE payment_requests ADD CONSTRAINT payment_requests_ask_whole
      CHECK ((ask_amount IS NULL) = (ask_currency IS NULL));
  END IF;
END $$;
