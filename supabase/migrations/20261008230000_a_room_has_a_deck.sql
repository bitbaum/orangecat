-- A room has a deck (ADR-0012, docs/features/investor-portal.md).
--
-- The deck is DATA — slides with a layout and a few fields, read and written
-- through @bitbaum/deckkit's normalizeDeck — not an uploaded file and not
-- HTML. So the owner edits it in the room, investors see it at
-- /room/<token>/deck, and slides bound to live evidence never go stale.
-- NULL until the owner first generates or saves one.
--
-- Expand-only: a new nullable column, so the previous release keeps working.

ALTER TABLE public.project_rooms
  ADD COLUMN IF NOT EXISTS deck JSONB,
  ADD COLUMN IF NOT EXISTS deck_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.project_rooms.deck IS
  'The room''s presentation as @bitbaum/deckkit data ({version, title, theme, slides}). Read through normalizeDeck; never rendered raw.';
