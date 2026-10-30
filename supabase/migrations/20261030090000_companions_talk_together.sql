-- Companions talk together.
--
-- WHY: a companion so far spoke only in a one-to-one thread (ai_conversations).
-- The talk page now lays companions out the way a messaging app does — every
-- companion a contact, a group chat a room — and in a room two to six of them
-- answer in turn, hand work to each other with an @mention, and each line says
-- who said it. That needs three tables the schema did not have:
--
--   1. companion_rooms         — a group chat, owned by the person who opened it.
--   2. companion_room_members  — who is in it: one of the person's companions
--                                (assistant_id) OR one of the fleet's own bots
--                                (fleet_slug, a product that answers at /api/ask).
--                                Exactly one of the two is set.
--   3. companion_room_messages — the transcript. A bot's line keeps the member
--                                it came from and the name it had at the time,
--                                so the thread still reads after a rename.
--
-- A room is the owner's alone: a companion's creator never reads a room their
-- companion was invited to, the same rule as 20260915090000 set for
-- conversations. Nothing here writes companion_memories: what is said in a
-- group is not a confidence between one person and one companion.
--
-- Replay-idempotent throughout.
-- Rollback: DROP TABLE public.companion_room_messages, public.companion_room_members,
--           public.companion_rooms;

-- ── 1. companion_rooms ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companion_rooms (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    last_message_at timestamptz
);

COMMENT ON TABLE public.companion_rooms IS
  'A group chat between a person and two to six companions. Owned by the person; nobody else reads it.';

CREATE INDEX IF NOT EXISTS companion_rooms_owner_recent
    ON public.companion_rooms (user_id, last_message_at DESC NULLS LAST, created_at DESC);

-- ── 2. companion_room_members ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companion_room_members (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES public.companion_rooms(id) ON DELETE CASCADE,
    assistant_id uuid REFERENCES public.ai_assistants(id) ON DELETE CASCADE,
    fleet_slug text,
    position integer DEFAULT 0 NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT companion_room_members_one_kind
      CHECK ((assistant_id IS NULL) <> (fleet_slug IS NULL)),
    CONSTRAINT companion_room_members_unique_assistant UNIQUE (room_id, assistant_id),
    CONSTRAINT companion_room_members_unique_fleet UNIQUE (room_id, fleet_slug)
);

COMMENT ON TABLE public.companion_room_members IS
  'Who sits in a room: one of the person''s companions (assistant_id) or one of the fleet''s bots (fleet_slug). Exactly one is set.';

CREATE INDEX IF NOT EXISTS companion_room_members_room
    ON public.companion_room_members (room_id, position);

-- ── 3. companion_room_messages ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companion_room_messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES public.companion_rooms(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('user', 'assistant')),
    member_id uuid REFERENCES public.companion_room_members(id) ON DELETE SET NULL,
    speaker text,
    content text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.companion_room_messages IS
  'The transcript of a room. An assistant line names the member it came from and the name it had when it spoke.';

CREATE INDEX IF NOT EXISTS companion_room_messages_room_created
    ON public.companion_room_messages (room_id, created_at);

-- ── RLS: the owner, and only the owner ──────────────────────────────────────

ALTER TABLE public.companion_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_room_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_rooms'
      AND policyname = 'Users manage own companion rooms'
  ) THEN
    CREATE POLICY "Users manage own companion rooms" ON public.companion_rooms
      FOR ALL USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_room_members'
      AND policyname = 'Users manage members of own companion rooms'
  ) THEN
    CREATE POLICY "Users manage members of own companion rooms" ON public.companion_room_members
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.companion_rooms r
          WHERE r.id = room_id AND r.user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.companion_rooms r
          WHERE r.id = room_id AND r.user_id = (SELECT auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_room_messages'
      AND policyname = 'Users manage messages of own companion rooms'
  ) THEN
    CREATE POLICY "Users manage messages of own companion rooms" ON public.companion_room_messages
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.companion_rooms r
          WHERE r.id = room_id AND r.user_id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.companion_rooms r
          WHERE r.id = room_id AND r.user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_rooms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_room_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_room_messages TO authenticated;
GRANT ALL ON public.companion_rooms TO service_role;
GRANT ALL ON public.companion_room_members TO service_role;
GRANT ALL ON public.companion_room_messages TO service_role;
