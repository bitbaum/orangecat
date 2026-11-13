-- cat_connection_tokens held GitHub alone. A person can now connect a Google
-- account too (mail and calendar, read-only), stored the same way: encrypted,
-- service role only, one row per person per provider.
--
-- migration-safety: contract-ok the CHECK is widened, never narrowed: every row the old one allowed still passes, and the release before this one writes only 'github'.

DO $$
DECLARE
  found TEXT;
BEGIN
  FOR found IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.cat_connection_tokens'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.cat_connection_tokens DROP CONSTRAINT %I', found);
  END LOOP;
END $$;

ALTER TABLE public.cat_connection_tokens
  ADD CONSTRAINT cat_connection_tokens_provider_check
  CHECK (provider IN ('github', 'google'));

COMMENT ON TABLE public.cat_connection_tokens IS
  'Encrypted credentials for connections (GitHub App user tokens, Google OAuth tokens). Service role only.';
