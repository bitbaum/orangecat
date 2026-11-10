-- A project can carry its own logo.
--
-- Projects on OrangeCat showed an initial, or for the studio's own products
-- the mark from src/config/marks/. A project that has a logo of its own (a
-- town's crest, a co-op's sign) can now upload it in the project form, and
-- the project page, cards and share card show it.
--
-- The value is a public image URL, like products.thumbnail_url and the other
-- entity image columns; the upload itself goes through the shared image panel.
-- Rollback: ALTER TABLE public.projects DROP COLUMN logo_url;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.projects.logo_url IS
  'The project''s own logo, as a public image URL (optional).';
