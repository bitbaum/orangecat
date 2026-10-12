-- One search engine for the ⌘K palette, Discover and its counts.
--
-- Before this, the palette asked global_search (full-text + fuzzy, 14 types)
-- while Discover asked two older FTS functions for projects and people and
-- plain ILIKE for the other twelve types, then re-sorted everything newest
-- first. A palette hit could vanish one click later on "See all results", and
-- the rule for "publicly visible" was written out in six places.
--
-- Now:
--   public_documents()  every publicly visible row of every public type, in
--                       one shape. The ONLY place the public rules live in SQL.
--                       Invoker-rights SQL, so the planner inlines it and pushes
--                       each search predicate into each branch, where the
--                       existing GIN indexes serve it. Not callable by clients.
--   search_public(...)  ranked search over it, or browsing it newest first when
--                       the query is empty. Prefix matching ("lo" finds Loki),
--                       typo tolerance through the indexable <% operator (the
--                       old `f_score(...) > 0.4` could not use any index), and
--                       a ranking that puts an exact or leading title match
--                       above a word buried in a description.
--   public_counts(...)  how many public rows each type has, from the same rows.
--   global_search(...)  kept for existing callers, now a thin wrapper.
--
-- Fixture filters (TEST titles, CI usernames) are PARAMETERS, not literals:
-- the patterns live once in src/config/public-directory.ts and the caller
-- passes them, so SQL and the JS-side checks cannot drift apart.
--
-- Rows created with a test integration key carry is_test = true and are now
-- kept out of every public result, as following-scope.ts already did.
--
-- Rollback: DROP the three new functions and re-run global_search from
-- 20261003120000_global_search_every_public_type.sql with its GRANTs.

CREATE OR REPLACE FUNCTION public.public_documents()
RETURNS TABLE(
  entity_type text, id uuid, title text, match_title text, body text,
  image_url text, path_key text, handle text,
  amount numeric, currency text, starts_at timestamptz, place text,
  created_at timestamptz
)
LANGUAGE sql STABLE
-- No SET clause: a function with one cannot be inlined, and inlining is what
-- lets each search predicate reach each table's index. Every name is qualified.
AS $$
  SELECT 'profile'::text, p.id, coalesce(nullif(p.name,''), p.username),
         coalesce(p.username,'')||' '||coalesce(p.name,''), p.bio,
         p.avatar_url, p.username, p.username,
         NULL::numeric, NULL::text, NULL::timestamptz,
         coalesce(nullif(p.location_city,''), nullif(p.location,'')), p.created_at
    FROM public.profiles p
  UNION ALL
  SELECT 'project', x.id, x.title, x.title, x.description,
         x.cover_image_url, NULL, NULL,
         x.goal_amount, x.currency, NULL, NULL, x.created_at
    FROM public.projects x
   WHERE x.status IN ('active','paused') AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'product', x.id, x.title, x.title, x.description,
         coalesce(x.thumbnail_url, x.images[1]), NULL, NULL,
         x.price, x.currency, NULL, NULL, x.created_at
    FROM public.user_products x
   WHERE x.status = 'active' AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'service', x.id, x.title, x.title, x.description,
         x.images[1], NULL, NULL,
         coalesce(x.fixed_price, x.hourly_rate), x.currency, NULL, x.service_area, x.created_at
    FROM public.user_services x
   WHERE x.status = 'active' AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'cause', x.id, x.title, x.title, x.description,
         NULL, NULL, NULL,
         x.goal_amount, x.currency, NULL, NULL, x.created_at
    FROM public.user_causes x
   WHERE x.status = 'active' AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'loan', x.id, x.title, x.title, x.description,
         NULL, NULL, NULL,
         x.amount, x.currency, NULL, NULL, x.created_at
    FROM public.loans x
   WHERE x.is_public AND x.status = 'active' AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'event', x.id, x.title, x.title, x.description,
         coalesce(x.thumbnail_url, x.banner_url, x.images[1]), NULL, NULL,
         x.ticket_price, x.currency, x.start_date, x.venue_city, x.created_at
    FROM public.events x
   WHERE x.status IN ('published','open','full','ongoing') AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'investment', x.id, x.title, x.title, x.description,
         x.thumbnail_url, NULL, NULL,
         NULL, x.currency, NULL, NULL, x.created_at
    FROM public.investments x
   WHERE x.is_public AND x.status IN ('open','funded','active') AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'asset', x.id, x.title, x.title, x.description,
         NULL, NULL, NULL,
         coalesce(x.sale_price_btc, x.rental_price_btc),
         CASE WHEN coalesce(x.sale_price_btc, x.rental_price_btc) IS NULL THEN NULL ELSE 'BTC' END,
         NULL, x.location, x.created_at
    FROM public.assets x
   WHERE x.status = 'active' AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'research', x.id, x.title, x.title, x.description,
         NULL, NULL, NULL,
         NULL, NULL, NULL, NULL, x.created_at
    FROM public.research_entities x
   WHERE x.is_public IS TRUE AND coalesce(x.status,'') NOT IN ('draft','cancelled')
  UNION ALL
  SELECT 'wishlist', x.id, x.title, x.title, x.description,
         x.cover_image_url, NULL, NULL,
         NULL, NULL, NULL, NULL, x.created_at
    FROM public.wishlists x
   WHERE x.visibility = 'public' AND x.is_active IS TRUE AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'group', x.id, x.name, x.name, x.description,
         coalesce(x.avatar_url, x.banner_url), x.slug, NULL,
         NULL, NULL, NULL, NULL, x.created_at
    FROM public.groups x
   WHERE x.is_public IS TRUE
  UNION ALL
  SELECT 'circle', x.id, x.title, x.title, x.description,
         x.cover_image_url, NULL, NULL,
         NULL, NULL, NULL, NULL, x.created_at
    FROM public.circles x
   WHERE x.visibility = 'public' AND x.status = 'active' AND x.is_test IS NOT TRUE
  UNION ALL
  SELECT 'ai_assistant', x.id, x.title, x.title, x.description,
         x.avatar_url, NULL, NULL,
         NULL, NULL, NULL, NULL, x.created_at
    FROM public.ai_assistants x
   WHERE x.status = 'active' AND x.is_public IS TRUE
$$;

-- Bypasses nothing by itself (invoker rights), but clients have no reason to
-- call it: the definer functions below are the public surface.
REVOKE ALL ON FUNCTION public.public_documents() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_documents() TO service_role;

CREATE OR REPLACE FUNCTION public.search_public(
  p_query text DEFAULT '',
  p_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_per_type integer DEFAULT NULL,
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL
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

CREATE OR REPLACE FUNCTION public.public_counts(
  p_exclude_title_like text[] DEFAULT NULL,
  p_exclude_handle_ilike text[] DEFAULT NULL,
  p_exclude_handles text[] DEFAULT NULL
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
   GROUP BY d.entity_type
$$;

DROP FUNCTION IF EXISTS public.global_search(text, integer);

CREATE FUNCTION public.global_search(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE(entity_type text, id uuid, title text, subtitle text, image_url text, rank real, path_key text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  SELECT s.entity_type, s.id, s.title,
         CASE WHEN s.entity_type = 'profile' THEN '@' || coalesce(s.path_key, '') ELSE left(s.snippet, 140) END,
         s.image_url, s.rank, s.path_key
    FROM public.search_public(p_query, NULL, p_limit) s
$$;

GRANT EXECUTE ON FUNCTION public.search_public(text, text[], integer, integer, integer, text[], text[], text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_counts(text[], text[], text[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.global_search(text, integer) TO anon, authenticated, service_role;
