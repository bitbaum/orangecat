-- A party in one sentence: what it sounds like, who staffs it, how to find it.
--
-- 1. events.music_genres / events.vibe — people decide whether to come by what
--    it will sound and feel like. Genres are an open list (the form and the Cat
--    suggest from src/config/event-crew.ts → MUSIC_GENRES), so no CHECK.
--
-- 2. events.currency DEFAULT 'SATS' — a value events_currency_check has never
--    allowed, so any insert that omitted currency failed. The Cat's
--    create_event did exactly that. Default to the platform currency instead
--    (PLATFORM_DEFAULT_CURRENCY = 'CHF'); writers still pass it explicitly.
--
-- 3. event_roles — the crew a gathering needs (DJ, 2 bartenders, sound tech…).
--    Shaped like project_roles, plus a head-count and an optional fee in the
--    event's own currency. Readable exactly when the parent event is readable
--    (the EXISTS runs under events' own RLS, so drafts stay private); writable
--    only by the event's owner.
--
-- 4. search_events_nearby — upcoming public events within a radius, nearest
--    first. SECURITY INVOKER: events' RLS decides visibility, not this body.
--    Plain great-circle distance on the existing numeric latitude/longitude, so
--    it does not depend on a geography column the table does not have.
--
-- Rollback: DROP FUNCTION public.search_events_nearby(double precision,
-- double precision, double precision, text, integer); DROP TABLE
-- public.event_roles; ALTER TABLE public.events DROP COLUMN music_genres,
-- DROP COLUMN vibe; ALTER TABLE public.events ALTER COLUMN currency SET
-- DEFAULT 'SATS'.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS music_genres text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS vibe text;

ALTER TABLE public.events
  ALTER COLUMN currency SET DEFAULT 'CHF';

CREATE INDEX IF NOT EXISTS idx_events_music_genres ON public.events USING gin (music_genres);
CREATE INDEX IF NOT EXISTS idx_events_lat_lng ON public.events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.event_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  role_title text NOT NULL,
  quantity integer DEFAULT 1 NOT NULL,
  engagement_type text DEFAULT 'paid'::text NOT NULL,
  fee_amount numeric(18,8),
  description text,
  status text DEFAULT 'open'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT event_roles_quantity_range CHECK (quantity BETWEEN 1 AND 50),
  CONSTRAINT event_roles_fee_non_negative CHECK (fee_amount IS NULL OR fee_amount >= 0)
);

CREATE INDEX IF NOT EXISTS event_roles_event_idx ON public.event_roles (event_id);

ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_roles_read ON public.event_roles;
CREATE POLICY event_roles_read ON public.event_roles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_roles.event_id)
);

DROP POLICY IF EXISTS event_roles_write ON public.event_roles;
CREATE POLICY event_roles_write ON public.event_roles
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_roles.event_id AND e.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_roles.event_id AND e.user_id = (SELECT auth.uid())
  ));

GRANT SELECT ON public.event_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_roles TO authenticated;
GRANT ALL ON public.event_roles TO service_role;

DROP TRIGGER IF EXISTS update_event_roles_updated_at ON public.event_roles;
CREATE TRIGGER update_event_roles_updated_at BEFORE UPDATE ON public.event_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_events_updated_at();

CREATE OR REPLACE FUNCTION public.search_events_nearby(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision DEFAULT 25,
  p_genre text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  title text,
  event_type text,
  start_date timestamp with time zone,
  timezone text,
  venue_name text,
  venue_city text,
  music_genres text[],
  vibe text,
  is_free boolean,
  ticket_price numeric,
  currency text,
  thumbnail_url text,
  latitude numeric,
  longitude numeric,
  distance_km double precision
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT * FROM (
    SELECT
      e.id, e.title, e.event_type, e.start_date, e.timezone, e.venue_name, e.venue_city,
      e.music_genres, e.vibe, e.is_free, e.ticket_price, e.currency, e.thumbnail_url,
      e.latitude, e.longitude,
      6371.0 * 2 * asin(sqrt(
        power(sin(radians(e.latitude::double precision - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(e.latitude::double precision)) *
        power(sin(radians(e.longitude::double precision - p_lng) / 2), 2)
      )) AS distance_km
    FROM public.events e
    WHERE e.latitude IS NOT NULL
      AND e.longitude IS NOT NULL
      AND e.status IN ('published', 'open', 'full', 'ongoing')
      AND coalesce(e.end_date, e.start_date) >= now() - interval '6 hours'
      AND e.is_test = false
      AND (p_genre IS NULL OR EXISTS (
        SELECT 1 FROM unnest(e.music_genres) g WHERE lower(g) = lower(p_genre)
      ))
      -- Cheap bounding box first; one degree of latitude is ~111 km.
      AND e.latitude BETWEEN p_lat - p_radius_km / 111.0 AND p_lat + p_radius_km / 111.0
  ) nearby
  WHERE nearby.distance_km <= p_radius_km
  ORDER BY nearby.distance_km, nearby.start_date
  LIMIT least(greatest(p_limit, 1), 200);
$$;

GRANT EXECUTE ON FUNCTION public.search_events_nearby(double precision, double precision, double precision, text, integer) TO anon, authenticated, service_role;
