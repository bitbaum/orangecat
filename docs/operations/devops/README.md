# DevOps Overview

This is the authoritative, up-to-date guide for OrangeCat DevOps. It summarizes environments, CI/CD, infrastructure, observability, security, and runbooks for both human engineers and AI coding agents.

- Read first: Deployment guide – docs/operations/deployment/DEPLOYMENT_PROCESS.md
- CI/CD Pipeline – docs/operations/devops/ci-cd.md
- Infrastructure (self-hosted Hetzner) – docs/operations/devops/infrastructure.md
- Observability (Health, Metrics, Logs) – docs/operations/devops/observability.md
- Runbooks (Backups/Restores) – docs/operations/devops/runbooks/backup-restore.md
- Supabase Connectivity – docs/operations/devops/supabase.md

Source of truth notes:

- Node.js: v20 across workflows and Docker.
- Tests and type-checks are blocking in CI with pragmatic coverage gates.
- Security: strict headers + CSP (reporting enabled), SVG disabled unless sanitized.

## Environment Files Policy (Local)

- `.env.local` is developer-owned and MUST NOT be deleted or overwritten by scripts or agents.
- Automated backups live in `.env-backups/`; use `scripts/utils/env-manager.js` to backup/restore.
- Prefer `env-manager validate` and `setup` over copying `.env.example` onto an existing file.
- CI uses dummy env values for builds; the box's env lives in `/opt/orangecat/app/.env`. GitHub Actions must not write to `.env.local`.
