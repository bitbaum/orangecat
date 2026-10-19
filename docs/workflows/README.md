# Workflows

Operational procedures for common development tasks.

---

## Deployment

Production runs **self-hosted on the Hetzner box** (`bitbaum`, behind Caddy)
since 2026-06-12. CI (GitHub Actions) gates merges but does **not** deploy.

→ See [`../operations/deployment/DEPLOYMENT_PROCESS.md`](../operations/deployment/DEPLOYMENT_PROCESS.md).

## Database migrations

Schema changes are SQL files in [`../../supabase/migrations/`](../../supabase/migrations/),
applied with `psql` against the self-hosted Supabase instance
(`supabase.orangecat.ch`). There is no managed-cloud dashboard or Management API.

```bash
psql "$POSTGRES_URL" -f supabase/migrations/<timestamp>_<name>.sql
```

→ Full workflow: [`operations/supabase/migrations-guide.md`](../operations/supabase/migrations-guide.md).
→ Verify auth/registration after a migration: `scripts/db/verify-self-host.sh`.

---

> **Historical note:** the managed Supabase Cloud (`ohkueislstxomdjavyhs`) and its
> Management-API migration workflow were retired 2026-06. Those runbooks
> (`SUPABASE_MIGRATION_WORKFLOW.md`, `MIGRATION_QUICK_REFERENCE.md`,
> `MIGRATION_LESSONS_LEARNED.md`) now live in
> [`../archive/2026-h1/`](../archive/2026-h1/).
