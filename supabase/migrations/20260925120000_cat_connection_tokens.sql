-- Credentials Cat uses to read a person's connected accounts (first: GitHub).
--
-- One row per (user, provider). Tokens are AES-256-GCM ciphertext (see
-- src/lib/crypto/webhookSecretCipher.ts, key WEBHOOK_SECRET_KEY), stored as
-- base64 text rather than bytea so PostgREST round-trips them without the
-- hex-escaping bytea gets.
--
-- No client access at all: RLS is on with NO policies, and the table is
-- revoked from anon/authenticated. Only the server (service role) reads or
-- writes it — a signed-in user's own token never reaches a browser, even
-- encrypted. Status for the UI is derived server-side (connected + login).
--
-- Rollback: DROP TABLE public.cat_connection_tokens;

CREATE TABLE IF NOT EXISTS public.cat_connection_tokens (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('github')),
  account_login text,
  access_token_encrypted text NOT NULL,
  access_expires_at timestamptz,
  refresh_token_encrypted text,
  refresh_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);

ALTER TABLE public.cat_connection_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cat_connection_tokens FROM anon, authenticated;

COMMENT ON TABLE public.cat_connection_tokens IS
  'Encrypted credentials for Cat connections (GitHub App user tokens). Service role only.';
