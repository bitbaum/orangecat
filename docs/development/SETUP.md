# 🚀 OrangeCat Development Environment Setup

**Complete guide to setting up your development environment for OrangeCat development.**

## 📋 Prerequisites

Before you begin, ensure you have:

### Required Software

- **Node.js** 18+ LTS - [Download](https://nodejs.org/)
- **Git** - Version control system
- **pnpm 11** - Package manager (`packageManager` field pins the version; Corepack activates it)

### Optional but Recommended

- **VS Code** - IDE with excellent TypeScript support
- **Supabase CLI** - For local database development
- **Docker** - For containerized development

## ⚡ Quick Setup (5 minutes)

### 1. Clone Repository

```bash
git clone <repository-url>
cd orangecat
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

```bash
# Copy template
cp config/production.env.template .env.local

# Edit with your credentials
# Required: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 4. Database Setup

OrangeCat uses a **self-hosted Supabase instance at `https://supabase.orangecat.ch`** (Hetzner box).

- Point `.env.local` at the self-hosted instance (URL + keys)
- Migrations are SQL files in `supabase/migrations/`, applied via `psql` on the box (see `docs/supabase/migrations-guide.md`)

### 5. Start Development Server

```bash
# Use the clean start command (recommended)
pnpm run fresh:start

# Alternative (if ports conflict)
pnpm run dev:clean
```

## 🔧 Development Environment Details

### Node.js Setup

- **Version**: 18.17.0+ (LTS)
- **Package Manager**: pnpm 11 (`pnpm-lock.yaml` is the only lockfile)
- **Environment**: Development uses `.env.local`

### Supabase Configuration

- **Development & Production**: Uses the self-hosted Supabase instance at `https://supabase.orangecat.ch` (Hetzner box)
- **No Local Database**: Single self-hosted instance for consistency
- **Migrations**: SQL files in `supabase/migrations/` applied via `psql` (see `docs/supabase/migrations-guide.md`)

### VS Code Extensions (Recommended)

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "formulahendry.auto-rename-tag"
  ]
}
```

## 🧪 Testing Setup

### Test Database

```bash
# Set up test environment
cp .env.example .env.test.local

# Run tests
pnpm test

# Run with coverage
pnpm run test:coverage
```

### Browser Testing

```bash
# Install Playwright browsers
pnpm exec playwright install

# Run E2E tests
pnpm run test:e2e
```

## 🔒 Security Setup

### Environment Variables

```bash
# Required for development
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Optional for advanced features
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_ACCESS_TOKEN=your_access_token
```

### Authentication Setup

- Supabase handles authentication automatically
- No additional setup required for basic auth
- Social logins configured in Supabase dashboard

## 🐛 Debugging Setup

### Browser DevTools

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Check Console for errors
4. Monitor Application tab for React DevTools

### VS Code Debugging

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/next/dist/bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

## 📊 Monitoring Setup

### Local Monitoring

```bash
# Start monitoring dashboard
pnpm run monitor:metrics

# Check application health
pnpm run health:check
```

### Error Tracking

- Console errors automatically logged
- Production errors sent to monitoring service
- Database query performance tracked

## 🚀 Advanced Setup Options

### Docker Development

```bash
# Build and run with Docker
docker-compose up --build

# Run tests in Docker
docker-compose run --rm app pnpm test
```

### Multiple Environment Setup

```bash
# Development
cp config/production.env.template .env.local

# Staging
cp config/production.env.template .env.staging

# Production
# Handled by deployment platform
```

## 🔧 Troubleshooting Setup Issues

### Port Conflicts

```bash
# Kill existing Node processes
pnpm run kill:node

# Clear Next.js cache
pnpm run clear:cache

# Start fresh
pnpm run fresh:start
```

### Database Issues

OrangeCat uses cloud Supabase - no local database to manage.

```bash
# Check cloud database connectivity
node scripts/diagnostics/check-supabase.js

# View database logs / run schema changes
# (Managed Supabase Cloud retired 2026-06 — DB is now self-hosted at supabase.orangecat.ch on the Hetzner box; access via the box / founder.)
```

### Permission Issues

```bash
# Fix file permissions
chmod +x scripts/*.sh
chmod +x scripts/*.bat

# Fix node_modules permissions (if needed)
sudo chown -R $(whoami) node_modules/
```

## 📚 Related Documentation

- **[Development Workflow](./README.md)** - Complete development guide
- **[Architecture Overview](../architecture/overview.md)** - System design
- **[Testing Guide](../testing/README.md)** - Testing strategies
- **[Deployment Guide](../deployment/README.md)** - Production deployment

## 🆘 Getting Help

If you encounter issues:

1. **Check existing documentation** - Browse `/docs/` thoroughly
2. **Search GitHub issues** - Others may have encountered similar problems
3. **Check console logs** - Error messages often provide clues
4. **Verify environment variables** - Ensure all required variables are set

---

**Last Updated:** 2026-06-15
**Setup Time:** ~5-10 minutes for basic setup, ~30 minutes for full environment
