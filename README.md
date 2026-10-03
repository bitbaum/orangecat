# OrangeCat

Your AI economic agent — and the platform where it operates.

[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Live](https://img.shields.io/badge/Live-orangecat.ch-orange.svg)](https://orangecat.ch)
[![Bitcoin](https://img.shields.io/badge/Bitcoin-Native-F7931A.svg)](https://bitcoin.org)

## The Problem

Economic participation still requires gatekeepers. To sell, fund, lend, invest, or govern collectively, you need banks, payment processors, platforms that take cuts and dictate terms. Pseudonymous participation is impossible. AI agents can't transact on your behalf.

## The Solution

OrangeCat is an AI-native platform for universal economic participation. The live wedge is a Bitcoin Lightning pay link. "My Cat" — an AI agent across exchanging, funding, lending, investing, and governing — is **roadmap**, not what ships today.

- **Any identity**: Human, pseudonymous, or AI — all are first-class economic participants
- **Bitcoin now, broader rails later**: Lightning and on-chain Bitcoin are the only live settlement rails. Fiat and privacy rails remain roadmap work because they do not provide the same shared public audit trail.
- **Full economic spectrum (roadmap beyond the pay link)**: From gifts (no strings) to loans (some strings) to investments (more strings)
- **Private where needed, transparent where chosen**: E2E encrypted messaging, on-chain transparency when appropriate

## What Works Today

- **Pay link (the wedge)**: every user gets `orangecat.ch/pay/<username>` for Bitcoin Lightning payments.
- **Live site**: [orangecat.ch](https://orangecat.ch)
- **Shipped surfaces**: product/service listings, groups, events, documents, and related entity types exist on the live site. Funding, lending, and investing sit on the roadmap.
- **Loki dogfood**: Loki (live at [loki.orangecat.ch](https://loki.orangecat.ch)) uses OrangeCat as a sibling product — typed stakeholder edges, shared BTC wallet, profiles as projects. Sibling-product integration: typed stakeholder edges, shared BTC wallet, profiles as projects.

## Roadmap

- **Funding**: account-free Bitcoin support for public projects
- **Lending**: peer-to-peer loans with repayment tracking
- **Investing**: investment flows beyond the pay-link wedge
- **The Cat**: AI agent that manages economic activity across the full spectrum

## Architecture

13 entity types, one registry. One ownership model (actors), one permission layer (database RLS). Adding a new entity type requires 2-3 files.

<details>
<summary><strong>Technical details</strong></summary>

### Entity Registry Pattern

`src/config/entity-registry.ts` — single source of truth for all 13 entity types. Drives CRUD, navigation, forms, and validation. No entity-specific switch statements.

### Actor System

Users and groups both have actors. All entities reference `actor_id`. One ownership model, one permission check — works for individuals, organizations, and (future) AI agents.

### Middleware Composition

```typescript
export default compose(withAuth(), withRateLimit('write'), withValidation(schema))(handler);
```

Functional composition replaces inheritance. Each middleware does one thing.

### Security

- Row Level Security (RLS) at the database level — bugs in app code can't bypass authorization
- Zod schemas as SSOT — TypeScript types derived from schemas, never separate
- Structured API responses across all 40+ routes

</details>

## Tech Stack

| Layer      | Technology                                                                               |
| ---------- | ---------------------------------------------------------------------------------------- |
| Framework  | Next.js 16.2, React 19, TypeScript 6                                                     |
| Styling    | Tailwind CSS, shadcn/ui                                                                  |
| Database   | Self-hosted Supabase (PostgreSQL + Auth + RLS) on Hetzner                                |
| Bitcoin    | Lightning Network, LNURL, bitcoinjs-lib                                                  |
| Auth       | Supabase Auth, JWT, Row Level Security                                                   |
| Deployment | Self-hosted on Hetzner (bitbaum, behind Caddy); GitHub Actions CI (gate only, no deploy) |

<details>
<summary><strong>Quick Start</strong></summary>

### Prerequisites

- Node.js 24 (see `.nvmrc`)
- A Supabase project (remote — no local Docker needed)

### Setup

```bash
git clone https://github.com/bitbaum/orangecat.git
cd orangecat
pnpm install
cp .env.example .env.local
# Fill in Supabase credentials
pnpm run dev
```

Dev server starts at `http://localhost:3000`.

### Environment Variables

See `.env.example` for the full list. Key variables:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` — Server-side Supabase key

</details>

## Run your own copy

OrangeCat is MIT. Everything a copy needs is in this repository; nothing points
at bitbaum's infrastructure that an environment variable cannot repoint.

- **Database and auth**: a [Supabase](https://supabase.com) project — the free
  tier works — or the self-hosted Supabase stack ([supabase/docker](https://github.com/supabase/supabase/tree/master/docker)).
  Point `NEXT_PUBLIC_SUPABASE_URL` and the keys at it; the schema is
  `supabase/migrations/*.sql`, applied in filename order (`scripts/apply-migrations.sh`).
- **Your hostname**: set `NEXT_PUBLIC_APP_URL`. Sitemap, robots, SEO
  metadata, structured data, emails and the OpenAPI document all build on it
  (`src/config/site-origin.ts`); `https://orangecat.ch` is only the fallback.
- **Sibling products are optional**: Loki, Solon and the feedback widget are
  reached through `NEXT_PUBLIC_LOKI_URL` / `NEXT_PUBLIC_SOLON_URL` and are
  simply absent when their keys are unset.
- **The contract is `.env.example`**: every variable `src/` reads is named
  there with the file that reads it, and `__tests__/unit/ci/env-example-covers-src.test.ts`
  fails CI when one is not. A feature whose key is empty is off, not broken.
- **Deploy anywhere Node 24 runs**: `pnpm run build && pnpm start`. The
  Hetzner scripts under `scripts/` are how bitbaum deploys, not a requirement.

The OrangeCat name and visual identity are not part of the licence; a copy
should carry its own.

## Project Structure

```
src/
  config/entity-registry.ts  -- SSOT: all 13 entity types
  lib/api/                    -- Middleware composition, generic CRUD
  domain/                     -- Business logic (no HTTP, no UI)
  services/                   -- Currency, search, notifications, groups
  features/                   -- Messaging, auth
  app/api/                    -- API routes (thin, composed from middleware)
  components/                 -- UI components (shadcn/ui based)
```

## Testing

2648 unit tests across 282 files (CI as of 2026-09-02). Pre-push hooks run type-check, lint, and the full test suite before any code reaches the remote.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

MIT. See [LICENSE](LICENSE). The OrangeCat name and visual identity are not covered by it.
