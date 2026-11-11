# CI/CD Pipeline

Deploys are automated. A green, non-draft PR is squash-merged by
`.github/workflows/auto-merge.yml` (the fleet sweep in `bitbaum/fleet`,
`scripts/ci/auto-merge-sweep.sh`); CI on `main` then hands off to CD. See
`docs/operations/deployment/DEPLOYMENT_PROCESS.md` and "Deploy path" in the root
`AGENTS.md`.

Workflows

- `.github/workflows/ci.yml` — the gate:
  - Setup Node 24 + pnpm, `pnpm install --frozen-lockfile`
  - `pnpm run verify` — the one pre-build gate; `scripts/verify.mjs` lists
    what it runs (type-check, lint, `audit:routes`, unit tests, `check:*` guards)
  - Build, then the P0 E2E matrix against the built app (skipped if E2E secrets absent)
  - gitleaks secret scan
  - `post-main` (on `main` only): files/closes the red-main issue, then
    dispatches `cd.yml` with this run's ID and SHA
- `.github/workflows/cd.yml` — `workflow_dispatch` only: ships the exact CI
  artifact to the box via `scripts/deploy-selfhost.sh` (applies pending
  migrations, atomic swap, rollback)
- `.github/workflows/auto-merge.yml` — the merge sweep + deploy reconciler
- `.github/workflows/main-red-alert.yml`, `migration-replay.yml`, `codeql.yml`,
  `uptime.yml`
- `.github/workflows/e2e-auth.yml` — Playwright login smoke against
  production (`https://www.orangecat.ch`); also runnable via workflow_dispatch.

Standards

- Node: `24.x` everywhere (workflow steps install Node 24; the runner actions
  themselves are on Node 24-ready majors since 2026-06-13)
- Do not commit `.env.local`; CI uses dummy env values for the build
- Protect `main`: require status checks, disallow direct pushes
