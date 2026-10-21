-- A way to be paid whose handle is a phone number is shared on request.
--
-- #1375 added `visibility` with DEFAULT 'public', so a Twint (or Swish, Bizum…)
-- row saved before it, or by any caller that omitted the field, prints a phone
-- number on the public pay page. paymentMethodsService now forces on_request
-- for these rails on every insert; this moves the rows already saved.
--
-- The list mirrors the rails whose `reveals` includes 'phone' in
-- src/config/payment-methods.ts (the registry is the SSOT; SQL cannot read it).
-- Idempotent: rows already on_request are untouched.

UPDATE public.payment_methods
   SET visibility = 'on_request'
 WHERE visibility <> 'on_request'
   AND method IN ('twint', 'bizum', 'wero', 'swish', 'mobilepay', 'paynow', 'mpesa');
