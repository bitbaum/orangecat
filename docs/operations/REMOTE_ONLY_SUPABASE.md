# Self-Hosted Supabase (Hetzner) — SSOT

The single source of truth for OrangeCat's database is the **self-hosted Supabase at `https://supabase.orangecat.ch`**, running on the Hetzner box. Do not run a separate local Supabase/Postgres against app code.

> ⚠️ **Managed Supabase Cloud retired 2026-06.** The managed-cloud guidance below (`supabase link --project-ref`, `db push`/`db dump` against the cloud project) is RETIRED. Kept for reference.

- No `supabase start`, `supabase db start`, or Docker services for app development.
- **Schema changes**: add a file under `supabase/migrations/` and merge it. `scripts/deploy-selfhost.sh` runs `scripts/apply-migrations.sh` on every deploy, which applies pending migrations in filename order (each in one transaction) and records them in `public.schema_migrations`. Never apply a migration by hand.
- **Reads**: PostgREST at `https://supabase.orangecat.ch/rest/v1/…` with the keys in `.env.local` — this works from an agent sandbox.
- **DDL inspection / anything PostgREST cannot express**: `ssh ubuntu@167.233.22.31 'docker exec supabase-db psql -U postgres -d postgres -c "…"'`. `psql "$POSTGRES_URL"` needs a local tunnel on `127.0.0.1:5433` that is normally not running.

Retired managed-cloud workflow (historical):

1. Link once
   SUPABASE_ACCESS_TOKEN=… supabase link --project-ref <ref> --workdir supabase

2. Create a migration (remote-intended)
   supabase migration new <name> --workdir supabase

3. Apply to remote
   SUPABASE_ACCESS_TOKEN=… supabase db push --workdir supabase --include-all

4. Verify
   SUPABASE_ACCESS_TOKEN=… supabase db dump --schema public --workdir supabase -f /tmp/public.sql

If CLI refuses due to history mismatches, prefer running SQL once in Studio, then align migrations in Git.
