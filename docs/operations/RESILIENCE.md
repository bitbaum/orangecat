# OrangeCat resilience runbook

**Purpose:** proactive resilience for the single-box self-host — the gaps the 2026-07-07
DevOps audit flagged that need box-side action. Complements the recovery-side docs
([`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md), [`RESTORE_DRILL.md`](./RESTORE_DRILL.md)):
those cover _restoring_ after loss; this covers _reducing the blast radius and the manual
recovery time up front_.

Box: `bitbaum` — `root@167.233.22.31`. OrangeCat lives at `/opt/orangecat/app`, runs as
systemd `orangecat-app` behind Caddy, DB in the `supabase-db` Docker container.

---

## 1. Single-box SPOF → scripted bring-up + published RTO

Today a full box loss means manually provisioning a new Hetzner box before the (fast) data
restore can run — the RTO is dominated by that manual setup, not the restore.

**Reduce it:** keep the box's OrangeCat footprint reproducible so step 1 of DR is a script,
not archaeology. The OC-specific pieces are now version-controlled:

- App systemd unit → [`scripts/systemd/orangecat-app.service`](../../scripts/systemd/orangecat-app.service)
- App launcher → [`scripts/systemd/launch.sh`](../../scripts/systemd/launch.sh)

**Fresh-box OrangeCat bring-up (after Docker + Supabase stack + Caddy exist):**

1. Restore the DB (see `DISASTER_RECOVERY.md`).
2. Create the app dir and drop in the runtime env:
   ```bash
   ssh root@<newbox> 'mkdir -p /opt/orangecat/app'
   scp /path/to/orangecat-app.env root@<newbox>:/opt/orangecat/app/.env   # from the config backup
   ```
3. Install the unit + launcher and deploy the app:
   ```bash
   scp scripts/systemd/orangecat-app.service root@<newbox>:/etc/systemd/system/
   ssh root@<newbox> 'systemctl daemon-reload'
   OC_BOX=root@<newbox> bash scripts/deploy-selfhost.sh     # builds off-box + swaps in
   ```
4. Add the Caddy vhost for `orangecat.ch` (the deploy re-asserts the HTTP/3 guards).
5. `curl https://orangecat.ch/api/health` → expect `"status":"healthy"`.

> **Publish the measured RTO** in `DISASTER_RECOVERY.md` after the next drill so it's a
> known number, not a surprise. Consider a cheap warm-standby VM restoring the nightly B2
> snapshot if the RTO target drops below the manual-provision time.

**Full box IaC** (cloud-init/Ansible for Docker + Supabase + Caddy) belongs in the shared
`loki/scripts/hetzner/` toolkit — coordinate there rather than forking box-wide
provisioning into this repo.

---

## 2. Off-site backups are deletable → B2 Object-Lock

`pg-backup.sh` pushes encrypted restic snapshots to Backblaze B2 nightly, but the box holds
the B2 key, so a box compromise (or a buggy `restic forget`) could delete the only off-site
copy. Make the bucket append-only from the box's perspective.

1. In the B2 console, enable **Object Lock** on the backup bucket (must be set at/near bucket
   creation for some plans — if the current bucket can't enable it, create a new locked
   bucket and re-point `restic.env`).
2. Issue a **restricted application key** for the box that can write + read but **not delete**
   (uncheck `deleteFiles`); put it in `/opt/backups/restic.env`.
3. Run retention (`restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune`)
   from a **separate** trusted host with a delete-capable key on a schedule — never from the
   box.
4. Keep **≥2 copies of `RESTIC_PASSWORD`** (password manager + one offline). Losing it makes
   every snapshot unrecoverable.

---

## 3. Deploy credential is root → non-root `oc-deploy` user

CD SSHes in as `root`. Scope it down so a leaked deploy key can't own the box.

1. Create the user and app ownership (app already runs as `ubuntu`):
   ```bash
   ssh root@167.233.22.31 'useradd -m -s /bin/bash oc-deploy && \
     install -d -o oc-deploy -g oc-deploy -m 700 /home/oc-deploy/.ssh'
   ```
2. Add the deploy public key to `/home/oc-deploy/.ssh/authorized_keys`.
3. Grant only the specific privileged commands the deploy needs via a sudoers drop-in
   (`/etc/sudoers.d/oc-deploy`): `systemctl restart orangecat-app`, the `mv`/`chown` in the
   swap, and the `docker exec supabase-db psql` used by `apply-migrations.sh`. Validate with
   `visudo -c`.
4. Point CD at it: set the repo variable `OC_BOX=oc-deploy@167.233.22.31` and rotate
   `SELFHOST_SSH_KEY` to the new key. Update the `deploy-selfhost.sh` `sudo`/`chown` steps if
   any assumed root.
5. Rotate the deploy key on a schedule.

---

## 4. Backup pipeline dependency (know what you depend on)

`pg-backup.sh` + `pg-backup.timer` are installed by the **loki** Hetzner toolkit
(`scripts/hetzner/install-backups.sh`), not this repo — so OC's durability is governed by
code OC doesn't version-control. Two must-holds, verified at each drill:

- The dump covers the **`supabase-db` container** DB (`docker exec supabase-db pg_dump`), not
  just the box-system Postgres — OrangeCat's data lives in the container. (This was the
  original "zero backups" bug; the fix must stay in loki's `install-backups.sh` or it
  reverts on reinstall.)
- Backup freshness is now monitored: `/api/health` reports `last_backup_age_hours` and
  `.github/workflows/uptime.yml` opens a `backup-stale` issue past 26h. Confirm the app user
  can read `/opt/backups/pg` (it currently reports a real age, so it can).

---

_Last updated: 2026-07-07 (DevOps overhaul). Owner actions above are box-side; the repo
holds the SSOT artifacts and this runbook._
