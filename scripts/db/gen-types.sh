#!/usr/bin/env bash
#
# Regenerate src/types/database.generated.ts from the LIVE self-hosted Postgres
# schema. We use the box's postgres-meta service (`/generators/typescript`) rather
# than `supabase gen types --db-url`, because the CLI's --db-url mode is broken in
# 2.67.x (it ignores the URL and tries the local stack). postgres-meta produces
# byte-identical output and is already running, connected to the live DB.
#
# Requires SSH access to the box: set OC_BOX to the SSH target (user@host).
set -euo pipefail

BOX="${OC_BOX:?set OC_BOX to the box SSH target, e.g. OC_BOX=root@<box-host>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$SCRIPT_DIR/../../src/types/database.generated.ts"

echo "Fetching live schema types from $BOX (postgres-meta)…"
body="$(ssh -o StrictHostKeyChecking=no "$BOX" \
  'IP=$(docker inspect -f "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}" supabase-meta); \
   curl -fsS "http://${IP}:8080/generators/typescript?included_schemas=public"')"

if [ -z "$body" ]; then
  echo "ERROR: empty response from postgres-meta" >&2
  exit 1
fi

{
  printf '%s\n' "// AUTO-GENERATED from the LIVE self-hosted Postgres schema. DO NOT EDIT BY HAND."
  printf '%s\n' "// Regenerate:  npm run gen:types   (see scripts/db/gen-types.sh)"
  printf '%s\n' "// Source of truth: supabase.orangecat.ch — postgres-meta /generators/typescript"
  printf '%s\n' "$body"
} > "$OUT"

echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
echo "Reminder: also refresh the audit snapshot if columns changed (scripts/db/live-schema.json)."
