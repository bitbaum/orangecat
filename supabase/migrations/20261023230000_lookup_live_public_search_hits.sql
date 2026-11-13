-- A semantic index may lag a deletion, visibility change or edit. Hydrate its
-- candidate IDs through the SAME current public gate as Discover and search.
-- Never return the index's stale title, URL or text directly to a caller.
CREATE OR REPLACE FUNCTION public.lookup_public_documents(
  p_keys jsonb,
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL
)
RETURNS TABLE(
  entity_type text, id uuid, title text, snippet text, image_url text,
  path_key text, amount numeric, currency text, starts_at timestamptz,
  place text, created_at timestamptz, rank real, total bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  WITH candidates AS (
    SELECT DISTINCT item->>'type' AS kind, (item->>'id')::uuid AS key
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_keys) = 'array' THEN p_keys ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS input(item, position)
     WHERE position <= 50
  )
  SELECT d.entity_type, d.id, d.title, left(coalesce(d.body, ''), 240), d.image_url,
         d.path_key, d.amount, d.currency, d.starts_at, d.place, d.created_at,
         0::real, 1::bigint
    FROM public.public_documents() d
    JOIN candidates c ON c.kind = d.entity_type AND c.key = d.id
   WHERE NOT (coalesce(d.title, '') LIKE ANY (coalesce(p_exclude_title_like, '{}')))
     AND NOT (coalesce(d.handle, '') ILIKE ANY (coalesce(p_exclude_handle_ilike, '{}')))
     AND NOT (lower(coalesce(d.handle, '')) = ANY (coalesce(p_exclude_handles, '{}')))
$$;

REVOKE ALL ON FUNCTION public.lookup_public_documents(jsonb, text[], text[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_documents(jsonb, text[], text[], text[]) TO anon, authenticated, service_role;
