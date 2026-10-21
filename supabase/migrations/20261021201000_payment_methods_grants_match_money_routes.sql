-- payment_methods gets the grants money_routes has.
--
-- Default privileges hand every new table to anon and authenticated with ALL
-- (TRUNCATE, REFERENCES and TRIGGER included). RLS already limits every row
-- operation to the owner, and the public pay page reads through the server
-- (paymentMethodsService.listPublicPaymentMethods, service_role), so anon needs
-- nothing here, and the owner needs exactly the four row operations RLS governs.

REVOKE ALL ON public.payment_methods FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
