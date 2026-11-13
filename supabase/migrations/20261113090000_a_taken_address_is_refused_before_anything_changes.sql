-- A hand-over to an address that already has an account is refused before
-- anything changes (ADR-0014 D9).
--
-- acceptHandover learned that an address was taken only when the auth server
-- refused to set it: the last step, after the link was cut and the identity's
-- ways in removed. It then read the refusal's wording to tell "taken" from any
-- other failure. On orangecat.ch that refusal did not read as "taken", so the
-- person was told something went wrong (500) and the identity had already lost
-- its ways in for a hand-over that never happened.
--
-- This answers the question directly: which account, if any, has this address.
-- The app asks it right after the link proves good, and refuses a taken
-- address with nothing else touched. Service role only: it would otherwise
-- tell anyone whether an address has an account.
--
-- Rollback: DROP FUNCTION public.auth_user_id_for_email(text);

CREATE OR REPLACE FUNCTION public.auth_user_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.id
    FROM auth.users u
   WHERE lower(u.email) = lower(btrim(p_email))
   ORDER BY u.created_at
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_id_for_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id_for_email(text) TO service_role;
