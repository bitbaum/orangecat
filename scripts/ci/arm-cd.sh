#!/usr/bin/env bash
#
# Dispatch CD on main, and prove it actually started.
#
# WHY THIS EXISTS
# ---------------
# CD accepts one explicit handoff from successful main CI. This passes the
# triggering run ID and SHA so CD downloads the exact artifact CI built and
# tested instead of rebuilding. It also avoids racing an independent
# `workflow_run` trigger against the scheduled auto-merge reconciler.
#
# A dispatch that quietly creates no run is the same silent failure one level
# down, so it is verified rather than assumed. If no run appears, exit non-zero:
# CI goes red on main, which halts the merge train (auto-merge refuses a broken
# base) and files the red-main issue. Stopping is the correct response to "we
# can no longer ship" — piling up more unshippable merges is not.

set -euo pipefail

REPO="${REPO:?REPO is required}"
BASE_BRANCH="${BASE_BRANCH:-main}"

latest_cd_run() {
  gh run list --repo "$REPO" --workflow cd.yml --limit 1 \
    --json databaseId --jq '.[0].databaseId // 0'
}

before=$(latest_cd_run)
echo "[arm-cd] latest CD run before dispatch: ${before}"

gh workflow run cd.yml --repo "$REPO" --ref "$BASE_BRANCH" \
  -f ci_run_id="${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}" \
  -f ci_sha="${GITHUB_SHA:?GITHUB_SHA is required}"
echo "[arm-cd] dispatched cd.yml on ${BASE_BRANCH} with CI artifact ${GITHUB_RUN_ID} (${GITHUB_SHA})"

for attempt in $(seq 1 12); do
  sleep 5
  after=$(latest_cd_run)
  if [ "$after" != "$before" ]; then
    echo "[arm-cd] CD armed — run ${after}"
    exit 0
  fi
  echo "[arm-cd] no new CD run yet (attempt ${attempt})"
done

echo "::error title=CD not armed::Dispatched cd.yml on ${BASE_BRANCH} but no run appeared within 60s. Deploys are stalled; main is deliberately red until this is fixed."
exit 1
