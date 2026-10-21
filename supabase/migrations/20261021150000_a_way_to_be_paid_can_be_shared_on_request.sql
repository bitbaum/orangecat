-- A way to be paid can be shared on request instead of printed on the page.
--
-- Fiat rails are identity-bound: a Twint or Swish row is a phone number, and
-- the first version printed it on the public pay page for anyone with the
-- link (owner, 2026-10-21: "do I really need to make my phone number
-- public?"). Pseudonymous by default means no. A row is now either `public`
-- (shown on the page) or `on_request` (the page shows the name only; the
-- payer taps Ask, which opens a message to the owner, who decides).
--
-- The handle of an on_request row never leaves the server for a public
-- reader — paymentMethodsService strips it; this column only records the
-- choice. Two fixed values, a true invariant, so the CHECK stays.

ALTER TABLE public.payment_methods
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'on_request'));

COMMENT ON COLUMN public.payment_methods.visibility IS
  'public: handle shown on the pay page. on_request: name only; the handle is shared by the owner in a message.';
