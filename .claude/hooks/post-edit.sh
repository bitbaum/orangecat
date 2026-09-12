#!/bin/bash
# .claude/hooks/post-edit.sh
# Post-edit hook: Self-correction via automated checks
# Runs after Claude edits any file

set -e

EDITED_FILE="$1"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "🔍 Running post-edit checks on: $EDITED_FILE"

cd "$PROJECT_ROOT"

# 1. Type Check
echo "📝 Type checking..."
if pnpm run type-check 2>&1 | tee /tmp/type-errors.log; then
  echo "✅ Type check passed"
else
  echo "❌ Type errors detected. Claude will self-correct:" >&2
  cat /tmp/type-errors.log >&2
  exit 1
fi

# 2. Lint Check (with auto-fix)
echo "🧹 Linting..."
if pnpm run lint --fix 2>&1 | tee /tmp/lint-errors.log; then
  echo "✅ Lint check passed"
else
  echo "⚠️  Lint issues found:" >&2
  cat /tmp/lint-errors.log >&2
fi

# 3. Check for Magic Strings (hardcoded entity names)
echo "🔮 Checking for magic strings..."
if [[ "$EDITED_FILE" != *"entity-registry"* ]]; then
  if grep -nE "user_products|user_services|user_causes|user_events|user_projects" "$EDITED_FILE" 2>/dev/null; then
    echo "❌ Hardcoded entity names found in $EDITED_FILE!" >&2
    echo "   Use ENTITY_REGISTRY instead." >&2
    exit 1
  fi
fi

# 4. Check File Size
echo "📏 Checking file size..."
LINES=$(wc -l < "$EDITED_FILE")

if [[ "$EDITED_FILE" == *.tsx ]] && [ "$LINES" -gt 300 ]; then
  echo "⚠️  Component too large: $EDITED_FILE ($LINES lines)" >&2
  echo "   Recommend: Extract smaller components" >&2
fi

if [[ "$EDITED_FILE" == */app/api/* ]] && [ "$LINES" -gt 150 ]; then
  echo "⚠️  API route too large: $EDITED_FILE ($LINES lines)" >&2
  echo "   Recommend: Move logic to domain service" >&2
fi

# 5. Check for console.logs (if production file)
if [[ "$EDITED_FILE" == src/* ]] && ! [[ "$EDITED_FILE" == *test* ]]; then
  if grep -n "console\.log" "$EDITED_FILE" 2>/dev/null; then
    echo "⚠️  console.log found in $EDITED_FILE" >&2
    echo "   Remove before production or use proper logging" >&2
  fi
fi

echo "✅ Post-edit checks complete"
exit 0
