# Infrastructure

Primary: self-hosted on Hetzner ("bitbaum", since 2026-06-12; Vercel team was blocked for fair-use).

- App: Next.js standalone build (`SELF_HOST=1 pnpm run build`) running as the `orangecat-app` systemd unit on port 4003.
- Reverse proxy: Caddy serves `orangecat.ch` + `www.orangecat.ch`.
- Supabase: self-hosted at `supabase.orangecat.ch` (replaces the hosted project).
- Env: gitignored `.env.selfhost.local` on the box (originally a filtered `vercel env pull`).
- Runbook: `fleetcrown/docs/infrastructure/hetzner-migration.md` (FleetCrown repo — same box).
- Deploys are automated: pushes to `main` run CI (`ci.yml`); on success, CD (`cd.yml`) builds the standalone bundle off-box and ships it via `scripts/deploy-selfhost.sh` (atomic swap + rollback). A prod login E2E (`e2e-auth.yml`) also runs.

Historical (pre-2026-06-12): Vercel (Next.js app + serverless API), config in `vercel.json` + `next.config.js`.

Optional Self-Hosted Stack (for on-prem / advanced monitoring)

- Compose file: `deployment/production/docker-compose.yml`
- Services: Traefik, web (Next.js standalone), Postgres, Redis, Prometheus, Loki, Promtail, Grafana, scheduled Postgres backups.
- Monitoring configs: `deployment/production/monitoring/` (Prometheus, Loki, Promtail, Grafana datasources).

Security

- Traefik dashboard should not be public; restrict by network/VPN.
- Postgres/Redis are bound to `127.0.0.1` and internal network only.
- Pin versions for all infra images to avoid drift.

Backups

- `prodrigestivill/postgres-backup-local` runs on a schedule with retention.
- See runbook for restoration procedure.
