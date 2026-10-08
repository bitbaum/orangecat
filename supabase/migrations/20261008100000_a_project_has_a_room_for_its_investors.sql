-- A project has a room for its investors (ADR-0012).
--
-- The room is the PRIVATE part of a project page: the pitch, the deck, the
-- documents and the build record, for the people the owner chose. It is not an
-- entity (it holds no wallet) and not a page of its own kind — it belongs to the
-- project, the way ADR-0011 says the main thing holds its parts.
--
--   project_rooms        what the room says. One per project.
--   project_room_links   who may open it. One row per person the owner sent it
--                        to, or one shared row for a door such as a product's
--                        own /investors password. `token` is the credential the
--                        link carries; `id` stays internal, so a link can be
--                        listed and revoked without handing over the ability
--                        to open it (the lesson of 20260907110000).
--   project_room_opens   who opened what, and when. The reason a founder wants
--                        a room instead of a PDF attachment.
--
-- No anon/authenticated policies on purpose: a room is read by whoever holds a
-- token, which RLS cannot express without leaking every room to everyone. All
-- access is the service role, inside src/domain/projectRooms/service.ts, after
-- an ownership check (owner side) or a token lookup (investor side). Same shape
-- as profile_claims.

CREATE TABLE IF NOT EXISTS public.project_rooms (
  project_id UUID PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  headline TEXT CHECK (headline IS NULL OR char_length(headline) <= 200),
  -- [{ title, body }] — shape and limits are src/config/project-room.ts (zod),
  -- deliberately not a CHECK, like research verdicts.
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ label, value, verify }] — a figure and how a reader checks it. Typed by
  -- the owner until the room reads them from the build record (ADR-0012 D7);
  -- dated, because an undated number on a page that asks to be trusted about
  -- numbers is quietly false the day it goes stale.
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics_as_of DATE,
  deck_url TEXT CHECK (deck_url IS NULL OR deck_url ~ '^https://'),
  -- [{ title, url }]
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact_email TEXT CHECK (contact_email IS NULL OR char_length(contact_email) <= 254),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_room_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  -- Who this link is for, in the owner's words: "Anna Keller, Seedcamp".
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 120),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 254),
  -- A shared door (a product site's password) rather than one person.
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  first_opened_at TIMESTAMPTZ,
  last_opened_at TIMESTAMPTZ,
  open_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_project_room_links_project
  ON public.project_room_links (project_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.project_room_opens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.project_room_links(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  -- room = the page; deck / document / build = a thing inside it, followed
  -- through /room/<token>/open so the click is seen.
  what TEXT NOT NULL CHECK (what = ANY (ARRAY['room','deck','document','build']::text[])),
  -- Which document (its title at the time), NULL for the others.
  target TEXT CHECK (target IS NULL OR char_length(target) <= 200),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_room_opens_project
  ON public.project_room_opens (project_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_room_opens_link
  ON public.project_room_opens (link_id, opened_at DESC);

ALTER TABLE public.project_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_room_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_room_opens ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.project_rooms IS
  'The private investor room of a project (ADR-0012). Service-role only; see src/domain/projectRooms.';
COMMENT ON COLUMN public.project_room_links.token IS
  'The credential. /room/<token> is the link that gets sent; id stays internal so a link can be listed and revoked without exposing it.';
COMMENT ON TABLE public.project_room_opens IS
  'Who opened what in a room. A refresh within 30 minutes is the same visit and is not recorded twice.';

-- The owner hears about the first time each link is opened.
-- migration-safety: contract-ok widen-only CHECK swap — the new list is a
-- strict superset of the old one, so every insert the previous release makes
-- still passes; rollback-safe by construction.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'follow','payment','project_funded','message','comment','like','mention',
    'system','task_attention','task_request','task_completed','task_broadcast',
    'match','tip_dead_end','booking_request','booking_update','deal_review',
    'ticket','crew','group_invite','room_opened'
  ]::text[])
);
