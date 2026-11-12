-- An identity can be handed over (ADR-0014 D9).
--
-- Handing over means: the identity gets an address of its own, chosen by
-- whoever accepts, and the row that says who holds it is deleted. From then on
-- it is an ordinary account and its former holder has no way in.
--
-- The offer is a link, as a page set up for someone is (ADR-0004): holding the
-- link is the whole credential. So the token itself is never stored, only its
-- SHA-256, and a leaked row of this table hands nothing to anyone.
--
-- Service-role only, like identity_links: RLS on, no policy.
--
-- Rollback: DROP TABLE public.identity_handovers;

CREATE TABLE IF NOT EXISTS public.identity_handovers (
  -- One open offer per identity: offering again replaces the last link.
  identity_user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  offered_by       uuid NOT NULL    REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash       text NOT NULL UNIQUE,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_handovers_token_is_a_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

ALTER TABLE public.identity_handovers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_handovers FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.identity_handovers TO service_role;

COMMENT ON TABLE public.identity_handovers IS
  'An open offer to hand an identity over (ADR-0014 D9). Holds the hash of the link token, never the token. Service-role only.';

-- Only an identity can be offered, and only by the account that holds it.
-- The application checks this too; the database is where it cannot be skipped.
CREATE OR REPLACE FUNCTION public.identity_handovers_are_for_held_identities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.identity_links
     WHERE identity_user_id = NEW.identity_user_id
       AND holder_user_id = NEW.offered_by
  ) THEN
    RAISE EXCEPTION 'only the account that holds an identity can offer it'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS identity_handovers_are_for_held_identities ON public.identity_handovers;
CREATE TRIGGER identity_handovers_are_for_held_identities
  BEFORE INSERT OR UPDATE ON public.identity_handovers
  FOR EACH ROW EXECUTE FUNCTION public.identity_handovers_are_for_held_identities();

-- When the link between holder and identity goes (handed over, or the
-- identity deleted), any open offer goes with it: an offer for an identity
-- nobody holds must not be acceptable.
CREATE OR REPLACE FUNCTION public.identity_handovers_end_with_the_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.identity_handovers WHERE identity_user_id = OLD.identity_user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS identity_handovers_end_with_the_link ON public.identity_links;
CREATE TRIGGER identity_handovers_end_with_the_link
  AFTER DELETE ON public.identity_links
  FOR EACH ROW EXECUTE FUNCTION public.identity_handovers_end_with_the_link();

NOTIFY pgrst, 'reload schema';
