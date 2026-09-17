#!/usr/bin/env bash
#
# OrangeCat self-host migration apply — the SSOT for getting supabase/migrations/*
# onto the box DB. Kills the "manually psql a migration and forget" drift class
# that caused a whole family of prod 500s.
#
# The self-host has no Supabase-CLI migration tracking. Applied files are recorded
# in public.schema_migrations (filename text PK, applied_at timestamptz), one-time
# backfilled with the 147 pre-existing migrations on 2026-06-18. This script:
#
#   1. Ensures the tracking table exists (CREATE TABLE IF NOT EXISTS).
#   2. Refuses to run a full replay against an already-populated DB: if the
#      tracking table is EMPTY but core app tables exist, it aborts and tells you
#      to run --backfill (mark everything up-to-now as applied, never re-run).
#   3. Applies pending *.sql in filename order, EACH inside a single transaction
#      (`psql -1`), recording the filename only after success.
#   4. Aborts non-zero on the first failure, printing the failing filename —
#      callers (deploy) must treat that as a hard stop.
#
# `-1` (single-transaction) is CRITICAL: it wraps each migration in BEGIN/COMMIT
# so a mid-file failure ROLLS BACK every statement. Without it, a migration that
# drops a view early then fails later leaves the schema half-applied — it dropped
# a live view the app needs but never recreated it (a real prod regression on
# 2026-06-19). No migration uses CREATE INDEX CONCURRENTLY (verified), so
# single-txn mode is safe.
#
# Usage:
#   scripts/apply-migrations.sh              # apply pending, record, abort on failure
#   scripts/apply-migrations.sh --dry-run    # list pending only, change nothing
#   scripts/apply-migrations.sh --backfill   # bootstrap: record ALL current files as
#                                            # applied WITHOUT running them (only for a
#                                            # DB that predates tracking / already has
#                                            # the schema). Idempotent.
#
# Config (env, with proven defaults):
#   OC_BOX             SSH target, user@host         (REQUIRED — no default)
#   OC_DB_CONTAINER    supabase-db container name    (default supabase-db)
#   OC_MIGRATIONS_DIR  migrations dir                (default supabase/migrations)
#
# NOTE: OC lives in the supabase-db CONTAINER's `postgres` DB — never the
# box-system Postgres. All DB access goes through `docker exec supabase-db psql`.
set -euo pipefail

OC_BOX="${OC_BOX:?set OC_BOX to the box SSH target, e.g. OC_BOX=root@<box-host>}"
OC_DB_CONTAINER="${OC_DB_CONTAINER:-supabase-db}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OC_MIGRATIONS_DIR="${OC_MIGRATIONS_DIR:-$REPO_ROOT/supabase/migrations}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o BatchMode=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=4)

MODE="apply"
case "${1:-}" in
  --dry-run)  MODE="dry-run" ;;
  --backfill) MODE="backfill" ;;
  '') ;;
  *) echo "Usage: $0 [--dry-run|--backfill]" >&2; exit 2 ;;
esac

[ -d "$OC_MIGRATIONS_DIR" ] || { echo "ERROR: migrations dir not found: $OC_MIGRATIONS_DIR" >&2; exit 1; }

# The ONE channel for DB statements (SSOT for the connection path). SQL always
# arrives via STDIN — never `-c` — so nothing needs shell-quoting across the
# local-shell → ssh → remote-shell → docker-exec boundary.
box_psql() {
  ssh "${SSH_OPTS[@]}" "$OC_BOX" \
    "docker exec -i $OC_DB_CONTAINER psql -U postgres -d postgres -v ON_ERROR_STOP=1 $*"
}

record_applied() { # $1 = filename (recorded only after a successful apply)
  printf "INSERT INTO public.schema_migrations(filename) VALUES ('%s') ON CONFLICT DO NOTHING;\n" \
    "${1//\'/\'\'}" | box_psql -q
}

# --- 1. Ensure tracking table -------------------------------------------------
box_psql -q <<'SQL'
SET client_min_messages TO WARNING; -- silence the "already exists, skipping" NOTICE
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename   text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL

# --- 2. Read tracked + compute pending (filename order) ------------------------
# Integrity-checked fetch: emit the row count first, then the rows, in ONE psql
# call, and verify they agree. A silently-truncated list over ssh would otherwise
# mark an already-applied OLD migration as pending and re-execute it against prod
# (observed once during live testing — this guard exists because of that).
applied_raw="$(box_psql -tA <<'SQL'
SELECT count(*) FROM public.schema_migrations;
SELECT filename FROM public.schema_migrations;
SQL
)"
expected_count="$(printf '%s\n' "$applied_raw" | head -1)"
applied="$(printf '%s\n' "$applied_raw" | tail -n +2)"
applied_count="$(printf '%s' "$applied" | grep -c . || true)"
if [ "$applied_count" != "$expected_count" ]; then
  echo "ERROR: tracking-list fetch integrity check failed (expected $expected_count rows, got $applied_count) — refusing to compute pending from a corrupt list" >&2
  exit 1
fi

pending=()
for mig in "$OC_MIGRATIONS_DIR"/*.sql; do
  [ -e "$mig" ] || break
  fn="$(basename "$mig")"
  printf '%s\n' "$applied" | grep -qxF "$fn" || pending+=("$fn")
done

# --- 3. Backfill mode: record everything up to now as applied, run nothing -----
if [ "$MODE" = "backfill" ]; then
  echo "=== backfill: recording ${#pending[@]} unrecorded file(s) as applied (no SQL executed) ==="
  for fn in "${pending[@]}"; do
    record_applied "$fn"
    echo "  ✓ recorded $fn"
  done
  echo "backfill complete ($applied_count previously tracked, ${#pending[@]} added)"
  exit 0
fi

# --- Safety guard: empty tracking + populated DB = you forgot --backfill --------
# Replaying 160+ historical migrations against a live schema would be
# catastrophic (old files are NOT all idempotent). Detect a pre-tracking DB by
# core tables that have existed since the beginning.
if [ "$applied_count" = "0" ] && [ "${#pending[@]}" -gt 0 ]; then
  has_core="$(echo "SELECT count(*) FROM information_schema.tables
               WHERE table_schema='public' AND table_name IN ('profiles','actors');" | box_psql -tA)"
  if [ "${has_core:-0}" -gt 0 ]; then
    echo "ERROR: tracking table is empty but the DB already has core app tables." >&2
    echo "       This DB predates migration tracking — run '$0 --backfill' ONCE first" >&2
    echo "       (marks all current files as applied; old files must never re-run)." >&2
    exit 1
  fi
fi

# --- 4. Dry-run: list pending, change nothing ----------------------------------
if [ "$MODE" = "dry-run" ]; then
  if [ "${#pending[@]}" -eq 0 ]; then
    echo "dry-run: 0 pending migrations ($applied_count tracked, all up to date)"
  else
    echo "dry-run: ${#pending[@]} pending migration(s):"
    printf '  → %s\n' "${pending[@]}"
  fi
  exit 0
fi

# --- 5. Apply pending, in filename order, one transaction each ------------------
if [ "${#pending[@]}" -eq 0 ]; then
  echo "migrations up to date ($applied_count tracked, 0 pending)"
  exit 0
fi

echo "=== applying ${#pending[@]} pending migration(s) ==="
for fn in "${pending[@]}"; do
  # Last-line-of-defense recheck straight against the DB (not the cached list):
  # NEVER execute a file the DB already has recorded. Pending is normally 0–3
  # files, so the extra round trip is free.
  already="$(printf "SELECT count(*) FROM public.schema_migrations WHERE filename='%s';\n" \
    "${fn//\'/\'\'}" | box_psql -tA)"
  if [ "${already:-0}" != "0" ]; then
    echo "  ↷ skipping $fn — already recorded in the DB (stale local list)"
    continue
  fi
  echo "  → applying $fn"
  if box_psql -1 -q < "$OC_MIGRATIONS_DIR/$fn"; then
    record_applied "$fn"
    echo "  ✓ applied + recorded $fn"
  else
    echo "ERROR: migration FAILED: $fn — aborting (transaction rolled back, nothing recorded)" >&2
    exit 1
  fi
done
echo "✅ all migrations applied"
