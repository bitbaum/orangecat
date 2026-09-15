-- A companion remembers the person, not the owner.
--
-- WHY: AI assistants become Companions — beings with their own soul and a
-- memory of the person they talk to. That needs four things the schema did
-- not have:
--
--   1. companion_memories, keyed by (assistant_id, user_id). Memory belongs to
--      the RELATIONSHIP, not to the companion: a clone copies the definition
--      and none of these rows, and the companion's creator never reads another
--      person's rows.
--   2. The two policies that let an assistant's OWNER read every other user's
--      conversations and messages are dropped. Nothing in the app read through
--      them (stats are a denormalised column kept by trigger; revenue uses the
--      admin client). A companion someone confides in cannot be read by whoever
--      made her.
--   3. ai_messages had no DELETE policy, so the cleanup of a user's message
--      after a failed model call silently deleted zero rows and left an orphan
--      in the thread (same class as 20260731110000 for cat_messages).
--   4. ai_assistants.cloned_from — where a clone came from.
--
-- Conventions copied from cat_memories (baseline): printcraft.vector(1536),
-- hnsw cosine index, owner-scoped RLS, match_* RPC granted to client roles.
-- Replay-idempotent throughout.

-- ── 1. companion_memories ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.companion_memories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL PRIMARY KEY,
    assistant_id uuid NOT NULL REFERENCES public.ai_assistants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content text NOT NULL,
    embedding printcraft.vector(1536),
    source text DEFAULT 'chat' NOT NULL,
    source_conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.companion_memories IS
  'What a companion remembers about ONE person. Keyed by (assistant_id, user_id); never read across pairs, never copied on clone.';

CREATE INDEX IF NOT EXISTS companion_memories_pair_created
    ON public.companion_memories (assistant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS companion_memories_hnsw
    ON public.companion_memories USING hnsw (embedding printcraft.vector_cosine_ops);

ALTER TABLE public.companion_memories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_memories'
      AND policyname = 'Users can view own companion memories'
  ) THEN
    CREATE POLICY "Users can view own companion memories" ON public.companion_memories
      FOR SELECT USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_memories'
      AND policyname = 'Users can insert own companion memories'
  ) THEN
    CREATE POLICY "Users can insert own companion memories" ON public.companion_memories
      FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_memories'
      AND policyname = 'Users can update own companion memories'
  ) THEN
    CREATE POLICY "Users can update own companion memories" ON public.companion_memories
      FOR UPDATE USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'companion_memories'
      AND policyname = 'Users can delete own companion memories'
  ) THEN
    CREATE POLICY "Users can delete own companion memories" ON public.companion_memories
      FOR DELETE USING (user_id = (SELECT auth.uid()));
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companion_memories TO authenticated;
GRANT ALL ON public.companion_memories TO service_role;

-- Semantic recall for one pair, mirroring match_cat_memories.
CREATE OR REPLACE FUNCTION public.match_companion_memories(
    p_assistant_id uuid,
    p_user_id uuid,
    query_embedding printcraft.vector,
    match_count integer DEFAULT 6,
    min_similarity double precision DEFAULT 0.3
) RETURNS TABLE(id uuid, content text, similarity double precision, created_at timestamptz)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'printcraft'
    AS $$
  select
    cm.id,
    cm.content,
    1 - (cm.embedding <=> query_embedding) as similarity,
    cm.created_at
  from public.companion_memories cm
  where cm.assistant_id = p_assistant_id
    and cm.user_id = p_user_id
    and cm.embedding is not null
    and 1 - (cm.embedding <=> query_embedding) >= min_similarity
  order by cm.embedding <=> query_embedding
  limit match_count;
$$;

GRANT ALL ON FUNCTION public.match_companion_memories(uuid, uuid, printcraft.vector, integer, double precision) TO authenticated;
GRANT ALL ON FUNCTION public.match_companion_memories(uuid, uuid, printcraft.vector, integer, double precision) TO service_role;

-- ── 2. The owner cannot read other people's conversations ──────────────────

DROP POLICY IF EXISTS "Assistant owners can view conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Assistant owners can view messages" ON public.ai_messages;

-- ── 3. A failed turn's orphan message can actually be deleted ──────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_messages'
      AND policyname = 'Users can delete messages in own conversations'
  ) THEN
    CREATE POLICY "Users can delete messages in own conversations" ON public.ai_messages
      FOR DELETE USING (
        conversation_id IN (
          SELECT id FROM public.ai_conversations WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END $$;

-- ── 4. Where a clone came from ─────────────────────────────────────────────

ALTER TABLE public.ai_assistants
  ADD COLUMN IF NOT EXISTS cloned_from uuid REFERENCES public.ai_assistants(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ai_assistants.cloned_from IS
  'The companion this one was cloned from. The definition was copied; no memories were.';
