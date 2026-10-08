#!/usr/bin/env bash
# Has this exact code already passed `verify`?
#
# CI runs `verify` on a pull request, then — after the squash merge — again on
# main before anything deploys. When the base did not move while the PR was
# open, the merge commit's TREE is byte-for-byte the tree the PR's CI tested
# (refs/pull/N/merge), and the second run re-checks identical code. Measured
# 2026-10-08: 18 of 30 merges were exactly that, ~2.5 minutes each.
#
# The PR job records the tree it verified as an artifact named
# `verified-tree-<tree sha>` (pull requests from THIS repository only — a fork
# controls its own workflow file, so its word is not taken). Here we look that
# name up for HEAD's tree. Any doubt — an API error, no match, a match from
# elsewhere — answers "no", and `verify` runs exactly as before.
#
# Writes verified=true|false to $GITHUB_OUTPUT. Always exits 0: a lookup that
# fails must cost time, never skip a check.
set -uo pipefail

out="${GITHUB_OUTPUT:-/dev/stdout}"
answer() {
  echo "verified=$1" >> "$out"
  echo "already-verified: $2"
  exit 0
}

tree=$(git rev-parse 'HEAD^{tree}' 2>/dev/null) || answer false "cannot read HEAD's tree"
[ -n "${GITHUB_REPOSITORY:-}" ] && [ -n "${GITHUB_REPOSITORY_ID:-}" ] \
  || answer false "repository identity not available"

matches=$(gh api "repos/${GITHUB_REPOSITORY}/actions/artifacts?name=verified-tree-${tree}&per_page=20" \
  --jq "[.artifacts[] | select(.expired == false
                               and (.workflow_run.head_repository_id | tostring) == \"${GITHUB_REPOSITORY_ID}\")]
        | length" 2>/dev/null) || answer false "artifact lookup failed — verifying"

case "$matches" in
  '' | *[!0-9]*) answer false "unreadable lookup result — verifying" ;;
esac
if [ "$matches" -gt 0 ]; then
  answer true "tree ${tree:0:12} passed verify on its pull request — not re-checking identical code"
fi
answer false "tree ${tree:0:12} has not been verified as-is (the base moved, or it never ran) — verifying"
