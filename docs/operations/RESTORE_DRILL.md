# OrangeCat — Restore Drill (proven 2026-07-03)

**Purpose:** prove the off-box backups actually restore, measure RTO, and record the
exact commands. This is the *verification* companion to
[`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) (which describes the full from-scratch
rebuild). Re-run this drill quarterly or after any change to the backup pipeline.

**Result 2026-07-03: ✅ GREEN.** Off-box restic snapshot → throwaway Postgres →
byte-for-byte data parity with prod. Two pipeline gaps found and fixed the same day
(see [Gaps found & fixed](#gaps-found--fixed)).

---

## What is being proven

The backup pipeline is `/opt/backups/pg-backup.sh` on the box (installed by the
loki Hetzner toolkit, scheduled by systemd `pg-backup.timer` at **02:30 UTC**):

1. Dumps every box-system Postgres DB (custom format) + system globals.
2. Dumps the **supabase-db container** DBs `postgres` (= OrangeCat) and `_supabase`,
   **plus the container cluster globals** (roles/grants — added by this drill).
3. Stages config/secrets to `/opt/backups/config/` (Supabase `.env`, app `.env`,
   Caddyfile, compose files, orangecat systemd units + `launch.sh`).
4. Pushes everything **encrypted off-box** via restic → `b2:orangecat-restic:bitbaum-pg`
   (creds + repo password in `/opt/backups/restic.env`, mode 600).

The drill restores **from the restic snapshot only** (never from the local originals) —
the point is proving the off-box path that survives disk loss.

---

## Drill procedure (exact commands, all on the box)

Everything runs on `bitbaum` (`ssh root@167.233.22.31`). **Nothing touches prod
containers or DBs** — the restore target is a throwaway container on port 5599.

### 1. Restore the latest snapshot from B2

```bash
set -a; . /opt/backups/restic.env; set +a
rm -rf /tmp/restore-drill && mkdir -p /tmp/restore-drill
restic snapshots --latest 3                       # sanity: snapshots exist, recent
time restic restore latest --target /tmp/restore-drill
```

Verify the critical artifacts are present in the restored tree:

```bash
D=/tmp/restore-drill/opt/backups
ls -lh $D/pg/supabase-postgres-*.dump | tail -1    # OrangeCat data (~1.7 MB)
ls -lh $D/pg/supabase-globals-*.sql.gz | tail -1   # container roles/grants
ls -lh $D/pg/supabase-_supabase-*.dump | tail -1
ls -lh $D/config/                                  # supabase.env, orangecat-app.env,
                                                   # Caddyfile, compose, systemd units
grep -cE '^(JWT_SECRET|ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD)=' $D/config/supabase.env  # → 4
```

### 2. Throwaway Postgres — same image as prod

Prod `supabase-db` runs `supabase/postgres:15.8.1.085`
(`docker inspect supabase-db --format '{{.Config.Image}}'`). A vanilla `postgres:15`
is **not** a valid target — it lacks the Supabase roles (`anon`, `authenticated`,
`service_role`, …) and extensions (`vector`, `pg_graphql`, …) the dump references.

```bash
docker run -d --name restore-drill-pg \
  -p 127.0.0.1:5599:5432 \
  -e POSTGRES_PASSWORD=drill-only-throwaway \
  supabase/postgres:15.8.1.085
sleep 15   # image init settles (pg_isready lies during the init temp-server phase)
```

Superuser in this image is `supabase_admin` (the `postgres` role is *not* super).

### 3. Apply container globals, then restore the dump

```bash
D=/tmp/restore-drill/opt/backups
STAMP=<stamp of the dumps you restored>

# 3a. Cluster globals (roles/grants). "already exists" NOTICEs are expected.
gunzip -c $D/pg/supabase-globals-$STAMP.sql.gz \
  | docker exec -i -e PGPASSWORD=drill-only-throwaway restore-drill-pg \
      psql -U supabase_admin -d postgres -q

# ⚠️ The globals include prod's role passwords — from here on, supabase_admin's
# password IS prod's. Read it from the restored config snapshot (this deliberately
# proves the config snapshot is a hard prerequisite):
PW=$(grep '^POSTGRES_PASSWORD=' $D/config/supabase.env | cut -d= -f2-)

# 3b. Restore OrangeCat (the container's `postgres` DB) into a fresh DB.
docker exec -e PGPASSWORD="$PW" restore-drill-pg \
  psql -U supabase_admin -d postgres -Atc 'create database drill_restore'
time docker exec -i -e PGPASSWORD="$PW" restore-drill-pg \
  pg_restore -U supabase_admin -d drill_restore \
  < $D/pg/supabase-postgres-$STAMP.dump 2>/tmp/pg_restore.err
grep -c '^pg_restore: error:' /tmp/pg_restore.err
```

**Expected error count: 1** — a `GRANT` on `graphql_public.graphql(...)`. That wrapper
function is created by the pg_graphql event-trigger machinery when the Supabase stack
boots, so it isn't in the dump and the grant on it fails in a bare cluster. Benign; in a
real DR you restore into a stack-initialized DB where it exists. **Any other error is a
drill failure — fix the pipeline and re-run.**

### 4. Verify against live

```bash
Q(){ docker exec -e PGPASSWORD="$PW" restore-drill-pg psql -U supabase_admin -d drill_restore -Atc "$1"; }
L(){ docker exec supabase-db psql -U postgres -d postgres -Atc "$1"; }

# table counts (public + all schemas)
Q "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
L "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'"
Q "select count(*) from pg_tables where schemaname not in ('pg_catalog','information_schema')"

# spot row counts
for t in actors ai_assistants timeline_events cat_credit_entries cat_credit_topups profiles; do
  echo "$t: $(Q "select count(*) from public.$t") vs $(L "select count(*) from public.$t")"
done
Q "select count(*) from auth.users"

# RLS + functions + pgvector
Q "select count(*) from pg_policies"
Q "select count(*) from pg_proc where proname='cat_credit_append'"   # → 1
Q "select count(*) from public.cat_memories"                          # pgvector data
```

Counts must match live exactly (modulo activity since 02:30 backup time).

### 5. Tear down

```bash
docker rm -f restore-drill-pg
rm -rf /tmp/restore-drill /tmp/pg_restore.err
docker exec supabase-db psql -U postgres -Atc 'select count(*) from public.actors'  # prod sanity
curl -s -o /dev/null -w '%{http_code}\n' https://orangecat.ch/api/health            # → 200
```

---

## Measured timings (2026-07-03, snapshot `90f71199`, 277 MiB)

| Step                                                    | Time      |
| ------------------------------------------------------- | --------- |
| `restic restore latest` from B2 (277 MiB, 262 files)    | **6.1 s** |
| Throwaway container start → accepting connections       | ~4 s (+15 s init settle) |
| Apply container globals                                 | 0.2 s     |
| `pg_restore` OrangeCat dump (1.7 MB, 2 661 TOC entries) | **6.1 s** |
| Verification queries                                    | ~10 s     |
| **Data-restore RTO (snapshot → queryable data)**        | **≈ 45 s** |
| Full backup pipeline run (`pg-backup.sh`, all 15 files + restic push) | 16.4 s |

**RPO:** ≤ 24 h (nightly 02:30 UTC). **Full-box DR RTO** is dominated not by data but
by rebuild steps (provision box, Supabase stack, app deploy, DNS/TLS) — estimated
**1–2 h** per `DISASTER_RECOVERY.md`; the data-restore leg is under a minute.

### Verification results (all ✅, exact match with prod)

| Check                          | Restored | Live |
| ------------------------------ | -------- | ---- |
| Tables (public schema)         | 115      | 115  |
| Tables (all non-system schemas)| 174      | 174  |
| `actors`                       | 51       | 51   |
| `ai_assistants`                | 6        | 6    |
| `timeline_events`              | 1 360    | 1 360 |
| `profiles`                     | 47       | 47   |
| `auth.users`                   | 45       | 45   |
| `cat_credit_entries` / `_topups` | 0 / 0  | 0 / 0 |
| `cat_memories` (pgvector)      | 16       | 16   |
| RLS policies (`pg_policies`)   | 325      | 325  |
| `cat_credit_append` function   | present  | present |

Config snapshot verified: `supabase.env` (JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY,
POSTGRES_PASSWORD), `orangecat-app.env`, `Caddyfile`, all `docker-compose*.yml`,
orangecat systemd units, `launch.sh` — the from-scratch prerequisites.

---

## Gaps found & fixed

Both fixed in `/opt/backups/pg-backup.sh` on the box on 2026-07-03 (pre-patch copy at
`/opt/backups/pg-backup.sh.bak-20260703`). ⚠️ The canonical script lives in the
**loki** Hetzner toolkit (`loki/scripts/hetzner/install-backups.sh`) —
sync these fixes there so a toolkit re-install doesn't revert them.

1. **Container cluster globals were never dumped.** `pg_dump` omits roles; the old
   script only ran `pg_dumpall --globals-only` against the *box-system* Postgres. First
   drill run hit 21 `role "supabase_realtime_admin" / "supabase_functions_admin" does
   not exist` errors. Fix: dump
   `docker exec supabase-db pg_dumpall -U supabase_admin --globals-only` →
   `supabase-globals-$STAMP.sql.gz`. Re-run: 21 errors → 1 (the benign graphql grant).

2. **App systemd units missing from the config snapshot.** `orangecat-app.service`,
   `orangecat-webhook-worker.service`/`.timer` and `/opt/orangecat/app/launch.sh` are
   required to boot the app on a fresh box but weren't staged. Fix: added to the
   `stage_cfg` list.

### Known residual risks (accepted, documented)

- **`/opt/backups/restic.env` is intentionally NOT in the backup** — it contains the
  restic encryption password; backing it up inside its own encrypted repo is useless.
  It must live in the founder's password manager. **Without it the off-site backup is
  unreadable — verify you have an off-box copy today.**
- The 1 expected `pg_restore` error (graphql grant) — see step 3 above.
- `_supabase` DB and box-system DBs restore the same way; this drill spot-restores only
  the OrangeCat DB (the crown jewels).

---

## Re-run checklist

- [ ] `restic snapshots --latest 1` is < 25 h old
- [ ] Steps 1–4 above, error count ≤ 1 (only the graphql grant)
- [ ] Row/policy counts match live
- [ ] Step 5 teardown, prod health 200
- [ ] Update the timings table + date in this doc
