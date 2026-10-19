# Discover Filters and Local Search

created_date: 2025-10-30
last_modified_date: 2025-10-30
last_modified_summary: Initial draft documenting Discover filters, URL params, and planned geo schema.

## Overview

This document tracks the Discover page filter system and the planned geographic search capabilities.

## Current UI/UX

- Sticky header hides on scroll down and reappears on scroll up.
- Discover has a sticky search + filter bar and an expandable left filter rail.
- Active filters are reflected as removable chips and encoded in URL params.

### URL Parameters

- search: free text
- category: string
- sort: trending | newest | ending_soon | most_funded
- country: ISO country name/code (string)
- city: string
- postal: string
- radius_km: number

## Backend/Search

- Frontend passes geo fields via `filters` to `search()`; the backend currently ignores these until schema is added.
- No breaking changes: fields are optional and default to no-op.

## Planned Schema Changes (awaiting approval)

Add geographic fields to `projects` and `profiles` to enable local discovery:

- country_code (text, ISO 3166-1 alpha-2)
- region (text)
- city (text)
- postal_code (text)
- latitude (numeric(9,6))
- longitude (numeric(9,6))
- GENERATED COLUMN: location geography(Point, 4326) from lat/lng (via PostGIS)
- INDEXES: btree(country_code, region, city), gist(location)

### Example Postgres (Supabase) Migration

```sql
-- Enable PostGIS
create extension if not exists postgis;

-- Projects geo fields
alter table public.projects
  add column if not exists country_code text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists location geography(Point,4326);

-- Backfill point where possible
update public.projects
set location = case when latitude is not null and longitude is not null
  then ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
  else null end
where location is null;

-- Indexes
create index if not exists idx_projects_country_region_city on public.projects(country_code, region, city);
create index if not exists idx_projects_location on public.projects using gist(location);
```

### Query Pattern (post-migration)

- Country/City filter: `eq`/`ilike` on text columns
- Radius search: `ST_DWithin(location, ST_MakePoint(lon, lat)::geography, radius_meters)`

## Phased Rollout

1. UI + URL params (done)
2. Schema + indexes (pending approval)
3. Backend search updates to use geo filters
4. Profile/project creation forms collect geo data (with optional geocoding)
5. Privacy controls for location granularity

## Notes

- Avoid storing precise home addresses; default to city/ZIP level.
- Keep all secrets and API keys out of the repo; use `env.template` for any geocoding services if adopted later.
