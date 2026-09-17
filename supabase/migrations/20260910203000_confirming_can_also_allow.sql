-- A denied Cat action used to end in a dead end: "Cat isn't allowed to handle
-- entities actions yet" plus a link to Settings. Every one of those was a
-- settings detour the product asked the user to make (the cat-cognitive-load
-- direction, 2026-08-29). Now a not-yet-granted category produces the same
-- confirmation card as any consequential action, with one extra sentence:
-- confirming also allows this category from now on (each action is still
-- confirmed). This column records that the card carried that sentence, so
-- confirming a card that did not cannot silently widen a permission.
ALTER TABLE public.cat_pending_actions
  ADD COLUMN IF NOT EXISTS grant_on_confirm boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cat_pending_actions.grant_on_confirm IS
  'Confirming this card also grants the action''s category (requires_confirmation stays true). Only ever true for non-payment, non-high-risk actions.';
