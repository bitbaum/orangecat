-- People appear on Discover and in search once they have said something
-- about themselves: a name of their own, a bio or a picture.
--
-- "Start instantly — no email" makes an account with a generated handle
-- (user_89fabc338334) and nothing else. That is the right way in, and those
-- accounts stay fully usable and reachable by link; but on the day the new
-- Discover shipped, its "Just listed" row was four of them and its People
-- chip counted seventy-five, most of them empty. A directory of people is
-- worth browsing only for the people who have shown up in it.
--
-- Only the profile branch changes; every other branch is as in
-- 20261012120000_one_search_engine.sql. search_public, public_counts and
-- global_search read this function, so all three follow.
--
-- Rollback: re-run public_documents() from 20261012120000.

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
   -- A person appears once they have said something about themselves.
   WHERE nullif(btrim(coalesce(p.bio,'')),'') IS NOT NULL
      OR nullif(btrim(coalesce(p.avatar_url,'')),'') IS NOT NULL
      OR (nullif(btrim(coalesce(p.name,'')),'') IS NOT NULL
          AND lower(btrim(p.name)) <> lower(coalesce(p.username,'')))
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
