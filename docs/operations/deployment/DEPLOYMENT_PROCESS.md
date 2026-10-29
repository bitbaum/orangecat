# Deployment Process

**Since 2026-06-12 OrangeCat is self-hosted on Hetzner** ("bitbaum"). The Vercel
one-button pipeline this document used to describe was removed with the
migration (see git history of this file for the old process).

## How production deploys work

- Deploys are driven from GitHub Actions: `.github/workflows/cd.yml` ships the
  exact standalone artifact CI built and tested to the box over SSH, via
  `scripts/deploy-selfhost.sh` (boot-tested on a scratch port, atomic swap,
  rollback on a failed health check). Pending `supabase/migrations/*.sql` are
  applied on the way by `scripts/apply-migrations.sh`. CD is a no-op while the
  `SELFHOST_SSH_KEY` secret is missing.
- The app runs as the `orangecat-app` systemd unit (Next.js standalone build,
  `SELF_HOST=1 pnpm run build`, port 4003) behind Caddy serving
  `orangecat.ch` + `www.orangecat.ch`.
- Cron routes are driven by systemd timers on the box
  (`orangecat-webhook-worker.timer`, `orangecat-cron@*.timer`), authenticated
  with `Authorization: Bearer $CRON_SECRET`.

## What a merge to `main` does

Nobody merges by hand: a green, non-draft PR is squash-merged by
`.github/workflows/auto-merge.yml` (the fleet sweep, `bitbaum/fleet`
`scripts/ci/auto-merge-sweep.sh`). Then:

- `ci.yml` — `pnpm run verify` (type-check, lint, unit tests, `check:*` guards),
  build, P0 E2E matrix. On success its `post-main` job dispatches `cd.yml` with
  this run's ID and SHA (`scripts/ci/arm-cd.sh`).
- `cd.yml` — deploys that artifact (above). The sweep also reconciles: when
  `main`'s tip differs from the last successful `cd.yml` run it dispatches
  `cd.yml` itself, so a missed hand-off is retried.
- `e2e-auth.yml` — Playwright login test against production (`www.orangecat.ch`).

See "Deploy path" in the root `AGENTS.md` for why both hand-offs exist.

## Post-deploy verification

- Health: `https://orangecat.ch/api/health`
- Browser smoke: `pnpm run deploy:verify` (runs `scripts/deployment/browser-verify.js`
  against production).

See also: `docs/operations/devops/infrastructure.md`, `docs/operations/devops/ci-cd.md`.
