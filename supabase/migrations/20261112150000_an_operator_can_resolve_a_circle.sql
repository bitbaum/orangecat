-- An operator can resolve a circle (ADR-0014 D10).
--
-- A person can hold several identities, and nothing public joins them. That is
-- the point for everyone else, and a problem for the one case where it must be
-- possible: acting on abuse. A person removed under one name must not be one
-- switch away under another, and an operator handed a report about @handle has
-- to be able to see what else that person holds before deciding anything.
--
-- This answers exactly that, for any handle: the holder and every identity it
-- holds. Service role only. It is not exposed to signed-in or anonymous
-- callers, so it adds no way for one user to learn another's identities.
--
-- It reads; it does not act. OrangeCat has no suspension mechanism today
-- (profiles.status has a 'suspended' value that nothing sets or enforces), so
-- there is nothing yet for a circle-wide ban to switch on. When there is, it
-- starts from this function.
--
-- Use, on the box:
--   SELECT * FROM public.identity_circle_of('some_handle');
--
-- Rollback: DROP FUNCTION public.identity_circle_of(text);

CREATE OR REPLACE FUNCTION public.identity_circle_of(p_username text)
RETURNS TABLE (
  role       text,
  user_id    uuid,
  username   text,
  name       text,
  linked_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH asked AS (
    SELECT p.id
      FROM public.profiles p
     WHERE lower(p.username) = lower(btrim(p_username, ' @'))
     LIMIT 1
  ),
  holder AS (
    -- The asked account's holder if it is an identity, else the account itself.
    SELECT COALESCE(
             (SELECT l.holder_user_id FROM public.identity_links l, asked a
               WHERE l.identity_user_id = a.id),
             (SELECT a.id FROM asked a)
           ) AS id
  )
  SELECT 'holder'::text, p.id, p.username, p.name, NULL::timestamptz
    FROM public.profiles p, holder h
   WHERE p.id = h.id
  UNION ALL
  SELECT 'identity'::text, p.id, p.username, p.name, l.created_at
    FROM public.identity_links l
    JOIN holder h ON l.holder_user_id = h.id
    JOIN public.profiles p ON p.id = l.identity_user_id
   ORDER BY 5 NULLS FIRST
$$;

REVOKE ALL ON FUNCTION public.identity_circle_of(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.identity_circle_of(text) TO service_role;

COMMENT ON FUNCTION public.identity_circle_of(text) IS
  'For operators acting on abuse (ADR-0014 D10): the holder and every identity it holds, for any handle in the circle. Service role only.';
