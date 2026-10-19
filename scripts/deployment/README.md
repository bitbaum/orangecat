# Deployment Scripts

Production deploys happen on the Hetzner box — see
`docs/operations/deployment/DEPLOYMENT_PROCESS.md`. The Vercel-era scripts that used to
live here (deploy.js, one-button-deploy.js, vercel-monitor.js, …) were removed
2026-06-13 after the migration; recover from git history if ever needed.

- **`browser-verify.js`** — post-deploy browser smoke test against production.
  Run with `npm run deploy:verify`.
