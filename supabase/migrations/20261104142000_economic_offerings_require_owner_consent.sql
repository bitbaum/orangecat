-- Learned offering fields stay private until the owner deliberately shares them.
-- Keep one live projection: hiding removes anonymous access immediately, while
-- the private economic profile and existing owner-only RLS remain unchanged.
ALTER TABLE public.user_economic_profile
  ADD COLUMN public_offerings_enabled boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.user_economic_profile_public AS
SELECT user_id, skills, assets, asked_for, not_available_for, updated_at
FROM public.user_economic_profile
WHERE public_offerings_enabled = true;
