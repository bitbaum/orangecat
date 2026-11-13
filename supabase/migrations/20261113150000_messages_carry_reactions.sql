-- A message can be reacted to: one emoji per person per message.
--
-- Owner, 2026-11-13: the Messenger has to stand beside WhatsApp, Telegram and
-- Signal. Reacting is the smallest answer there is, and until now the only
-- way to acknowledge a message was to write another one.
--
-- Why a table and not a map in messages.metadata: two people reacting to the
-- same message at the same moment would each read the map, add themselves and
-- write it back, and one of them would vanish. A row per (message, person) has
-- no such race, and the primary key IS the rule "one per person".
--
-- Nothing reads or writes this table from a browser. PUT
-- /api/messages/reactions decides by PARTICIPATION and uses the service role,
-- so RLS is on with no policies: the default is "no".
--
-- Rollback: drop table public.message_reactions;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamp with time zone not null default now(),
  primary key (message_id, user_id),
  constraint message_reactions_emoji_check check (char_length(emoji) between 1 and 16)
);

comment on table public.message_reactions is
  'One emoji per person per direct message. Read and written only by the service role behind /api/messages/reactions and the message loader.';

alter table public.message_reactions enable row level security;
revoke all on public.message_reactions from anon, authenticated;
