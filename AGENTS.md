# AGENTS.md

Operational guide for any coding agent working in this repo. Claude Code users:
`CLAUDE.md` is the fuller source of truth — this file mirrors its key facts.

## What this is

**OrangeCat** — an AI-native platform for universal economic and governance
participation ("My Cat" AI agent: earn, fund, lend, invest, govern in any
currency). Bitcoin/Lightning native.

## Stack

| Layer      | Technology                                                              |
| ---------- | ----------------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router), TypeScript 5.8                                 |
| Styling    | Tailwind CSS 3.3 (tokens are CSS vars in `src/app/globals.css`)         |
| Database   | Self-hosted Supabase (Postgres + Auth + RLS) at `supabase.orangecat.ch` |
| Bitcoin    | Lightning Network, BTCPay, NWC                                          |
| Deployment | Self-hosted on Hetzner (`bitbaum`, behind Caddy) — no Vercel            |

## Run it

```bash
npm ci                 # install
npm run dev -- -p 3020 # dev server on :3020 (avoids conflicts)
```

## Verify before you commit (single source of truth)

```bash
npm run verify
```

`verify` is the ONE gate. It runs, in order: `ci:docs` → `type-check` →
`audit:routes` → `lint` → `test:unit`. CI (`.github/workflows/ci.yml`,
`build-and-smoke` job) calls `npm run verify` verbatim, so green locally ⇒ green
CI. Add or remove a check in the `verify` script only — never re-list checks
inline in the workflow. (E2E/Playwright is a separate post-build gate; it needs a
running server + secrets and is not part of `verify`.)

## Database & migrations

- SSOT is the self-hosted Supabase on Hetzner (`supabase.orangecat.ch`). The
  managed Supabase Cloud project is **retired** — do NOT use it or the Supabase MCP.
- Migrations live in `supabase/migrations/*.sql`. **Immutable once applied** —
  never edit an existing one; always add a new file. Migrations are the schema SSOT.

## Deploy path

`main` → CI (`ci.yml`) must go green → CD (`cd.yml`) ships the exact CI-built
standalone artifact to `bitbaum` via `scripts/deploy-selfhost.sh` (atomic swap +
rollback). CD is dormant until `SELFHOST_SSH_KEY` is set. No Vercel.

## Core conventions (don't fight these)

- **Entity registry is SSOT**: `src/config/entity-registry.ts`. Never hardcode
  table names, API paths, or entity labels — read them from the registry.
- **Actor ownership**: query by `actor_id`, never `user_id` directly.
- **Bitcoin**: store amounts as BTC in `NUMERIC(18,8)` (never integer sats).
  Display via the `useDisplayCurrency()` hook (CHF default).
- **Design tokens**: CSS custom properties in `src/app/globals.css` are the only
  SSOT for color/radius/shadow. No hardcoded hex in components or Tailwind config.
- **Layering**: `config/` (what exists) → `domain/` (business logic, no HTTP/UI)
  → `app/api/` (thin HTTP) → `components/` (UI) → `hooks/` (data fetching).

## Protected files (back up before touching)

`.env.local`, `supabase/migrations/*`, `src/config/entity-registry.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
