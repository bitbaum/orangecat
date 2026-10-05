-- global_search finds every public entity type, and events at all.
--
-- The ⌘K palette and type-ahead read this one RPC. It covered seven types:
-- projects, profiles, products, services, causes, loans, events. Missing:
-- investments, assets, research, wishlists, organisations (groups), circles
-- and companions (ai_assistants). And the events branch filtered on
-- status = 'active', a value events_status_check has never allowed, so no
-- event has ever been returned.
--
-- SECURITY DEFINER bypasses RLS, so every branch states its own "publicly
-- visible" rule, taken from that table's public SELECT policy and narrowed
-- where a search must find less than a link may open: unlisted wishlists and
-- draft or cancelled research stay out.
--
-- New column path_key: the key the public URL uses when it is not the id
-- (username for profiles, slug for groups); null otherwise. Profiles used to
-- smuggle it through subtitle as '@username'; that subtitle stays as is.
--
-- Changing the return type needs DROP + CREATE, so the grants are restated.
-- Rollback: re-run the global_search definition from the baseline migration
-- (20240101000001) and its three GRANTs; the new indexes are harmless to keep.

CREATE INDEX IF NOT EXISTS idx_investments_fts2 ON public.investments USING gin (to_tsvector('english'::regconfig, public.f_unaccent(((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)))));
CREATE INDEX IF NOT EXISTS idx_investments_trgm ON public.investments USING gin (public.f_unaccent(COALESCE(title, ''::text)) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_assets_fts2 ON public.assets USING gin (to_tsvector('english'::regconfig, public.f_unaccent(((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)))));
CREATE INDEX IF NOT EXISTS idx_assets_trgm ON public.assets USING gin (public.f_unaccent(COALESCE(title, ''::text)) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_research_entities_fts2 ON public.research_entities USING gin (to_tsvector('english'::regconfig, public.f_unaccent(((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)))));
CREATE INDEX IF NOT EXISTS idx_research_entities_trgm ON public.research_entities USING gin (public.f_unaccent(COALESCE(title, ''::text)) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wishlists_fts2 ON public.wishlists USING gin (to_tsvector('english'::regconfig, public.f_unaccent(((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)))));
CREATE INDEX IF NOT EXISTS idx_wishlists_trgm ON public.wishlists USING gin (public.f_unaccent(COALESCE(title, ''::text)) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_groups_fts2 ON public.groups USING gin (to_tsvector('english'::regconfig, public.f_unaccent(((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text)))));
CREATE INDEX IF NOT EXISTS idx_groups_trgm ON public.groups USING gin (public.f_unaccent(COALESCE(name, ''::text)) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_circles_fts2 ON public.circles USING gin (to_tsvector('english'::regconfig, public.f_unaccent(((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)))));
CREATE INDEX IF NOT EXISTS idx_circles_trgm ON public.circles USING gin (public.f_unaccent(COALESCE(title, ''::text)) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ai_assistants_fts2 ON public.ai_assistants USING gin (to_tsvector('english'::regconfig, public.f_unaccent(((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)))));
CREATE INDEX IF NOT EXISTS idx_ai_assistants_trgm ON public.ai_assistants USING gin (public.f_unaccent(COALESCE(title, ''::text)) extensions.gin_trgm_ops);

DROP FUNCTION IF EXISTS public.global_search(text, integer);

CREATE FUNCTION public.global_search(p_query text, p_limit integer DEFAULT 20)
RETURNS TABLE(entity_type text, id uuid, title text, subtitle text, image_url text, rank real, path_key text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
DECLARE
  uq  text := public.f_unaccent(coalesce(p_query,''));
  q   tsquery := websearch_to_tsquery('english', uq);
  pat text := '%'||uq||'%';
BEGIN
  IF length(trim(uq)) = 0 THEN RETURN; END IF;
  RETURN QUERY
  WITH hits AS (
      SELECT 'profile'::text et, p.id, coalesce(nullif(p.name,''), p.username) title,
             '@'||coalesce(p.username,'') sub, p.avatar_url img, p.username pk,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(p.username,'')||' '||coalesce(p.name,'')||' '||coalesce(p.bio,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(p.username,'')||' '||coalesce(p.name,'')), uq))::real rk, p.created_at
      FROM public.profiles p
      WHERE to_tsvector('english', public.f_unaccent(coalesce(p.username,'')||' '||coalesce(p.name,'')||' '||coalesce(p.bio,''))) @@ q
        OR public.f_unaccent(coalesce(p.username,'')||' '||coalesce(p.name,'')) ILIKE pat
        OR public.f_score(public.f_unaccent(coalesce(p.username,'')||' '||coalesce(p.name,'')), uq) > 0.4
      UNION ALL
      SELECT 'project'::text, x.id, x.title, left(coalesce(x.description,''),140), x.cover_image_url, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.projects x WHERE x.status IN ('active','paused') AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'product'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.user_products x WHERE x.status = 'active' AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'service'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.user_services x WHERE x.status = 'active' AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'cause'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.user_causes x WHERE x.status = 'active' AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'loan'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.loans x WHERE x.is_public AND x.status = 'active' AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'event'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.events x WHERE x.status IN ('published','open','full','ongoing') AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'investment'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.investments x WHERE x.is_public AND x.status IN ('open','funded','active') AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'asset'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.assets x WHERE x.status = 'active' AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'research'::text, x.id, x.title, left(coalesce(x.description,''),140), NULL::text, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.research_entities x WHERE x.is_public IS TRUE AND coalesce(x.status,'') NOT IN ('draft','cancelled') AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'wishlist'::text, x.id, x.title, left(coalesce(x.description,''),140), x.cover_image_url, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.wishlists x WHERE x.visibility = 'public' AND x.is_active IS TRUE AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'group'::text, x.id, x.name, left(coalesce(x.description,''),140), x.avatar_url, x.slug,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.name,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.name,'')), uq))::real, x.created_at
      FROM public.groups x WHERE x.is_public IS TRUE AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.name,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.name,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.name,'')), uq) > 0.4)
      UNION ALL
      SELECT 'circle'::text, x.id, x.title, left(coalesce(x.description,''),140), x.cover_image_url, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.circles x WHERE x.visibility = 'public' AND x.status = 'active' AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
      UNION ALL
      SELECT 'ai_assistant'::text, x.id, x.title, left(coalesce(x.description,''),140), x.avatar_url, NULL::text,
             (ts_rank(to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))), q)
              + 0.4*public.f_score(public.f_unaccent(coalesce(x.title,'')), uq))::real, x.created_at
      FROM public.ai_assistants x WHERE x.status = 'active' AND x.is_public IS TRUE AND (
        to_tsvector('english', public.f_unaccent(coalesce(x.title,'')||' '||coalesce(x.description,''))) @@ q
        OR public.f_unaccent(coalesce(x.title,'')) ILIKE pat OR public.f_score(public.f_unaccent(coalesce(x.title,'')), uq) > 0.4)
  )
  SELECT et, id, title, sub, img, rk, pk
  FROM hits
  ORDER BY rk DESC, created_at DESC
  LIMIT p_limit;
END $$;

GRANT ALL ON FUNCTION public.global_search(p_query text, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.global_search(p_query text, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.global_search(p_query text, p_limit integer) TO service_role;
