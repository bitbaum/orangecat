#!/bin/bash
# .claude/commands/db-check.sh
# Database health against the self-hosted Supabase (supabase.orangecat.ch).
#
# This used to print five `mcp_supabase_*` calls and exit. That MCP talks to the
# managed-cloud Management API, which was RETIRED in 2026-06 — so every line it
# printed was an instruction to use a service that no longer backs production,
# and the script could not have told you, because it never called anything.
#
# It now runs the checks. A script that prints instructions is a worse copy of
# the documentation next to it; a script that asks the database is a check.
set -uo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
BOX="${SUPABASE_BOX:-ubuntu@167.233.22.31}"

echo "🗄️  Database Health Check"
echo "========================"

if [ ! -f "$ENV_FILE" ]; then
  echo "✗ no $ENV_FILE — credentials for the self-host live there" >&2
  exit 1
fi

# Read only what we need, and never echo a key's value.
URL=$(grep -m1 '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'')
KEY=$(grep -m1 '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"'')

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "✗ $ENV_FILE is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" >&2
  exit 1
fi
echo "   target: $URL"

rest() {   # rest <path>  — service-role bypasses RLS, so treat output as privileged
  curl -s -m 20 -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/$1"
}

echo ""
echo "1. PostgREST reachable"
code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "$URL/rest/v1/")
if [ "$code" = "200" ]; then echo "   ✓ $code"; else echo "   ✗ $code"; fi

echo ""
echo "2. Last applied migrations (the deploy applies these; never by hand)"
# The columns are filename/applied_at. Asking for a column that does not exist
# returns 400/42703, and printing that as "(none)" would report an empty
# migration table — a wrong answer rather than a failed question. So the error
# is shown as an error.
mig=$(rest 'schema_migrations?select=filename&order=applied_at.desc&limit=5')
if printf '%s' "$mig" | grep -q '"code"'; then
  echo "   ✗ query failed: $(printf '%s' "$mig" | head -c 200)"
elif [ "$mig" = "[]" ] || [ -z "$mig" ]; then
  echo "   ⚠️  table is EMPTY — a fresh database bootstraps as 'done' and"
  echo "      creates nothing, so an empty list here is a red flag, not a pass"
else
  printf '%s' "$mig" | grep -o '"filename":"[^"]*"' | cut -d'"' -f4 | sed 's/^/   /'
fi

# Anything PostgREST cannot express goes through the box. It is optional here:
# a laptop without the ssh key still gets the checks above rather than an error.
echo ""
echo "3. RLS on the user_* tables"
if ssh -o ConnectTimeout=10 -o BatchMode=yes "$BOX" true 2>/dev/null; then
  ssh "$BOX" "docker exec supabase-db psql -U postgres -d postgres -Atc \
    \"select relname, relrowsecurity from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname='public' and c.relkind='r' and relname like 'user\\_%'
       order by relname;\"" 2>/dev/null | sed 's/^/   /'
  echo ""
  echo "4. Tables with RLS DISABLED (each one is a public read of private rows)"
  ssh "$BOX" "docker exec supabase-db psql -U postgres -d postgres -Atc \
    \"select relname from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname='public' and c.relkind='r' and not relrowsecurity
       order by relname;\"" 2>/dev/null | sed 's/^/   ⚠️  /'
else
  echo "   – skipped: no ssh to $BOX (checks 3-4 need the box)"
fi

echo ""
echo "========================"
