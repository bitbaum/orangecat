# OrangeCat Media on Cloudflare R2 (Supabase Storage backend = s3)

**Status:** ✅ LIVE since 2026-06-19. OC's self-hosted Supabase Storage (`supabase-storage`,
v1.60.4 on bitbaum) stores all media in the R2 bucket `orangecat-media`. Verified read +
write end-to-end. This doc is the deployed record + maintenance/rollback/rotation runbook.

---

## What this is

OC stores media through the Supabase Storage API (`supabase.storage.from(...)`): avatars,
banners, project-media, proofs, documents, project-files. We repointed the storage **backend**
from the box's local disk to **Cloudflare R2**. No app code changed; no DB rewrite. Public
URLs (`…/storage/v1/object/public/<bucket>/<path>`) are unchanged — they're served _through_
storage-api, which now reads from R2. Existing DB URLs stayed valid.

## Key facts verified from the live box

- **storage-api version:** `supabase/storage-api:v1.60.4`.
- **Compose project:** `supabase`, single file `/opt/supabase/docker/docker-compose.yml`
  (`/opt/supabase/docker/docker-compose.override.yml` is NOT loaded — don't put changes there).
- **Object key layout:** `{TENANT_ID}/{bucket}/{object}` → with `TENANT_ID=stub`, keys are
  `stub/avatars/…`, `stub/project-media/…`, etc. **TENANT_ID must stay `stub`.**
- **On-disk source path** (host): `/opt/supabase/docker/volumes/storage/stub/` — its contents
  are already `stub/<bucket>/…`, i.e. exactly the R2 keys. ⚠️ The file backend stores at
  `{root}/{GLOBAL_S3_BUCKET=stub}/{key}` = `…/volumes/storage/stub/stub/<bucket>/…`; the first
  `stub` is the _container_ (becomes the R2 bucket), so you migrate from `…/storage/stub/`,
  **not** the whole volume (copying the whole volume would create `stub/stub/…` keys and 404
  everything — the trap this migration avoided).
- **Credentials:** the s3 adapter uses the AWS default chain → `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY` (NOT `S3_PROTOCOL_*`, which is a separate inbound-S3 feature).

## Deployed config

`/opt/supabase/docker/docker-compose.yml` (storage service env):

```yaml
STORAGE_BACKEND: s3
GLOBAL_S3_BUCKET: ${GLOBAL_S3_BUCKET}
GLOBAL_S3_ENDPOINT: ${GLOBAL_S3_ENDPOINT}
GLOBAL_S3_PROTOCOL: https
GLOBAL_S3_FORCE_PATH_STYLE: 'true'
STORAGE_S3_DISABLE_CHECKSUM: 'true' # REQUIRED for R2: AWS SDK v3 CRC32 checksums → R2 400 on PUT
AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
AWS_REGION: ${REGION}
TUS_ALLOW_S3_TAGS: 'false' # R2 has no object tagging → resumable uploads 400 without this
TENANT_ID: ${STORAGE_TENANT_ID} # = stub, unchanged
```

`/opt/supabase/docker/.env`:

```bash
GLOBAL_S3_BUCKET=orangecat-media
REGION=auto
GLOBAL_S3_ENDPOINT=https://178075e50b3ec2da9b7166550844ccd5.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<shared R2 access key id>      # same account token as RevampIT
AWS_SECRET_ACCESS_KEY=<shared R2 secret>
# STORAGE_TENANT_ID=stub (unchanged)
```

Backups left on box: `docker-compose.yml.bak.r2`, `.env.bak.r2`.

## How it was migrated (35 objects / ~15 MB)

```bash
# data copy (verbatim keys), via the rclone docker image — no host install:
docker run --rm -v /opt/supabase/docker/volumes/storage/stub:/data:ro rclone/rclone \
  copy /data ":s3:orangecat-media/" \
  --s3-provider Cloudflare --s3-access-key-id <AKID> --s3-secret-access-key <SECRET> \
  --s3-endpoint https://178075e50b3ec2da9b7166550844ccd5.r2.cloudflarestorage.com \
  --s3-region auto --s3-no-check-bucket
# apply env change + recreate ONLY storage:
docker compose -p supabase -f docker-compose.yml up -d --no-deps storage
```

Original disk data is **retained** under `/opt/supabase/docker/volumes/storage/` as a backup.

## Verify

```bash
docker exec supabase-storage env | grep STORAGE_BACKEND        # => s3
# existing migrated object (public bucket):
curl -I "https://supabase.orangecat.ch/storage/v1/object/public/avatars/<owner>/<file>"  # 200
# write test: upload a real IMAGE (avatars/banners enforce image MIME — text/plain is rejected):
curl -X POST ".../storage/v1/object/avatars/_check.png" -H "Authorization: Bearer $SERVICE_KEY" \
     -H "Content-Type: image/png" --data-binary @pixel.png   # 200, then DELETE it
```

## Rollback (disk data still present)

```bash
cd /opt/supabase/docker
cp -a docker-compose.yml.bak.r2 docker-compose.yml && cp -a .env.bak.r2 .env
docker compose -p supabase -f docker-compose.yml up -d --no-deps storage
```

Objects uploaded while on R2 won't be on disk — rclone them back first if rolling back later.

## ⚠️ Token rotation coupling (shared token)

OC, RevampIT (and any future R2 consumer) share ONE account-wide R2 token (key id
`d8efe1b3…`). **Rolling that token's secret means updating every consumer:**

- RevampIT: `/opt/revampit/app/.env` → `S3_SECRET_ACCESS_KEY`, then `docker compose -f docker-compose.prod.yml up -d app`.
- OrangeCat: `/opt/supabase/docker/.env` → `AWS_SECRET_ACCESS_KEY`, then
  `docker compose -p supabase -f docker-compose.yml up -d --no-deps storage`.

## Follow-ups (optional)

- **Backup R2** (`orangecat-media`) off-site (B2 / R2 versioning) — R2 is durable but currently
  single-copy. Pairs with the box-backup gap.
- Migrate to a least-privilege per-bucket token later if multiple owners ever need isolation.
