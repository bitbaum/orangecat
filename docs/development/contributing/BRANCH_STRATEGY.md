# Branch Strategy

## Overview

OrangeCat uses a **trunk-based development** workflow for faster iteration and simpler collaboration.

## Branch Structure

### Primary Branch

- **`main`** - Production-ready code
  - Protected with required checks
  - Auto-deploys to staging on push
  - Promoted to production via manual workflow

### Working Branches

- **`feat/*`** - New features (short-lived, 1-3 days)
- **`fix/*`** - Bug fixes (short-lived, <1 day)
- **`chore/*`** - Maintenance tasks (short-lived, <1 day)
- **`claude/*`** - AI agent branches (auto-PR to main)

## Workflow

### 1. Create a Branch

```bash
# Feature branch
git checkout -b feat/your-feature-name

# Bug fix
git checkout -b fix/issue-description

# Chore/maintenance
git checkout -b chore/task-description
```

### 2. Develop and Commit

```bash
# Make atomic commits with clear messages
git commit -m "feat: add user authentication"
git commit -m "fix: resolve memory leak in timeline"
git commit -m "chore: update dependencies"
```

**Commit Message Format:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `perf:` - Performance improvements

### 3. Push and Create PR

```bash
# Push your branch
git push -u origin feat/your-feature-name

# Create PR via GitHub UI or gh CLI
gh pr create --title "feat: Add user authentication" --base main
```

### 4. PR Requirements

All PRs to `main` must:

- ✅ Pass lint checks
- ✅ Pass type checks
- ✅ Pass unit tests
- ✅ Get 1+ approvals (for critical paths)
- ✅ Have up-to-date branch

Critical paths requiring review (via CODEOWNERS):

- `supabase/**` - Database schema changes
- `src/services/security/**` - Security-related code
- `src/middleware/**` - Authentication/authorization
- `scripts/deployment/**` - Deployment scripts

### 5. Merge and Deploy

```bash
# After PR approval:
# 1. Squash merge to main (GitHub does this automatically)
# 2. Branch auto-deletes after merge
# 3. Main auto-deploys to staging
# 4. Monitor staging for issues
# 5. Promote to production when ready
```

## CI/CD Checks

### PR Checks (Fast, ≤2 min)

- ESLint
- TypeScript type checking
- Unit tests
- Fast Node-based E2E tests

### Pre-Release Checks (Slower, ~10 min)

- Full Playwright E2E suite
- Integration tests
- Bundle size verification
- Security scanning

### Nightly Checks

- Full E2E suite (catches flaky tests)
- Dependency security audit
- Performance benchmarks

## Branch Protection Rules

**`main` branch is protected:**

- ❌ No direct pushes
- ✅ Require PR with reviews
- ✅ Require status checks to pass
- ✅ Require branch to be up-to-date
- ❌ No force push
- ✅ Auto-delete merged branches

## Deployment Strategy

```
Development → PR → main → Staging → Production
                    ↓         ↓          ↓
                   Auto    Monitor   Manual
                           2-24h    Approval
```

### Staging Deployment

- Automatic on every push to `main`
- Uses staging environment variables
- Full feature testing before production

### Production Deployment

- Manual approval required
- Triggered via GitHub Release or workflow
- Rollback available via previous release tag

## Branch Lifecycle

### Short-Lived Branches (Recommended)

```
Day 1: Create feat/new-feature
Day 1-2: Develop and commit
Day 2: Open PR
Day 2-3: Review and iterate
Day 3: Merge to main
```

**Keep branches alive for <3 days to minimize merge conflicts.**

### Stale Branch Cleanup

- Merged branches: Auto-deleted
- Unmerged branches >14 days old: Reviewed monthly
- Claude/AI branches: Archived after merge

## Special Cases

### Hotfixes

For critical production bugs:

```bash
# Create fix branch from main
git checkout -b fix/critical-security-issue main

# Fix, test, commit
git commit -m "fix: patch XSS vulnerability"

# Fast-track PR with "hotfix" label
gh pr create --label hotfix --base main

# After merge, deploy immediately to production
```

### Database Migrations

**Critical:** Never edit merged migrations!

```bash
# Create migration branch
git checkout -b feat/add-user-roles main

# Add new migration file
# supabase/migrations/YYYYMMDDHHMMSS_add_user_roles.sql

# Migration replay against a fresh DB runs in CI (.github/workflows/migration-replay.yml)

# Create PR with "database" label
# Requires review from database owner (CODEOWNERS)
```

## FAQ

**Q: Should I merge `main` into my feature branch?**
A: Prefer rebasing: `git rebase main` to keep linear history.

**Q: When should I use `develop` branch?**
A: We don't use `develop` anymore. All work goes to `main`.

**Q: How do I handle long-running features?**
A: Break into smaller PRs with feature flags. Ship incrementally.

**Q: What if CI is broken on main?**
A: Fix immediately or revert the breaking commit. `main` must always be green.

**Q: Can I push directly to main in emergencies?**
A: No. Even hotfixes go through PR (but can be fast-tracked with 1 approval).

## Resources

- [Contributing Guide](./CONTRIBUTING.md)
- [Code Review Guidelines](./CODE_REVIEW.md)
- [Deployment Documentation](../operations/DEPLOYMENT.md)
- [Database Migrations Guide](../../architecture/database/README.md)

---

**Questions?** Open an issue or ask in discussions.
