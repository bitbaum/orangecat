-- Messages can carry files: photos, videos, recordings, documents.
--
-- Until now a direct message was words only (owner, 2026-11-12: "attaching
-- things is important here ... people send each other pictures and videos all
-- the time"). The bytes go to a PRIVATE storage bucket (Cloudflare R2 behind
-- storage-api, docs/operations/STORAGE_R2_BACKEND.md) and this table is the
-- ledger of them: what each file is, whose it is, which message it is on.
--
-- Why a table and not a list in messages.metadata:
--   - the quota is a sum over one person's rows;
--   - an upload that never became a message has to be findable to be swept;
--   - deleting a message has to find its objects;
--   - `messages` is the hot table, and realtime ships its rows to every
--     reader: it should not grow a blob of file metadata per row.
--
-- Nothing reads or writes this table from a browser. The routes under
-- /api/messages/attachments decide by PARTICIPATION (is this person in the
-- conversation the file belongs to?) and use the service role, so there are no
-- policies for `anon` or `authenticated` at all — RLS is on and the default is
-- "no". The same holds for the bucket: no storage.objects policy names it, so
-- only a signed URL the server issued can put an object in or get one out.

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- null until the upload is sent on a message.
  message_id uuid references public.messages (id) on delete set null,
  -- The auth user who uploaded it: whose quota it counts against.
  uploader_id uuid not null,
  kind text not null,
  name text not null,
  mime_type text not null,
  bytes bigint not null,
  width integer,
  height integer,
  duration_ms integer,
  -- Object keys in the `message-attachments` bucket. Never a URL: a link to a
  -- private file is issued per reader, per request, and expires.
  storage_path text not null,
  poster_path text,
  created_at timestamp with time zone not null default now(),
  sent_at timestamp with time zone,
  -- Set when the message it was on is deleted (or its uploader's account is):
  -- the row stays until the daily cleanup has removed the objects, so a
  -- deleted message cannot leave bytes behind that nothing knows about.
  removed_at timestamp with time zone,
  constraint message_attachments_kind_check
    check (kind = any (array['image'::text, 'video'::text, 'audio'::text, 'file'::text])),
  constraint message_attachments_bytes_check check (bytes > 0),
  constraint message_attachments_storage_path_key unique (storage_path)
);

comment on table public.message_attachments is
  'Files sent with direct messages. Bytes live in the private message-attachments bucket; rows are read and written only by the service role behind /api/messages/attachments.';

-- A message's files, when its page of the thread is loaded.
create index if not exists message_attachments_message_id_idx
  on public.message_attachments (message_id)
  where message_id is not null;

-- What one person has stored: the quota is a sum over this.
create index if not exists message_attachments_uploader_live_idx
  on public.message_attachments (uploader_id)
  where removed_at is null;

-- The daily sweep: uploads that were never sent, and files whose message is gone.
create index if not exists message_attachments_sweep_idx
  on public.message_attachments (created_at)
  where sent_at is null or removed_at is not null;

alter table public.message_attachments enable row level security;
revoke all on table public.message_attachments from anon, authenticated;
grant all on table public.message_attachments to service_role;

-- The bucket: private, capped at the largest file the policy takes (a 50 MB
-- video; src/config/message-attachments.ts is the policy and the per-kind
-- ceilings), and only the types the policy names. storage-api enforces both on
-- every upload, signed URL or not — so a caller who lies to the route about a
-- file's size or type is still refused by the storage itself.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  52428800,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/x-wav', 'audio/x-m4a',
    'application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/json',
    'application/zip', 'application/rtf', 'application/msword',
    'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/epub+zip'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- What one person has stored and not deleted, in bytes: the number the quota
-- is compared against before an upload is allowed. A function, so the sum is
-- one indexed aggregate in the database and not thousands of rows pulled into
-- the app to be added up.
create or replace function public.message_attachment_bytes(p_uploader uuid)
returns bigint
language sql
stable
set search_path = public
as $$
  select coalesce(sum(bytes), 0)::bigint
  from public.message_attachments
  where uploader_id = p_uploader
    and removed_at is null;
$$;

revoke all on function public.message_attachment_bytes(uuid) from public, anon, authenticated;
grant execute on function public.message_attachment_bytes(uuid) to service_role;
