-- A topic watch stores its vector, so the timer that checks it never embeds.
--
-- cat-watches runs every 15 minutes. A topic_match watch used to embed its
-- topic on every tick — 96 embedding calls a day per watch, on the platform's
-- own key, with nobody asking. The standing rule on this box is that a model
-- or embedding key is spent only when a person deliberately asks. The person
-- asks once, when they create the watch; that is when the vector is computed
-- (services/cat/handlers/interests.ts watch_topic) and stored here. The timer
-- reads it back (services/cat/proactive.ts).
--
-- Nullable: a watch created before this column has no vector and simply
-- cannot fire (there were none in production when this shipped). Same type as
-- cat_interests.embedding, whose vector extension lives in `printcraft`.
--
-- Idempotent.

ALTER TABLE public.cat_watches
  ADD COLUMN IF NOT EXISTS topic_embedding printcraft.vector(1536);

COMMENT ON COLUMN public.cat_watches.topic_embedding IS
  'topic_match only: the topic embedded once at creation (user action). The cat-watches timer matches with it and never calls the embedding provider.';
