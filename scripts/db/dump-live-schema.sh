#!/usr/bin/env bash
#
# Dump the self-host's LIVE public schema as { "table": ["col", ...] } JSON —
# the exact format audit-schema-drift.mjs consumes (scripts/db/live-schema.json).
#
# The static snapshot in the repo goes stale; the deploy pipeline calls this to
# get the box's ACTUAL schema (after applying pending migrations) and gate the
# release on a fresh drift check. Includes views (information_schema.columns
# covers them), so a missing real table is genuinely missing.
#
# Usage:
#   scripts/db/dump-live-schema.sh > /tmp/live-schema.json
#   OC_BOX=root@host scripts/db/dump-live-schema.sh > out.json
#
# Config: OC_BOX (required, user@host), OC_DB_CONTAINER (default supabase-db).
set -euo pipefail

OC_BOX="${OC_BOX:?set OC_BOX to the box SSH target, e.g. OC_BOX=root@<box-host>}"
OC_DB_CONTAINER="${OC_DB_CONTAINER:-supabase-db}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=12)

read -r -d '' SQL <<'EOSQL' || true
SELECT COALESCE(
  json_object_agg(table_name, cols),
  '{}'::json
)
FROM (
  SELECT table_name, json_agg(column_name ORDER BY ordinal_position) AS cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
  GROUP BY table_name
) t;
EOSQL

ssh "${SSH_OPTS[@]}" "$OC_BOX" \
  "docker exec -i $OC_DB_CONTAINER psql -U postgres -d postgres -tAc \"$(printf '%s' "$SQL" | tr '\n' ' ')\""
