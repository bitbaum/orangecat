#!/bin/bash
# .claude/commands/deploy-check.sh
# Pre-deployment verification checklist

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "🚀 Pre-Deployment Checklist"
echo "============================"

CHECKS_PASSED=0
CHECKS_FAILED=0

# Function to run check
run_check() {
  local name="$1"
  local command="$2"
  
  echo ""
  echo "Checking: $name..."
  if eval "$command" > /dev/null 2>&1; then
    echo "✅ $name passed"
    ((CHECKS_PASSED++))
  else
    echo "❌ $name FAILED"
    ((CHECKS_FAILED++))
  fi
}

# Run checks
run_check "Type check" "pnpm run type-check"
run_check "Lint check" "pnpm run lint -- --max-warnings 0"
run_check "Build" "pnpm run build"
run_check "Tests" "pnpm test -- --passWithNoTests"

# Environment variables check
echo ""
echo "Checking: Environment variables..."
if [ -f ".env.local" ]; then
  echo "✅ .env.local exists"
  ((CHECKS_PASSED++))
else
  echo "❌ .env.local missing"
  ((CHECKS_FAILED++))
fi

# Git status
echo ""
echo "Checking: Git status..."
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ No uncommitted changes"
  ((CHECKS_PASSED++))
else
  echo "⚠️  Uncommitted changes exist"
  echo "   Consider committing before deploy"
fi

# Console.log check
echo ""
echo "Checking: No console.logs in production code..."
if ! grep -r "console\.log" src/ --exclude-dir=__tests__ --exclude="*.test.ts" 2>/dev/null; then
  echo "✅ No console.logs found"
  ((CHECKS_PASSED++))
else
  echo "⚠️  console.logs found in source code"
  echo "   Remove before deploying to production"
fi

# Summary
echo ""
echo "============================"
echo "Summary: $CHECKS_PASSED passed, $CHECKS_FAILED failed"

if [ $CHECKS_FAILED -eq 0 ]; then
  echo "✅ Ready for deployment!"
  exit 0
else
  echo "❌ Fix issues before deploying"
  exit 1
fi
