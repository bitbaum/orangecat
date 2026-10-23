-- A payment can answer a request.
--
-- "Lena asks Marco for CHF 20" has always ended the same way: Marco taps Pay,
-- pays, and the request still says Pending with a Pay button on it, for him and
-- for Lena, forever. The table already holds the place for the answer
-- (payment_requests.paid_intent_id, paid_at, "written by the system after
-- settlement is observed"); nothing ever wrote it, because the pay link a
-- request produced carried no request, so the payment could not say which ask
-- it answered.
--
-- The link now carries the request id. The invoice mint checks it (a pending
-- request addressed to this recipient) and stamps it here; settlement reads it
-- back and marks the request paid. The column is a pointer only — the intent
-- stays the record of the payment, the request stays the record of the ask.
--
-- Rollback: ALTER TABLE payment_intents DROP COLUMN payment_request_id;

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS payment_request_id uuid
    REFERENCES public.payment_requests(id) ON DELETE SET NULL;

-- Settlement looks a request up from its intent, and a request from the intents
-- aimed at it; only the rows that carry a request are worth indexing.
CREATE INDEX IF NOT EXISTS idx_payment_intents_payment_request
  ON public.payment_intents (payment_request_id)
  WHERE payment_request_id IS NOT NULL;
