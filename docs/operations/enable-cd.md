# Enabling / operating CD (auto-deploy to bitbaum)

OrangeCat's `main` is CI-gated but deploys via `.github/workflows/cd.yml`, which
stays **dormant until `SELFHOST_SSH_KEY` exists**. Once the secrets below are
set and the deploy key is authorized on the box, **every merge to `main` that
passes CI auto-deploys** (atomic swap + boot-test + auto-rollback — a bad build
can't take the site down; worst case it stays on the current version).

## One-time setup

### Required repo secrets (`Settings → Secrets and variables → Actions`)

`https://github.com/bitbaum/orangecat/settings/secrets/actions`

| Secret                                 | Value                                            |
| -------------------------------------- | ------------------------------------------------ |
| `SELFHOST_SSH_KEY`                     | private half of a dedicated ed25519 deploy key   |
| `SELFHOST_KNOWN_HOSTS`                 | `ssh-keyscan -H 167.233.22.31` output (host pin) |
| `NEXT_PUBLIC_SUPABASE_URL`             | `https://supabase.orangecat.ch` (baked at build) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | from `.env.local` (public client key)            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from `.env.local` (public)                       |

Optional repo **variables** (`vars.*`): `OC_BOX` (default `root@167.233.22.31`),
`NEXT_PUBLIC_LIGHTNING_ADDRESS`, `NEXT_PUBLIC_BITCOIN_ADDRESS`.

### Generate + install the deploy key

```bash
# 1. generate a dedicated key
ssh-keygen -t ed25519 -C "orangecat-cd-deploy" -f ~/.ssh/orangecat_cd -N ""

# 2. store the PRIVATE half as the secret (file -> gh, never echoed)
gh secret set SELFHOST_SSH_KEY -R bitbaum/orangecat < ~/.ssh/orangecat_cd
ssh-keyscan -H 167.233.22.31 2>/dev/null | gh secret set SELFHOST_KNOWN_HOSTS -R bitbaum/orangecat

# 3. authorize the PUBLIC half on the box (security change — do this deliberately)
ssh-copy-id -i ~/.ssh/orangecat_cd.pub root@167.233.22.31
#   or: cat ~/.ssh/orangecat_cd.pub | ssh root@167.233.22.31 'cat >> ~/.ssh/authorized_keys'
```

### Set the public build values

```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL -R bitbaum/orangecat -b "https://supabase.orangecat.ch"
grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY='        .env.local | cut -d= -f2- | tr -d '"' | gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY        -R bitbaum/orangecat
grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env.local | cut -d= -f2- | tr -d '"' | gh secret set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY -R bitbaum/orangecat
```

## Deploy now / verify

```bash
gh workflow run cd.yml -R bitbaum/orangecat        # deploy current main
gh run watch "$(gh run list -R bitbaum/orangecat --workflow cd.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
curl -fsS https://orangecat.ch/api/health && echo "  ✓ live"
```

## After setup

- Nothing to do — merge to `main` → CI passes → CD deploys automatically.
- **Check if it's live:** the CD run's log; `curl https://orangecat.ch/api/health`.
- **CD dormant again?** `SELFHOST_SSH_KEY` was removed — the run logs `"CD is dormant"`.
- **Rotate the key:** regenerate, re-`gh secret set SELFHOST_SSH_KEY`, re-authorize on the box, and remove the old line from the box's `~/.ssh/authorized_keys`.

See also `docs/operations/oauth-social-login.md` for the analogous config-not-code
pattern on social login.
