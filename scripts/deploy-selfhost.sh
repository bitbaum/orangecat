#!/usr/bin/env bash
#
# OrangeCat self-host deploy — atomic swap + boot-test + rollback.
#
# OrangeCat is one of the four hand-rolled "snowflake" services on bitbaum
# (not managed by fleetcrown/scripts/hetzner/sync-infra.sh, not in apps.conf):
# it keeps its own systemd unit + Caddy block and uses this safer deploy than
# the fleet's in-place `deploy.sh` (which rsyncs over the live tree with no
# rollback). The flow, proven in the runbook:
#
#   build standalone (off-box) → assemble static+public → rsync to a STAGING
#   dir → boot-test on a scratch port → atomic swap live↔staging (keep backup)
#   → restart service → health-check → auto-rollback on failure → verify public.
#
# The box build OOMs, so we always build locally / in CI and ship the artifact.
#
# Usage:
#   scripts/deploy-selfhost.sh              # build, then deploy
#   scripts/deploy-selfhost.sh --no-build   # deploy an already-built .next/standalone (CI)
#
# Config (env, with proven defaults):
#   OC_BOX        SSH target              (default root@167.233.22.31)
#   OC_APP_BASE   app dir on box          (default /opt/orangecat)
#   OC_SERVICE    systemd unit            (default orangecat-app)
#   OC_PORT       live port               (default 4003)
#   OC_BOOT_PORT  scratch boot-test port  (default 4099)
#   OC_HEALTH     health path             (default /api/health)
#   OC_PUBLIC     public health URL       (default https://orangecat.ch/api/health)
set -euo pipefail

OC_BOX="${OC_BOX:-root@167.233.22.31}"
OC_APP_BASE="${OC_APP_BASE:-/opt/orangecat}"
OC_SERVICE="${OC_SERVICE:-orangecat-app}"
OC_PORT="${OC_PORT:-4003}"
OC_BOOT_PORT="${OC_BOOT_PORT:-4099}"
OC_HEALTH="${OC_HEALTH:-/api/health}"
OC_PUBLIC="${OC_PUBLIC:-https://orangecat.ch/api/health}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ "${1:-}" != "--no-build" ]; then
  # Fail fast: a ~30s type-check before the ~7-min build, so a type error never
  # costs a full build+rsync cycle to discover. (next build type-checks too, but
  # only after compiling.) type-check is non-incremental → deterministic.
  echo "=== type-check (fail fast) ==="
  pnpm run type-check
  echo "=== build (SELF_HOST=1) ==="
  SELF_HOST=1 pnpm run build
fi

ST="$REPO_ROOT/.next/standalone"
[ -d "$ST" ] || { echo "ERROR: no .next/standalone — build with SELF_HOST=1 first" >&2; exit 1; }

echo "=== assemble standalone (static + public) ==="
# When CD ships a pre-assembled artifact (CI built the standalone with static +
# public already copied in), the repo-root .next/static / public won't exist —
# skip the copy rather than failing. A freshly-built tree still has them and
# assembles normally. The artifact is ALWAYS pre-assembled before upload, so a
# skipped copy here never means missing assets.
[ -d "$REPO_ROOT/.next/static" ] && cp -r "$REPO_ROOT/.next/static" "$ST/.next/static"
[ -d "$REPO_ROOT/public" ] && cp -r "$REPO_ROOT/public" "$ST/public"

# ── shiki top-level link ──────────────────────────────────────────────────────
# Next auto-externalizes shiki, and bip-kit's ArticleBody loads it with plain
# Node resolution from the server chunk at runtime. Output tracing copies the
# .pnpm store entries into standalone/node_modules/.pnpm but never emits the
# top-level node_modules/shiki symlink, so on the box (no outer node_modules to
# leak from) the import finds nothing and long-form code blocks silently render
# as the un-highlighted mono fallback while dev shows them highlighted.
# Same trap and same fix as FleetCrown #513: what the tracer can't see, the
# assemble step must supply. Version-agnostic; no-op when already present.
SHIKI_STORE_ENTRY="$(ls "$ST/node_modules/.pnpm" 2>/dev/null | grep -E '^shiki@' | head -1 || true)"
if [ -n "$SHIKI_STORE_ENTRY" ] && [ ! -e "$ST/node_modules/shiki" ]; then
  ln -s ".pnpm/$SHIKI_STORE_ENTRY/node_modules/shiki" "$ST/node_modules/shiki"
  echo "→ deploy: linked standalone node_modules/shiki -> .pnpm/$SHIKI_STORE_ENTRY"
fi

echo "=== rsync → $OC_BOX:$OC_APP_BASE/app-next ==="
for attempt in 1 2 3; do
  rsync -a --delete --no-perms --no-owner --no-group --omit-dir-times \
    -e "ssh ${SSH_OPTS[*]}" \
    "$ST"/ "$OC_BOX:$OC_APP_BASE/app-next/" && break
  echo "rsync attempt $attempt failed; retrying…" >&2
  [ "$attempt" = 3 ] && { echo "ERROR: rsync failed after 3 attempts" >&2; exit 1; }
done

echo "=== apply pending DB migrations → box ==="
# Delegated to the SSOT script (ensure-tracking-table + backfill guard + per-file
# transactions + record-on-success + abort-on-first-failure with the failing
# filename). Runs BEFORE the boot-test/swap so the schema is ready before the new
# code goes live, and a migration failure aborts the deploy loudly with the
# current live release untouched. See scripts/apply-migrations.sh and
# docs/operations/MIGRATIONS.md for the full rationale (single-txn `-1` mode,
# 2026-06-19 half-applied-view regression, etc.).
OC_BOX="$OC_BOX" bash scripts/apply-migrations.sh || {
  echo "ERROR: migrations failed — aborting deploy (live release untouched)" >&2
  exit 1
}

echo "=== schema-drift gate (deployed code vs LIVE box schema) ==="
# Migrations applying is necessary but not sufficient: the box can still lack an
# object the code needs — e.g. a migration that was backfilled-as-applied but never
# actually ran (the ai_conversations outage), or a manual DB change. Dump the box's
# REAL post-migration schema and fail the deploy if the code references a table/
# column that isn't there, BEFORE the swap — turning silent prod 500s into a loud
# deploy-time stop. Known pre-existing gaps are allowlisted in audit-schema-drift.mjs
# so this only blocks on NEW drift.
#
# Reachability: the dump is retried (a transient ssh blip must not silently
# disable the gate), and if the box schema genuinely can't be read after retries
# we BLOCK rather than ship unguarded — every later step (swap, restart) needs
# ssh anyway, so "can't read the schema" is not a benign hiccup here.
LIVE_SCHEMA_TMP="$(mktemp)"
dump_ok=0
for attempt in 1 2 3; do
  if OC_BOX="$OC_BOX" bash scripts/db/dump-live-schema.sh > "$LIVE_SCHEMA_TMP" 2>/dev/null && [ -s "$LIVE_SCHEMA_TMP" ]; then
    dump_ok=1; break
  fi
  echo "live-schema dump attempt $attempt failed; retrying…" >&2
  sleep 3
done
if [ "$dump_ok" != 1 ]; then
  rm -f "$LIVE_SCHEMA_TMP"
  echo "ERROR: could not dump the live box schema for the drift gate after 3 attempts —" >&2
  echo "       refusing to deploy unguarded. Check box reachability and retry." >&2
  exit 1
fi
if ! LIVE_SCHEMA_PATH="$LIVE_SCHEMA_TMP" node scripts/db/audit-schema-drift.mjs; then
  rm -f "$LIVE_SCHEMA_TMP"
  echo "ERROR: schema drift — deployed code references DB objects missing from the box (above)." >&2
  echo "       Add the missing migration (or allowlist if intentional). Aborting deploy; live release untouched." >&2
  exit 1
fi
rm -f "$LIVE_SCHEMA_TMP"

echo "=== boot-test + atomic swap + health-check (with rollback) ==="
ssh "${SSH_OPTS[@]}" "$OC_BOX" \
  "BASE='$OC_APP_BASE' SVC='$OC_SERVICE' PORT='$OC_PORT' BOOT='$OC_BOOT_PORT' HEALTH='$OC_HEALTH' bash -s" <<'REMOTE'
set -euo pipefail
: "${BASE:?}" "${SVC:?}" "${PORT:?}" "${BOOT:?}" "${HEALTH:?}"

# carry over runtime config the staging tree intentionally excludes
cp "$BASE/app/.env" "$BASE/app-next/.env"
[ -f "$BASE/app/launch.sh" ] && cp "$BASE/app/launch.sh" "$BASE/app-next/launch.sh"

# Ensure Node accepts large request headers. Default cap is 16KB; a browser with
# many accumulated sb-* auth cookies sends a Cookie header past that and gets a
# hard 431 (Request Header Fields Too Large) — "won't open in Brave". Raise to
# 64KB. Idempotent, so re-running / a freshly-regenerated launch.sh self-heals.
LSN="$BASE/app-next/launch.sh"
if [ -f "$LSN" ] && ! grep -q "max-http-header-size" "$LSN"; then
  sed -i 's#/usr/bin/node "#/usr/bin/node --max-http-header-size=65536 "#' "$LSN"
fi

chown -R ubuntu:ubuntu "$BASE/app-next"

# boot-test the staged build on a scratch port before touching the live tree
LOG="$(sudo -u ubuntu mktemp /tmp/oc-boottest.XXXX.log)"
( cd "$BASE/app-next" && sudo -u ubuntu env PORT="$BOOT" sh -c 'node server.js > '"$LOG"' 2>&1 &' )
ok=000
for _ in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$BOOT$HEALTH" || echo 000)"
  [ "$code" = "200" ] && { ok=200; break; }
  read -t 1 _ </dev/zero 2>/dev/null || true
done
# `pkill -f 'app-next/server.js'` does NOT reliably match the running
# process: Next's standalone server rewrites its own process title to
# "next-server (v...)" during startup, and that rewrite changes
# /proc/PID/cmdline itself, not just what `ps` displays — confirmed
# 2026-08-29 by reading /proc/PID/cmdline directly on a leaked instance.
# Once boot succeeds (usually well before this line runs, since the
# health-check loop above can take up to 20s), pkill -f has nothing left to
# match, and the boot-test process leaks forever, squatting on $BOOT. That
# then silently wedges every FUTURE deploy: the next boot-test binds a
# different port collision or hits the stale process's stale health
# response instead of the new build. Kill by what's actually listening on
# the port instead — immune to whatever the process calls itself.
fuser -k "$BOOT/tcp" 2>/dev/null || true
# Name the cause BEFORE the tail.
#
# Node prints a boot failure as one line that says what is wrong —
# `Error: Cannot find module '@swc/helpers/_/_interop_require_default'` — followed
# by a require stack and a trace that run well past twenty lines. `tail -25`
# therefore kept the twenty lines that identify nothing and cut the single line
# that identifies everything. On 2026-09-07 that turned a two-minute diagnosis
# into forty: the CI log showed only `BOOT-TEST FAILED (000)` and a require
# stack, and the module name had to be recovered by ssh'ing to the box and
# requiring the file by hand.
#
# grep first, tail second, and grep with `|| true` so a failure that does not
# match still prints the tail rather than exiting here on grep's exit status.
[ "$ok" != "200" ] && {
  echo "BOOT-TEST FAILED ($ok)"
  echo "--- cause (first error line) ---"
  grep -m1 -E "Error:|Cannot find module|MODULE_NOT_FOUND|ERR_" "$LOG" || echo "(no error line matched — see tail)"
  echo "--- last 40 lines ---"
  tail -40 "$LOG"
  exit 1
}
echo "boot-test: OK"

# atomic swap: live → app-old, staging → live (keep app-old for rollback)
rm -rf "$BASE/app-old"
mv "$BASE/app" "$BASE/app-old"
mv "$BASE/app-next" "$BASE/app"
chown -R ubuntu:ubuntu "$BASE/app"

systemctl restart "$SVC"
live=000
for _ in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT$HEALTH" || echo 000)"
  [ "$code" = "200" ] && { live=200; break; }
  read -t 1 _ </dev/zero 2>/dev/null || true
done

if [ "$live" != "200" ]; then
  echo "HEALTH FAILED ($live) — ROLLING BACK"
  mv "$BASE/app" "$BASE/app-broken"
  mv "$BASE/app-old" "$BASE/app"
  systemctl restart "$SVC"
  exit 1
fi

# Keep the previous release at app-old as a manual-rollback target until the NEXT
# deploy (which removes it at its start, above). Deleting it here left zero
# rollback target between deploys. NOTE: we do NOT auto-rollback on a failed
# PUBLIC health check below — local health already passed, so a public failure is
# a Caddy/DNS/network issue, and reverting a healthy app would not fix that.
echo "DEPLOY_OK (local health 200) — previous release kept at app-old for manual rollback"
REMOTE

echo "=== ensure Caddy kills HTTP/3 (Brave/QUIC self-heal) ==="
# Root cause this guards against: Caddy defaults to HTTP/3, advertising
# `alt-svc: h3` for 30 days. Brave honours that cached alt-svc aggressively and
# hangs when QUIC is in any way flaky (SSE/streaming over h3 timed out on this
# box) — so the site "won't open in Brave" while Chrome silently falls back to
# h2. Two complementary guards, both idempotent, both re-asserted every deploy
# because the box Caddyfile is hand-maintained and these get dropped on rewrite:
#   1. global `{ servers { protocols h1 h2 } }` — stops NEW h3 advertising.
#   2. `header Alt-Svc "clear"` in the orangecat.ch block — actively EVICTS h3
#      entries already cached in a visitor's Brave (protocols-only can't undo a
#      cache that was set before h3 was disabled; this is why Brave kept hanging).
# (install -m 644: the file MUST stay readable by the caddy service user, or
# `systemctl reload caddy` fails with permission-denied.)
ssh "${SSH_OPTS[@]}" "$OC_BOX" 'bash -s' <<'CADDY_GUARD' || echo "WARN: caddy h3-guard step failed (non-fatal)" >&2
set -e
CF=/etc/caddy/Caddyfile
changed=0
backup_once() { [ "$changed" = 0 ] && cp "$CF" "$CF.bak.$(date +%Y%m%d-%H%M%S)"; changed=1; }

# Guard 1: global protocols h1 h2 (no new h3 advertising)
if grep -q "protocols h1 h2" "$CF"; then
  echo "caddy h3-guard(protocols): already present — ok"
else
  echo "caddy h3-guard(protocols): MISSING -> prepending global protocols h1 h2"
  backup_once
  TMP=$(mktemp)
  printf '{\n\tservers {\n\t\tprotocols h1 h2\n\t}\n}\n\n' > "$TMP"
  cat "$CF" >> "$TMP"
  mv "$TMP" "$CF"
fi

# Guard 2: Alt-Svc: clear in the orangecat.ch block (evict already-cached h3)
if awk '/^orangecat\.ch, www\.orangecat\.ch \{/{f=1} f{print} /^\}/{if(f)exit}' "$CF" | grep -qi "Alt-Svc"; then
  echo "caddy h3-guard(alt-svc): already present — ok"
else
  echo "caddy h3-guard(alt-svc): MISSING -> adding header Alt-Svc clear to orangecat.ch"
  backup_once
  TMP=$(mktemp)
  awk '/^orangecat\.ch, www\.orangecat\.ch \{/{print; print "\theader Alt-Svc \"clear\""; next} {print}' "$CF" > "$TMP"
  mv "$TMP" "$CF"
fi

if [ "$changed" = 1 ]; then
  if caddy validate --adapter caddyfile --config "$CF" >/dev/null 2>&1; then
    chmod 644 "$CF"; systemctl reload caddy && echo "caddy h3-guard: applied + reloaded"
  else
    echo "caddy h3-guard: validate FAILED — restoring backup" >&2
    cp "$(ls -t "$CF".bak.* | head -1)" "$CF"
  fi
else
  echo "caddy h3-guard: nothing to change"
fi
CADDY_GUARD

echo "=== ship ops scripts + nightly Cat-eval timer ==="
# The nightly eval (scripts/eval-cat.mjs + scripts/systemd/orangecat-cat-eval.*)
# lives OUTSIDE the app swap dir so it survives releases. Repo is the SSOT for
# both the script and the unit files; every deploy re-syncs them and reloads
# systemd only when a unit actually changed. Non-fatal: an eval-ship hiccup
# must never roll back a good app deploy.
{
  ssh "${SSH_OPTS[@]}" "$OC_BOX" "mkdir -p $OC_APP_BASE/scripts"
  # Every eval-*.mjs ships together. This used to be a hand-written list of
  # three files with a comment warning that eval-cat.mjs imports a sibling
  # "next to itself — ship them together or the timer breaks". On 2026-09-11
  # a fourth sibling (eval-rate-limit.mjs) was added, the list was not, and the
  # deployed eval-cat.mjs pointed at a file that was not there: the nightly
  # timer would have crashed on import. A glob cannot forget a file, and
  # __tests__/unit/scripts/eval-siblings-shipped.test.ts proves every relative
  # import of the eval scripts is covered by it.
  scp "${SSH_OPTS[@]}" -q scripts/eval-*.mjs "$OC_BOX:$OC_APP_BASE/scripts/"
  scp "${SSH_OPTS[@]}" -q scripts/check-data-invariants.mjs \
    "$OC_BOX:$OC_APP_BASE/scripts/check-data-invariants.mjs"
  # ONE list. It used to be written three times — the scp arguments, the
  # install loop and the enable calls — so adding a timer meant editing three
  # places, and missing the third shipped a unit file that never ran. That is
  # the same silent-failure shape as a cron route nothing invokes.
  UNITS=(
    orangecat-cat-eval.service
    orangecat-cat-eval.timer
    orangecat-cat-outcomes.service
    orangecat-cat-outcomes.timer
    orangecat-data-invariants.service
    orangecat-data-invariants.timer
    "orangecat-cron@cat-account.timer"
    "orangecat-cron@cat-mentions.timer"
    "orangecat-cron@cat-brief.timer"
    "orangecat-cron@cat-watches.timer"
    "orangecat-cron@reindex-embeddings.timer"
  )
  scp "${SSH_OPTS[@]}" -q "${UNITS[@]/#/scripts/systemd/}" "$OC_BOX:/tmp/"
  ssh "${SSH_OPTS[@]}" "$OC_BOX" 'bash -s' "${UNITS[@]}" <<'EVAL_UNITS'
set -e
units=("$@")
changed=0
for u in "${units[@]}"; do
  if ! cmp -s "/tmp/$u" "/etc/systemd/system/$u" 2>/dev/null; then
    install -m 644 "/tmp/$u" "/etc/systemd/system/$u"; changed=1
  fi
  rm -f "/tmp/$u"
done
[ "$changed" = 1 ] && systemctl daemon-reload
# Enable every TIMER we shipped, derived from the same list — a timer that is
# installed but never enabled is a job that silently never runs.
for u in "${units[@]}"; do
  case "$u" in
    *.timer)
      systemctl enable --now "$u" >/dev/null
      echo "$u: $(systemctl is-enabled "$u") / $(systemctl is-active "$u")"
      ;;
  esac
done
EVAL_UNITS
} || echo "WARN: cat-eval ship step failed (non-fatal)" >&2

echo "=== verify public ==="
pub="$(curl -sL -o /dev/null -w '%{http_code}' --max-time 20 "$OC_PUBLIC" || echo 000)"
echo "public $OC_PUBLIC → $pub"
[ "$pub" = "200" ] || { echo "WARN: public health != 200 (Caddy/DNS?)" >&2; exit 1; }
echo "✅ deployed and live"
