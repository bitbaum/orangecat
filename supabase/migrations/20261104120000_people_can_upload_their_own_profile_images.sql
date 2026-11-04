-- Avatar, banner, article-cover and wishlist-proof uploads all failed on the
-- live site with "new row violates row-level security policy" (shown to people
-- as "Upload failed"). The browser uploads straight to Supabase Storage with the
-- signed-in user's token, and storage.objects had NO insert/update policy for
-- the `avatars`, `banners` or `proofs` buckets on the self-hosted instance: the
-- policies had been created by hand in the old hosted dashboard and were never
-- in a migration, so they did not survive the move. This puts them in the repo.
--
-- Rules (public reads keep using the public object URL, which skips RLS, so no
-- bucket-wide SELECT/list is granted):
--   avatars, banners: a signed-in user writes only under `<their uid>/...`.
--   proofs: only the owner of the wishlist item writes under `<item id>/...`.

-- avatars + banners ---------------------------------------------------------
drop policy if exists "Own profile images: insert" on storage.objects;
create policy "Own profile images: insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Own profile images: select" on storage.objects;
create policy "Own profile images: select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Own profile images: update" on storage.objects;
create policy "Own profile images: update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Own profile images: delete" on storage.objects;
create policy "Own profile images: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- proofs ----------------------------------------------------------------------
drop policy if exists "Wishlist owner proofs: insert" on storage.objects;
create policy "Wishlist owner proofs: insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'proofs'
    and exists (
      select 1
      from public.wishlist_items wi
      join public.wishlists w on w.id = wi.wishlist_id
      join public.actors a on a.id = w.actor_id
      where wi.id::text = (storage.foldername(name))[1]
        and a.user_id = (select auth.uid())
    )
  );

drop policy if exists "Wishlist owner proofs: delete" on storage.objects;
create policy "Wishlist owner proofs: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'proofs' and owner_id = (select auth.uid())::text);

-- Both profile buckets: images only, 5 MB (the client shrinks bigger photos).
update storage.buckets
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
where id in ('avatars', 'banners');
