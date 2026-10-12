-- Search finds what was meant, not only what was typed.
--
-- "cqto" did not find Cato. pg_trgm scores the pair at 0.4 (2 of 5 trigrams
-- shared), under the 0.5 threshold that keeps "loki" from finding "loan"; and
-- fuzzystrmatch's levenshtein counts a swapped pair ("kayne") as two edits.
-- No threshold fixes both, because similarity is the wrong measure for a
-- typo. Counting edits is the right one, and it lives in @bitbaum/searchkit
-- (packages/searchkit), shared by every site:
--
--   1. public_search_text() hands the app every public title and handle, from
--      which it builds the collection's vocabulary (cached);
--   2. the app expands what was typed into the vocabulary words within the
--      typo budget (0 under 4 letters, 1 from 4, 2 from 8 — a swap is one);
--   3. search_public(..., p_terms) treats any of those words as a match, so
--      the database stays exact-and-prefix and keeps its indexes;
--   4. the app ranks the candidates (typos, words, field, exactness, …).
--
-- The new parameter changes the signature, so the function is dropped and
-- created; global_search() calls it by position with defaults and is unaffected.
--
-- Rollback: drop both functions here and re-run search_public from
-- 20261012120000_one_search_engine.sql with its GRANT.

DROP FUNCTION IF EXISTS public.search_public(text, text[], integer, integer, integer, text[], text[], text[]);

CREATE FUNCTION public.search_public(
  p_query text DEFAULT '',
  p_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_per_type integer DEFAULT NULL,
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL,
  p_terms text[] DEFAULT NULL
)
RETURNS TABLE(
  entity_type text, id uuid, title text, snippet text, image_url text,
  path_key text, amount numeric, currency text, starts_at timestamptz,
  place text, created_at timestamptz, rank real, total bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
#variable_conflict use_column
DECLARE
  uq   text := btrim(public.f_unaccent(coalesce(p_query, '')));
  lim  integer := least(greatest(coalesce(p_limit, 24), 0), 200);
  off  integer := greatest(coalesce(p_offset, 0), 0);
  tl   text[] := coalesce(p_exclude_title_like, '{}');
  hl   text[] := coalesce(p_exclude_handle_ilike, '{}');
  hx   text[] := coalesce(p_exclude_handles, '{}');
  pat  text;
  pfx  text;
  q    tsquery;
  pq   tsquery;
  tq   tsquery;
BEGIN
  IF uq = '' THEN
    -- Browse: everything public, newest first.
    RETURN QUERY
    WITH page AS (
      SELECT d.*, count(*) OVER () AS n,
             row_number() OVER (PARTITION BY d.entity_type ORDER BY d.created_at DESC) AS rn
        FROM public.public_documents() d
       WHERE (p_types IS NULL OR d.entity_type = ANY (p_types))
         AND NOT (coalesce(d.title, '') LIKE ANY (tl))
         AND NOT (coalesce(d.handle, '') ILIKE ANY (hl))
         AND NOT (lower(coalesce(d.handle, '')) = ANY (hx))
    )
    SELECT page.entity_type, page.id, page.title, left(coalesce(page.body, ''), 240),
           page.image_url, page.path_key, page.amount, page.currency, page.starts_at,
           page.place, page.created_at, 0::real, page.n
      FROM page
     WHERE p_per_type IS NULL OR page.rn <= p_per_type
     ORDER BY page.created_at DESC NULLS LAST, page.id
     LIMIT lim OFFSET off;
    RETURN;
  END IF;

  -- The word_similarity threshold behind <%: 0.5 catches one wrong or missing
  -- letter in a short word ("lokii", "bitcon"); 0.4 let "loki" find "loan".
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.5', true);

  pat := '%' || replace(replace(replace(uq, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  pfx := replace(replace(replace(uq, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  -- Every word as a prefix, all required: "lo" finds Loki, "bit pay" finds
  -- "Bitcoin payments". websearch_to_tsquery alone only matches whole words.
  SELECT to_tsquery('english', string_agg(quote_literal(t) || ':*', ' & '))
    INTO pq
    FROM unnest(regexp_split_to_array(lower(regexp_replace(uq, '[^[:alnum:]]+', ' ', 'g')), ' ')) AS t
   WHERE t <> '';
  q := websearch_to_tsquery('english', uq);
  IF pq IS NOT NULL AND numnode(pq) > 0 THEN
    q := CASE WHEN numnode(q) > 0 THEN q || pq ELSE pq END;
  END IF;

  -- What the typed words could mean: spellings the caller found in the
  -- collection's own vocabulary within the typo budget (searchkit). Any one
  -- of them is enough to be a candidate; the caller ranks the candidates.
  SELECT to_tsquery('english', string_agg(quote_literal(t) || ':*', ' | '))
    INTO tq
    FROM (
      SELECT DISTINCT lower(regexp_replace(public.f_unaccent(x), '[^[:alnum:]]+', '', 'g')) AS t
        FROM unnest(coalesce(p_terms, '{}')) AS x
       LIMIT 40
    ) terms
   WHERE t <> '';
  IF tq IS NOT NULL AND numnode(tq) > 0 THEN
    q := CASE WHEN numnode(q) > 0 THEN q || tq ELSE tq END;
  END IF;

  RETURN QUERY
  WITH hits AS (
    SELECT d.*,
           public.f_unaccent(coalesce(d.title, '')) AS ut,
           (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(d.match_title, '') || ' ' || coalesce(d.body, ''))), q)
            + 0.6 * word_similarity(uq, public.f_unaccent(coalesce(d.match_title, ''))))::real AS base
      FROM public.public_documents() d
     WHERE (p_types IS NULL OR d.entity_type = ANY (p_types))
       AND (
             to_tsvector('english', public.f_unaccent(coalesce(d.match_title, '') || ' ' || coalesce(d.body, ''))) @@ q
          OR public.f_unaccent(coalesce(d.match_title, '')) ILIKE pat
          OR uq <% public.f_unaccent(coalesce(d.match_title, ''))
           )
       AND NOT (coalesce(d.title, '') LIKE ANY (tl))
       AND NOT (coalesce(d.handle, '') ILIKE ANY (hl))
       AND NOT (lower(coalesce(d.handle, '')) = ANY (hx))
  ),
  scored AS (
    SELECT h.*,
           (h.base
            + CASE WHEN lower(h.ut) = lower(uq) OR lower(coalesce(h.handle, '')) = lower(uq) THEN 1.5
                   WHEN h.ut ILIKE pfx OR coalesce(h.handle, '') ILIKE pfx THEN 0.8
                   WHEN h.ut ILIKE '% ' || pfx THEN 0.4
                   ELSE 0 END)::real AS rk
      FROM hits h
  ),
  ranked AS (
    SELECT s.*, count(*) OVER () AS n,
           row_number() OVER (PARTITION BY s.entity_type ORDER BY s.rk DESC, s.created_at DESC) AS rn
      FROM scored s
  )
  SELECT r.entity_type, r.id, r.title, left(coalesce(r.body, ''), 240), r.image_url,
         r.path_key, r.amount, r.currency, r.starts_at, r.place, r.created_at, r.rk, r.n
    FROM ranked r
   WHERE p_per_type IS NULL OR r.rn <= p_per_type
   ORDER BY r.rk DESC, r.created_at DESC NULLS LAST, r.id
   LIMIT lim OFFSET off;
END $$;

GRANT EXECUTE ON FUNCTION public.search_public(text, text[], integer, integer, integer, text[], text[], text[], text[]) TO anon, authenticated, service_role;

-- Every public title and handle, for the vocabulary. The same rows and the
-- same fixture filters as search_public, so a correction can only ever point
-- at something a search can return.
CREATE OR REPLACE FUNCTION public.public_search_text(
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL
)
RETURNS TABLE(text text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT coalesce(d.match_title, '')
    FROM public.public_documents() d
   WHERE NOT (coalesce(d.title, '') LIKE ANY (coalesce(p_exclude_title_like, '{}')))
     AND NOT (coalesce(d.handle, '') ILIKE ANY (coalesce(p_exclude_handle_ilike, '{}')))
     AND NOT (lower(coalesce(d.handle, '')) = ANY (coalesce(p_exclude_handles, '{}')))
$$;

GRANT EXECUTE ON FUNCTION public.public_search_text(text[], text[], text[]) TO anon, authenticated, service_role;
