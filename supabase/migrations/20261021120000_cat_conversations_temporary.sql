-- Temporary chats (src/lib/chat/temporary-chat.ts): a conversation the person
-- opened as "temporary" is never listed, never read into memory, deleted when
-- they leave it, and swept after a day regardless (cron: cleanup).
ALTER TABLE public.cat_conversations
  ADD COLUMN IF NOT EXISTS ephemeral boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cat_conversations_ephemeral_updated
  ON public.cat_conversations (updated_at)
  WHERE ephemeral = true;
