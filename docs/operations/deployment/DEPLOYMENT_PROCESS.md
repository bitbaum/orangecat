# Deployment Process

**Since 2026-06-12 OrangeCat is self-hosted on Hetzner** ("bitbaum"). The Vercel
one-button pipeline this document used to describe was removed with the
migration (see git history of this file for the old process).

## How production deploys work

- Deploys happen **on the box**, not from CI. Runbook:
  `fleetcrown/docs/infrastructure/hetzner-migration.md` (FleetCrown repo — same box).
- The app runs as the `orangecat-app` systemd unit (Next.js standalone build,
  `SELF_HOST=1 pnpm run build`, port 4003) behind Caddy serving
  `orangecat.ch` + `www.orangecat.ch`.
- Cron routes are driven by systemd timers on the box
  (`orangecat-webhook-worker.timer`, `orangecat-cron@*.timer`), authenticated
  with `Authorization: Bearer $CRON_SECRET`.

## What pushes to `main` do

- `ci.yml` — docs hygiene, type-check, lint, unit tests, build, P0 E2E matrix.
- `e2e-auth.yml` — Playwright login test against production (`www.orangecat.ch`).
- **No deploy.** Green CI means the commit is safe to deploy on the box.

## Post-deploy verification

- Health: `https://orangecat.ch/api/health`
- Browser smoke: `pnpm run deploy:verify` (runs `scripts/deployment/browser-verify.js`
  against production).

See also: `docs/devops/infrastructure.md`, `docs/devops/ci-cd.md`.
