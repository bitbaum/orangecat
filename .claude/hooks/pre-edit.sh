#!/bin/bash
# .claude/hooks/pre-edit.sh
# Pre-edit hook: Prevent destructive changes before they happen
# Runs before Claude edits any file

set -e

EDITING_FILE="$1"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "🛡️  Running pre-edit checks on: $EDITING_FILE"

# 1. Block sensitive files
if [[ "$EDITING_FILE" == *.env* ]] && [[ "$EDITING_FILE" != *.example ]]; then
  echo "❌ Cannot edit environment file: $EDITING_FILE" >&2
  echo "   Use 'node scripts/utils/env-manager.js backup' first" >&2
  exit 1
fi

# 2. Warn about migration files
if [[ "$EDITING_FILE" == supabase/migrations/*.sql ]]; then
  echo "⚠️  Editing migration file: $EDITING_FILE" >&2
  echo "   Migrations should be immutable once applied." >&2
  echo "   Consider creating a new migration instead." >&2
  # Allow but warn (don't exit)
fi

# 3. Check for entity registry modifications
if [[ "$EDITING_FILE" == *"entity-registry"* ]]; then
  echo "⚠️  Modifying entity registry: $EDITING_FILE" >&2
  echo "   This affects the entire system. Proceed with caution." >&2
fi

# 4. Block direct lockfile edits.
#
# This guarded `package-lock.json` in a repo whose lockfile is
# `pnpm-lock.yaml` (packageManager: pnpm@11), so it never fired on the file it
# exists to protect — and the advice it gave when it did fire, `npm install`,
# is what WRITES the npm lockfile a pnpm repo must not have. One worktree was
# found carrying exactly that stray package-lock.json.
if [[ "$EDITING_FILE" == pnpm-lock.yaml ]]; then
  echo "❌ Cannot directly edit pnpm-lock.yaml" >&2
  echo "   Use 'pnpm install' or 'pnpm update' instead" >&2
  exit 1
fi

if [[ "$EDITING_FILE" == package-lock.json ]]; then
  echo "❌ This repo is pnpm — package-lock.json should not exist here" >&2
  echo "   Delete it and run 'pnpm install'" >&2
  exit 1
fi

# 5. Check if file is in .gitignore (might be generated)
if git check-ignore "$EDITING_FILE" 2>/dev/null; then
  echo "⚠️  File is in .gitignore: $EDITING_FILE" >&2
  echo "   This might be a generated file. Are you sure?" >&2
fi

echo "✅ Pre-edit checks passed"
exit 0
