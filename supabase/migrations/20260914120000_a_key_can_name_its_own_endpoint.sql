-- A key can name the server it belongs to.
--
-- Cat's transport has been provider-agnostic since 2026-06: one
-- OpenAI-compatible client takes any base URL. But user_api_keys had no place
-- to PUT a base URL, so "any model" meant "any of six vendors we spelled out".
-- vLLM, llama.cpp, Ollama on a box you own, LiteLLM, a model you trained
-- yourself — all unreachable, not because the engine could not call them but
-- because the row could not say where they were.
--
-- Two nullable columns, no backfill: every existing row is a vendor key whose
-- URL lives in PROVIDER_BASE_URLS, and for those base_url stays NULL forever.
-- Only rows with provider = 'custom' carry a URL, and for those it is required
-- by the API, not the schema — the schema stays one table for one concept
-- ("a credential Cat may route through"), and the shape of that credential is
-- the application's business.
--
-- default_model exists because a self-hosted server serves whatever its owner
-- loaded, and the registry cannot know its name. Cat uses it when the user
-- has not picked a model explicitly for the turn.
ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS default_model text;

COMMENT ON COLUMN public.user_api_keys.base_url IS
  'OpenAI-compatible base URL (…/v1, no trailing slash) for provider = ''custom''. NULL for vendor keys, whose URL is fixed in code.';

COMMENT ON COLUMN public.user_api_keys.default_model IS
  'Model id Cat sends to this endpoint when the user has not chosen one for the turn. NULL for vendor keys.';
