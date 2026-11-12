-- A public project update (written by an agent run on 2026-09-06) quotes two
-- old handles that were plus-addressed aliases of their owners' email
-- addresses (`<local part>+ocauth<N>`). The handles themselves were retired by
-- 20260818140000 and 20260826130000, but the post text kept them: a public
-- project page still printed an email local part, and the mention renderer
-- linked it to a profile that now answers 404.
--
-- Rewrites any such alias in timeline text to a neutral phrase. It matches the
-- alias's shape, never a name, so this file identifies no one.
--
-- Rollback: none. The removed words identified a person and told a reader
-- nothing the neutral phrase does not.

UPDATE public.timeline_events
SET description = regexp_replace(
      description,
      '@?[A-Za-z0-9._-]+\+ocauth[0-9]+(\s+@[A-Za-z0-9._-]+\+ocauth[0-9]+)?',
      'an old test account',
      'g'
    ),
    updated_at = now()
WHERE description ~ '\+ocauth[0-9]';

UPDATE public.timeline_events
SET title = regexp_replace(
      title,
      '@?[A-Za-z0-9._-]+\+ocauth[0-9]+',
      'an old test account',
      'g'
    ),
    updated_at = now()
WHERE title ~ '\+ocauth[0-9]';
