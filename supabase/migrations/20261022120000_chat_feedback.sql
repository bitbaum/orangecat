-- The answer feedback loop (fleet chat review, chatkit 0.14).
--
-- Under every Cat answer sits a thumb up and a thumb down; a thumb down asks
-- why (one of chatkit's FEEDBACK_REASONS) and takes a few words. What the
-- person said lands here, keyed to their conversation and the answer, and is
-- read back out by GET /api/chat/review-export so the fleet's nightly judge
-- sees the person's own verdict beside the transcript.
--
-- No user_id column on purpose: the row is reachable only through the
-- conversation it belongs to, which already names its owner, and the export
-- must carry no person-identifying field at all. message_id is text, not a
-- foreign key: a thumb given while an answer is still on screen carries the
-- client's id for that turn, and the write path resolves it to the stored
-- row where it can (src/services/cat/chat-feedback.ts).

CREATE TABLE IF NOT EXISTS public.chat_feedback (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES public.cat_conversations (id) ON DELETE CASCADE,
  message_id text NOT NULL CHECK (char_length(message_id) BETWEEN 1 AND 100),
  verdict text NOT NULL CHECK (verdict IN ('up', 'down')),
  reason text CHECK (
    reason IS NULL
    OR reason IN ('wrong', 'dead_end', 'vague', 'misread', 'too_long', 'format', 'other')
  ),
  text text CHECK (text IS NULL OR char_length(text) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_feedback_conversation
  ON public.chat_feedback (conversation_id, created_at DESC);

ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

-- The signed-in person may add a verdict to a conversation that is theirs.
-- Nobody reads through the API keys: there is no SELECT policy, so anon and
-- authenticated see nothing and only the service role (the token-gated
-- export route) reads the rows.
DROP POLICY IF EXISTS chat_feedback_insert_own ON public.chat_feedback;
CREATE POLICY chat_feedback_insert_own
  ON public.chat_feedback
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cat_conversations c
      WHERE c.id = conversation_id AND c.user_id = (SELECT auth.uid())
    )
  );
