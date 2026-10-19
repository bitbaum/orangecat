# Operations Documentation

Running and maintaining OrangeCat in production: self-hosted on the Hetzner box
(`bitbaum`) behind Caddy, with a self-hosted Supabase at `supabase.orangecat.ch`.
How code reaches production is "Shipping" in the root [`CLAUDE.md`](../../CLAUDE.md).

## Deployment

- [Deployment Process](deployment/DEPLOYMENT_PROCESS.md) - How a merge becomes a deploy
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md) and [Integration Deploy Checklist](INTEGRATION_DEPLOY_CHECKLIST.md)
- [Enabling / operating CD](enable-cd.md)
- [CI/CD Pipeline](devops/ci-cd.md) and [Infrastructure](devops/infrastructure.md)
- [Environment Variables](ENVIRONMENT.md)

## Database & Storage

- [Self-Hosted Supabase](REMOTE_ONLY_SUPABASE.md) - The SSOT
- [Database Migrations](MIGRATIONS.md) and [Supabase guides](supabase/)
- [Media on Cloudflare R2](STORAGE_R2_BACKEND.md)

## Reliability & Recovery

- [Disaster Recovery](DISASTER_RECOVERY.md) and [Restore Drill](RESTORE_DRILL.md)
- [Resilience](RESILIENCE.md) and [Agent Reliability](agent-reliability.md)
- [Observability](devops/observability.md)
- [Troubleshooting](troubleshooting.md)
- [Account Recovery](account-recovery.md)

## Features that need operating

- [Platform Lightning Wallet](PLATFORM_WALLET_RUNBOOK.md)
- [Cat Credits activation](credits-activation.md)
- [OAuth Social Login](oauth-social-login.md) and [Passkeys](passkeys.md)

## Local development

- [Port Management](port-management.md) - Freeing stuck dev-server ports

## Related Documentation

- [Security](../security/README.md)
- [Development Setup](../development/SETUP.md)
- [Architecture](../architecture/ARCHITECTURE.md)
