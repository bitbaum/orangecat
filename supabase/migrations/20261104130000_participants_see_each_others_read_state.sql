-- Read receipts never showed: the sender's client reads the other members'
-- last_read_at from conversation_participants, but the only SELECT policy was
-- conv_participants_select_own (user_id = auth.uid()), so every member saw just
-- their own row and every sent message stayed at a single "Delivered" tick.
--
-- Members of a conversation may now see the other members' rows of THAT
-- conversation (who is in it and how far they have read) — nothing else.
-- The membership check runs in a SECURITY DEFINER function so the policy does
-- not recurse into itself.

create or replace function public.is_active_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
      and is_active = true
  );
$$;

revoke all on function public.is_active_conversation_member(uuid) from public, anon;
grant execute on function public.is_active_conversation_member(uuid) to authenticated;

drop policy if exists conv_participants_select_comembers on public.conversation_participants;
create policy conv_participants_select_comembers on public.conversation_participants
  for select to authenticated
  using (public.is_active_conversation_member(conversation_id));
