-- What the Cat or a bot made carries its name.
--
-- When a listing is created by an action (the Cat's own, or a bot's proposal
-- its owner confirmed), one row here says so: which entity, and which bot. A
-- row with made_by = 'cat' was made with the person's Cat; made_by = 'bot'
-- names the companion in made_with_assistant_id. The public page reads it to
-- show "Made with <bot>", the byline that lets a bot be proud of its work.
--
-- One table keyed by (entity_type, entity_id) rather than a column on each of
-- the dozen entity tables: the provenance is one fact about any entity, and
-- the entity types come from ENTITY_REGISTRY, not from this schema.
--
-- Service role only, as companion_seats is: RLS on, no policy. The executor
-- writes it after a create succeeds; the public page reads it server-side.
-- Nothing here lets a browser claim a bot made something it did not.
--
-- Rollback: drop table public.entity_provenance; (nothing else reads it; the
-- byline simply stops showing).

create table if not exists public.entity_provenance (
  entity_type text not null check (char_length(entity_type) between 1 and 40),
  entity_id uuid not null,
  made_by text not null check (made_by in ('cat', 'bot')),
  -- Null for the Cat, and for a bot that has since been deleted (the row then
  -- still says a bot made it, without a name to link to).
  made_with_assistant_id uuid references public.ai_assistants (id) on delete set null,
  created_at timestamp with time zone not null default now(),
  primary key (entity_type, entity_id)
);

create index if not exists entity_provenance_assistant_idx
  on public.entity_provenance (made_with_assistant_id)
  where made_with_assistant_id is not null;

comment on table public.entity_provenance is
  'Which entities the Cat or a bot made, and which bot (the "Made with" byline). Read and written only by the service role.';

alter table public.entity_provenance enable row level security;
revoke all on public.entity_provenance from anon, authenticated;
grant all on public.entity_provenance to service_role;
