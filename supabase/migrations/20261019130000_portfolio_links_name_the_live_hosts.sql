-- Portfolio links name the hosts the work is actually served at.
--
-- Found 2026-10-19 by the fleet's live-claims audit: after
-- 20261019120000_sink_publishes_its_own_domain.sql corrected a service
-- description, the same service's portfolio_links still listed
-- https://sink.orangecat.ch (retired 2026-08-20 in bitbaum/fleet
-- registers/retired.json; the client's site is sinktattoo.com) and
-- https://fleetcrown.orangecat.ch, which only 308-redirects to
-- https://loki.orangecat.ch since FleetCrown was renamed Loki. (The
-- fleetcrown.orangecat.ch DOMAIN is still the shared mail-sender domain, so it
-- is not a retired form in general — only as a web link to the product.)
--
-- Data only: each array element is rewritten in place; order and every other
-- link are kept.

UPDATE public.user_services
SET portfolio_links = ARRAY(
      SELECT CASE link
               WHEN 'https://sink.orangecat.ch' THEN 'https://sinktattoo.com'
               WHEN 'https://fleetcrown.orangecat.ch' THEN 'https://loki.orangecat.ch'
               ELSE link
             END
      FROM unnest(portfolio_links) WITH ORDINALITY AS t(link, n)
      ORDER BY n
    ),
    updated_at = now()
WHERE portfolio_links && ARRAY['https://sink.orangecat.ch', 'https://fleetcrown.orangecat.ch']::text[];
