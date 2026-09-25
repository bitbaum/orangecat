-- The `project-files` storage bucket belongs to PrintCraft, which runs on this
-- Supabase instance: memorial portraits of real people, uploaded by guests
-- through the anon key (all guests share one folder, GUEST_USER_ID).
-- PrintCraft's own migrations created these policies and already dropped anon
-- UPDATE/DELETE (printcraft 20260824064500_restrict_storage_writes). It lives
-- here because this repo owns the database and applies migrations to it.
--
-- What was still open:
--
-- 1. "Anon can read" — SELECT on storage.objects for the whole bucket. The
--    public object URL does not consult RLS, so the app never needed it; what
--    it DID grant is the storage LIST endpoint: any visitor with the anon key
--    (it ships in every page) could enumerate every path and download every
--    customer's original WhatsApp photos. PrintCraft only ever uploads and
--    renders public URLs (src/lib/supabase/storage.ts) — no list, no download.
--
-- 2. "Anon can upload" — any file, any size, any path in the bucket: free,
--    unmetered hosting on our domain for whatever anyone wants to put there.
--    Guest mode still needs to upload, so the policy stays, narrowed to the
--    exact shape PrintCraft writes: <user>/<project>/<type>/<file> with one of
--    its four types. The bucket itself now takes images only, 25 MB max
--    (PrintCraft's pickers are all accept="image/*").

drop policy if exists "Anon can read" on storage.objects;

drop policy if exists "Anon can upload" on storage.objects;
create policy "Anon can upload" on storage.objects
  for insert
  with check (
    bucket_id = 'project-files'
    and array_length(storage.foldername(name), 1) = 3
    and (storage.foldername(name))[3] in ('originals', 'styled', 'backgrounds', 'exports')
  );

update storage.buckets
set
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
  ]
where id = 'project-files';
