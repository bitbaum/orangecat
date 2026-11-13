-- An account in a circle can be deleted (ADR-0014).
--
-- identity_handovers_end_with_the_link (20261112120000) removes an identity's
-- open hand-over offer when its link goes. It fires on every delete from
-- identity_links, including the cascade when an account is deleted. GoTrue
-- deletes as supabase_auth_admin, the trigger ran as that role, and that role
-- has no right to identity_handovers (service-role only, on purpose). So every
-- deletion of a holder or an identity failed with "permission denied for table
-- identity_handovers", with or without an offer: Settings -> Delete account
-- answered 500 for anyone who had ever created an identity.
--
-- The function now runs as its owner, like identity_loses_circle_on_own_way_in
-- (20261112190000), with an empty search_path. It only ever deletes the offer
-- for the identity whose link is being deleted, so running as owner widens
-- nothing.
--
-- Rollback: re-run the CREATE OR REPLACE from 20261112120000 (SECURITY
-- INVOKER, search_path = public). That brings the failure back.

CREATE OR REPLACE FUNCTION public.identity_handovers_end_with_the_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.identity_handovers WHERE identity_user_id = OLD.identity_user_id;
  RETURN OLD;
END;
$$;

-- A trigger function is never called directly; nobody needs EXECUTE on it.
REVOKE ALL ON FUNCTION public.identity_handovers_end_with_the_link() FROM PUBLIC;
