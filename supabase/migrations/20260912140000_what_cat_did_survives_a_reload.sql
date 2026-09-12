-- What Cat DID must outlive the tab it did it in.
--
-- Chips are the only record a user has of Cat's work: searched the web, read a
-- page, created a project, sent a payment. They lived entirely in React state,
-- so `useChatHistory` rebuilt a reloaded thread from `cat_messages` and every
-- chip vanished. The reply survived; the evidence behind it did not.
--
-- That is worse than cosmetic in two specific places. Citations are rendered
-- from the tool calls that produced them, so a reloaded answer kept its `[F1]`
-- handles with nothing to link them to (ADR-0007 D1, ADR-0008 D5). And an
-- action still awaiting confirmation lost its chip entirely rather than
-- resolving — the user reloads, and the thing they were asked to confirm is
-- simply not mentioned any more.
--
-- Nullable on purpose: every row written before this migration returns NULL and
-- renders exactly as it does today, which is the behaviour we are replacing,
-- not a regression. No backfill is possible — the data was never stored.
--
-- A column rather than a table because a tool call has no life of its own: it
-- belongs to one message, is read only with that message, and dies with it
-- (cat_messages already cascades from cat_conversations).
ALTER TABLE public.cat_messages
  ADD COLUMN IF NOT EXISTS tool_calls JSONB;

COMMENT ON COLUMN public.cat_messages.tool_calls IS
  'ToolCallEvent[] for this assistant turn — what Cat did, so a reloaded thread can still show it. Written capped and trimmed by saveMessages; NULL for rows written before 2026-09-12.';
