#!/bin/bash
# .claude/commands/audit.sh
# Comprehensive project health check

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🔍 Running OrangeCat Project Audit"
echo "=================================="

# 1. Security Audit
echo ""
echo "🔒 Security Audit..."
pnpm audit --prod || echo "⚠️  Security vulnerabilities found"

# 2. Type Coverage
echo ""
echo "📝 Type Coverage..."
pnpm exec type-coverage --at-least 80 || echo "⚠️  Type coverage below 80%"

# 3. Unused Exports
echo ""
echo "🗑️  Checking for unused exports..."
pnpm exec ts-prune | head -20 || echo "No unused exports detected"

# 4. Bundle Size
echo ""
echo "📦 Bundle Size Analysis..."
pnpm run build > /dev/null 2>&1 || echo "Build failed"
du -sh .next/static/ 2>/dev/null || echo "No build artifacts found"

# 5. Database Health
echo ""
echo "🗄️  Database Health..."
# Was two `mcp_supabase_get_advisors` lines, printed rather than run, against a
# Management API retired in 2026-06. db-check.sh asks the self-host instead.
bash .claude/commands/db-check.sh || echo "⚠️  database health check incomplete"

# 6. Test Coverage
echo ""
echo "🧪 Test Coverage..."
pnpm test -- --coverage --silent 2>/dev/null || echo "Run tests manually"

# 7. Lint Status
echo ""
echo "🧹 Lint Status..."
pnpm run lint -- --max-warnings 0 || echo "⚠️  Lint warnings/errors found"

# 8. Git Status
echo ""
echo "📊 Git Status..."
echo "Branch: $(git branch --show-current)"
echo "Uncommitted changes: $(git status --short | wc -l)"
echo "Unpushed commits: $(git log @{u}.. --oneline 2>/dev/null | wc -l || echo 0)"

echo ""
echo "=================================="
echo "✅ Audit complete"
