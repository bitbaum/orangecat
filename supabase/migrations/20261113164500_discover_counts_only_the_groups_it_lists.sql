-- Discover counts only the groups it lists.
--
-- On 2026-11-12 /discover?type=groups said "8 organizations" and showed five.
-- Three public groups minted by CI audits ("Audit Group 1783191071580" and two
-- like it) were counted by public_counts and by search_public's total, and the
-- app dropped them only after the rows came back. So the count never matched
-- the list, and "Show more" kept offering a next page of the same five.
--
-- The group-name rule now travels as a parameter, like the other fixture
-- filters: p_exclude_group_names, POSIX patterns matched case-insensitively
-- against the name of each group row (and only group rows). The patterns live
-- once, in src/config/public-directory.ts (FIXTURE_GROUP_NAME_PATTERNS) — the
-- list the dashboard's groups query and the app-side check read too.
--
-- A new parameter changes each signature, so the three functions are dropped
-- and created. It comes last and defaults to NULL, so a caller that does not
-- pass it (global_search, or the running release while a deploy applies this)
-- gets exactly the old result. Each body is otherwise unchanged: search_public
-- and public_search_text as in 20261012170000_search_finds_what_was_meant.sql,
-- public_counts as in 20261012120000_one_search_engine.sql.
--
-- Rollback: drop the three functions here, then re-run search_public and
-- public_search_text from 20261012170000 and public_counts from 20261012120000,
-- with their GRANTs.

DROP FUNCTION IF EXISTS public.search_public(text, text[], integer, integer, integer, text[], text[], text[], text[]);

CREATE FUNCTION public.search_public(
  p_query text DEFAULT '',
  p_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_per_type integer DEFAULT NULL,
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL,
  p_terms text[] DEFAULT NULL,
  p_exclude_group_names text[] DEFAULT NULL
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
  gx   text[] := coalesce(p_exclude_group_names, '{}');
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
         AND NOT (d.entity_type = 'group' AND coalesce(d.title, '') ~* ANY (gx))
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
       AND NOT (d.entity_type = 'group' AND coalesce(d.title, '') ~* ANY (gx))
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

GRANT EXECUTE ON FUNCTION public.search_public(text, text[], integer, integer, integer, text[], text[], text[], text[], text[]) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.public_counts(text[], text[], text[]);

CREATE FUNCTION public.public_counts(
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL,
  p_exclude_group_names text[] DEFAULT NULL
)
RETURNS TABLE(entity_type text, n bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT d.entity_type, count(*)
    FROM public.public_documents() d
   WHERE NOT (coalesce(d.title, '') LIKE ANY (coalesce(p_exclude_title_like, '{}')))
     AND NOT (coalesce(d.handle, '') ILIKE ANY (coalesce(p_exclude_handle_ilike, '{}')))
     AND NOT (lower(coalesce(d.handle, '')) = ANY (coalesce(p_exclude_handles, '{}')))
     AND NOT (d.entity_type = 'group' AND coalesce(d.title, '') ~* ANY (coalesce(p_exclude_group_names, '{}')))
   GROUP BY d.entity_type
$$;

GRANT EXECUTE ON FUNCTION public.public_counts(text[], text[], text[], text[]) TO anon, authenticated, service_role;

-- The vocabulary: the same rows and the same fixture filters as search_public,
-- so a correction can only ever point at something a search can return.
DROP FUNCTION IF EXISTS public.public_search_text(text[], text[], text[]);

CREATE FUNCTION public.public_search_text(
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL,
  p_exclude_group_names text[] DEFAULT NULL
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
     AND NOT (d.entity_type = 'group' AND coalesce(d.title, '') ~* ANY (coalesce(p_exclude_group_names, '{}')))
$$;

GRANT EXECUTE ON FUNCTION public.public_search_text(text[], text[], text[], text[]) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
