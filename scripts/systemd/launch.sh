#!/usr/bin/env bash
# OrangeCat app launcher (SSOT) — vendored from the box (/opt/orangecat/app/launch.sh).
# Sources the runtime .env and starts the Next.js standalone server. The
# --max-http-header-size=65536 raises Node's 16KB header cap so a browser with many
# accumulated sb-* auth cookies doesn't get a hard 431 ("won't open in Brave");
# deploy-selfhost.sh also self-heals this flag on the box copy each deploy.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$HERE/.env" ]; then
  set -a
  source "$HERE/.env"
  set +a
fi
# `unset` does NOT bind to localhost — it makes Next fall back to ITS OWN
# default, which is 0.0.0.0 (every interface). Found 2026-08-29: this left
# orangecat reachable on all interfaces, mitigated only by ufw's
# default-deny (not something to rely on as the actual boundary).
export HOSTNAME=127.0.0.1
export NODE_ENV="production"
exec /usr/bin/node --max-http-header-size=65536 "$HERE/server.js"
