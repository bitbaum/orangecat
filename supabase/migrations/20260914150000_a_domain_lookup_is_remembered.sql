-- A domain lookup is remembered.
--
-- /api/v1/domains and the Cat's check_domain_availability both ask the
-- registries (RDAP) whether a name is taken, and until now the answer lived in
-- one Node process's in-memory Map and died on the next deploy. So there was no
-- way to answer "what did I check last week", nothing to build a "tell me when
-- foo.ch drops" watch on, and no record of which names people actually want —
-- which is the one dataset the domain business would be built on.
--
-- One row per (domain, check). Not upserted: the point is the history, and a
-- name's status changes exactly when somebody lets it lapse. actor_id is set
-- when a signed-in person asked (the Cat path) and NULL for the public,
-- keyless endpoint — a stranger's search is remembered as a search, never as a
-- person. It is a registry fact about a public name, not personal data.
--
-- RLS on, zero policies: written only through the service role (fire-and-
-- forget from the two callers), read only server-side with an explicit
-- actor_id filter. Same posture as user_nudges.
CREATE TABLE IF NOT EXISTS public.domain_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  name text NOT NULL,
  tld text NOT NULL,
  status text NOT NULL CHECK (status IN ('registered', 'unregistered', 'unknown')),
  source text NOT NULL CHECK (source IN ('web', 'cat')),
  actor_id uuid REFERENCES public.actors(id) ON DELETE SET NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS domain_lookups_domain_checked_idx
  ON public.domain_lookups (domain, checked_at DESC);

CREATE INDEX IF NOT EXISTS domain_lookups_actor_checked_idx
  ON public.domain_lookups (actor_id, checked_at DESC)
  WHERE actor_id IS NOT NULL;

ALTER TABLE public.domain_lookups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.domain_lookups IS
  'Every registry (RDAP) availability check, as asked. History, not state: a name reappears each time it is checked. Written by the service role only.';
