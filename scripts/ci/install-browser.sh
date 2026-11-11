#!/usr/bin/env bash
# Install the Playwright browser for a CI job without letting Ubuntu's package
# mirrors decide whether the job runs.
#
# `playwright install --with-deps` runs apt for fonts and system libraries. On
# 2026-11-11 the runner could not resolve archive.ubuntu.com for over an hour,
# so build-and-smoke and cat-chat failed twice on a pull request before a
# single test ran. The browser itself comes from Playwright's own host, and the
# runner image already carries the libraries it needs.
#
#   scripts/ci/install-browser.sh [browser ...]   (default: chromium)
set -uo pipefail

browsers=("$@")
[ "${#browsers[@]}" -gt 0 ] || browsers=(chromium)

for attempt in 1 2 3; do
  if pnpm exec playwright install --with-deps "${browsers[@]}"; then
    exit 0
  fi
  echo "install with system packages failed (attempt $attempt of 3)"
  [ "$attempt" -lt 3 ] && sleep $((attempt * 20))
done

# The mirrors are still unreachable: install the browser alone. If the image
# really lacks a library the browser needs, the tests fail on launch and say so.
echo "::warning::System packages could not be installed (package mirrors unreachable). Installing ${browsers[*]} without them."
exec pnpm exec playwright install "${browsers[@]}"
