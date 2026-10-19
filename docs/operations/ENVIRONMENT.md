# Environment Variables

This document describes all environment variables used in the OrangeCat application.

## Required Variables

| Variable                        | Description                       | Required | Example                         |
| ------------------------------- | --------------------------------- | -------- | ------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | Public site URL                   | ✅       | `https://orangecat.ch`          |
| `NEXT_PUBLIC_SITE_NAME`         | Site name                         | ✅       | `OrangeCat`                     |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase URL (self-hosted)        | ✅       | `https://supabase.orangecat.ch` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key            | ✅       | `xxx`                           |
| `BITCOIN_NETWORK`               | Bitcoin network (mainnet/testnet) | ✅       | `mainnet`                       |
| `LIGHTNING_NODE_URL`            | Lightning node URL                | ✅       | `https://xxx.lightning.node`    |
| `LIGHTNING_MACAROON`            | Lightning macaroon                | ✅       | `xxx`                           |
| `LIGHTNING_TLS_CERT`            | Lightning TLS certificate         | ✅       | `xxx`                           |

## Optional Variables

| Variable              | Description      | Required | Default                 |
| --------------------- | ---------------- | -------- | ----------------------- |
| `NODE_ENV`            | Environment mode | ❌       | `development`           |
| `NEXT_PUBLIC_APP_URL` | Application URL  | ❌       | `http://localhost:3000` |

## Development Values

For local development, you can use these values:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=OrangeCat (Dev)
NODE_ENV=development
BITCOIN_NETWORK=testnet
```

## Production Values

For production, ensure these values are set:

```env
NEXT_PUBLIC_SITE_URL=https://orangecat.ch
NEXT_PUBLIC_SITE_NAME=OrangeCat
NODE_ENV=production
BITCOIN_NETWORK=mainnet
```

## Development Setup

1. Copy `.env.example` to `.env.local`
2. Update variables with your local values
3. Never commit `.env.local` to version control

## Production Setup

Production env lives in the app's `.env` on the Hetzner box. Edit it
there directly and restart the `orangecat-app` service after changes. See
`docs/operations/deployment/DEPLOYMENT_PROCESS.md`.

## Security Notes

- Never commit sensitive data to version control
- Use environment variables for all secrets
- Keep `.env.local` in `.gitignore`
- Use strong, unique values for production

## Environment Synchronization

Since the 2026-06-12 Hetzner migration there is no env-sync tooling:

- **Local development**: `.env.local` (developer-owned, never committed).
- **Production**: `/opt/orangecat/app/.env` on the box (bitbaum), edited there
  directly; restart `orangecat-app` after changes. See
  `docs/operations/deployment/DEPLOYMENT_PROCESS.md`.
- **CI**: dummy values baked into the workflows; real secrets only as GitHub
  Actions secrets (E2E credentials).

## Setting up Environment Variables

### For Local Development

1. Copy `.env.example` to `.env.local`
2. Fill in your environment variables
3. Never commit `.env.local` to Git

```bash
cp .env.example .env.local
```

### For GitHub Actions

Add the following secrets to your GitHub repository (used by CI/E2E only — production runtime env lives on the box):

- `NEXT_PUBLIC_BITCOIN_ADDRESS`: Your Bitcoin address
- `NEXT_PUBLIC_LIGHTNING_ADDRESS`: Your Lightning address
- `NEXT_PUBLIC_SITE_URL`: Your site URL
- `NEXT_PUBLIC_SITE_NAME`: Your site name

### For Production Deployment

Production environment variables live in `/opt/orangecat/app/.env` on the Hetzner
box. Edit them there directly and restart the `orangecat-app` service. There is no
dashboard or env-push script — see `docs/operations/deployment/DEPLOYMENT_PROCESS.md`.

## Best Practices

1. Keep sensitive information in environment variables, not in code
2. Use `NEXT_PUBLIC_` prefix for variables that need to be accessible in the browser
3. Regularly sync environment variables between local and production
4. Document new environment variables in this file
5. Update `.env.example` when adding new variables
