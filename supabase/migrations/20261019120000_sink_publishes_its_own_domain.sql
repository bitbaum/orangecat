-- Sink is published at its own domain.
--
-- Found 2026-10-19 by the fleet's live-claims audit (bitbaum/fleet
-- scripts/ci/live-claims-audit.mjs). A service description still said
-- "Live work: … sink.orangecat.ch". bitbaum/fleet registers/retired.json
-- retired that host on 2026-08-20 in favour of sinktattoo.com, the client's
-- own domain; the subdomain survives only as a legacy redirect. The owner
-- confirmed sinktattoo.com on 2026-10-19. Loki's register carries its own copy
-- of the same sentence and is corrected by Loki's migration 0118.
--
-- Data only: no schema change. Only the host is replaced; every other word is
-- kept as written.

UPDATE public.user_services
SET description = replace(description, 'sink.orangecat.ch', 'sinktattoo.com'),
    updated_at = now()
WHERE description LIKE '%sink.orangecat.ch%';
