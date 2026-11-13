-- A bot that can be written to in Messages has a seat: an account of its own.
--
-- ADR-0015 (one messenger for people and bots), D1 and D2. The Cat is already
-- an account, which is why a Cat reply is an ordinary `messages` row and read
-- receipts, search, deletion and realtime work on it without a branch. A
-- companion (`ai_assistants`) gets the same: an auth user nobody signs in to,
-- a profile with its name and face, and this row saying which companion the
-- account speaks for.
--
-- "Is this account an agent" is read from here, not from a username.
--
-- Service role only, as identity_links is: RLS on, no policy. Who owns a
-- companion is already public on the companion itself; what this table adds is
-- only which account is its seat, and nothing in a browser needs that.
--
-- Rollback: drop table public.companion_seats; (the seat accounts are then
-- ordinary empty accounts on undeliverable addresses and can be deleted).

create table if not exists public.companion_seats (
  -- The seat's auth user / profile id.
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Null once the companion is deleted. The seat stays, so the conversations
  -- it sat in still say a bot wrote those lines, and a message to it is told
  -- the bot is gone instead of being met with silence from a "person".
  assistant_id uuid unique references public.ai_assistants (id) on delete set null,
  created_at timestamp with time zone not null default now()
);

comment on table public.companion_seats is
  'Which account speaks for which companion in Messages (ADR-0015). Read and written only by the service role.';

alter table public.companion_seats enable row level security;
revoke all on public.companion_seats from anon, authenticated;
