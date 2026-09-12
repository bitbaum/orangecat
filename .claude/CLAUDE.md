# OrangeCat

@~/.claude/CLAUDE.md

---

## Mission & Vision

**Mission**: Enable anyone — any person, pseudonym, or organization — to participate in the full spectrum of economic and governance activity: exchanging, funding, lending, investing, and governing, with any counterparty, in any currency, without gatekeepers.

**Vision**: A world where economic participation is as open and uncensorable as speech. Where any identity — human, pseudonymous, or AI — can earn, fund, lend, invest, and govern freely. Where AI agents work on behalf of people and organizations to make this effortless, and where every economic relationship is structured, transparent where appropriate, and private where it matters.

**What OrangeCat is (one sentence)**: Your AI economic agent — and the platform where it operates.

### Core Principles (derive every product and engineering decision from these)

1. **The Cat is the interface** — "My Cat" is the primary AI agent for every user and group. Entities provide structured context the Cat reads and operates on. Build for the Cat first.
2. **Pseudonymous by default** — real identity is opt-in, never required. Any pseudonymous actor is a full economic participant.
3. **Any currency** — Bitcoin/Lightning is native and preferred, but any payment method — local or global (Twint, PayPal, Venmo, bank transfers, and regional fiat equivalents worldwide) — is a first-class citizen. Meet users where they are.
4. **Full economic spectrum** — from gift (no strings) to loan (some strings) to investment (more strings). All forms of value coordination belong on this platform.
5. **Private where needed, transparent where chosen** — the privacy goal (E2E-encrypted messaging and Nostr as the censorship-resistant layer) is on the roadmap, **not yet shipped**: direct messages are currently stored as plaintext (realtime, but server-readable). Bitcoin's on-chain transparency is available when appropriate. Do not describe messaging as encrypted until it actually is.
6. **Entities are the Cat's world model** — every entity type represents a form of economic or governance activity. The richer the entity structure, the smarter the Cat can be.

### Entity Economic Taxonomy

| Category               | Entities                  | Finance Type               |
| ---------------------- | ------------------------- | -------------------------- |
| Exchange               | product, service          | Market transaction         |
| Funding (no strings)   | cause, wishlist, research | Donation/gift              |
| Funding (soft strings) | project                   | Milestone accountability   |
| Lending                | loan                      | Repayment expected         |
| Investing              | investment                | Return/equity expected     |
| Assets                 | asset                     | Collateral, rental         |
| Governance             | group                     | Collective decisions       |
| AI services            | ai_assistant              | Automated economic actor   |
| Events                 | event                     | Time-bound coordination    |
| Cat context            | document                  | Structured context for Cat |

### What This Means for Development

- When adding features, ask: does this serve the Cat, or does it serve a human manually? Prefer both.
- Payment fields should support any payment method, not just Bitcoin addresses.
- "Wallet" is a subset of "payment methods" — a user may have Lightning, PayPal, and Twint all as valid receiving options.
- Messaging should be built with E2E encryption and Nostr integration in mind, even if not yet implemented.
- All entity types in the taxonomy are in the registry. When the Cat creates an entity, it uses the registry to find the API endpoint and schema.

---

## Overview

**OrangeCat** is an AI-native platform for universal economic and governance participation. The central product is "My Cat" — an AI agent that manages economic activity for each user and group, operating within a structured ecosystem of entities (products, services, projects, causes, loans, events, assets, groups, and more).

**Project Path**: `/home/g/dev/orangecat`

```bash
cd /home/g/dev/orangecat
pnpm run dev -p 3020  # Port 3020 to avoid conflicts
```

---

## Tech Stack

| Layer      | Technology                                       |
| ---------- | ------------------------------------------------ |
| Framework  | Next.js 16 (App Router), React 19                |
| Language   | TypeScript 6.x                                   |
| Styling    | Tailwind CSS 4                                   |
| Database   | Self-hosted Supabase (PostgreSQL + Auth + RLS)   |
| Bitcoin    | Lightning Network, BTCPay, NWC                   |
| Deployment | Self-hosted on Hetzner (`bitbaum`, behind Caddy) |

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   └── api/               # API routes (thin wrappers)
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── config/
│   └── entity-registry.ts # SSOT for all entities
├── domain/                # Business logic (no HTTP/UI)
├── lib/
│   ├── api/              # API middleware, responses
│   ├── bitcoin/          # Lightning, sats formatting
│   ├── supabase/         # Client creation
│   └── validation.ts     # Zod schemas
└── hooks/                 # Data fetching hooks
```

---

## Critical: Entity Registry Pattern

**SSOT Location**: `src/config/entity-registry.ts`

```typescript
// ALWAYS use registry, NEVER hardcode
const meta = ENTITY_REGISTRY[entityType];
const table = meta.tableName; // NOT 'user_products'
const path = meta.basePath; // NOT '/dashboard/store'
```

**Supported Entities** (see Entity Economic Taxonomy in Mission section above):

- `product` - Physical/digital goods (exchange)
- `service` - Professional services (exchange)
- `project` - Fundraising with accountability (soft-strings funding)
- `cause` - Charitable/no-strings funding
- `research` - Decentralized science funding
- `wishlist` - Gift registries
- `event` - Time-bound coordination
- `loan` - Peer-to-peer lending
- `asset` - Real estate, collateral, rentable assets
- `ai_assistant` - Autonomous AI economic actors
- `group` - Organizations with shared wallets and governance
- `circle` - Lighter community structures
- `document` - Structured context for the Cat
- `investment` - Equity/revenue-share investing

**Adding New Entity**:

1. Add to `src/config/entity-registry.ts`
2. Create schema in `src/lib/validation.ts`
3. Create database migration via MCP

---

## Critical: Bitcoin Rules

### Bitcoin amounts: BTC is the canonical unit

Store Bitcoin amounts as BTC using `NUMERIC`/`DECIMAL` in the database.

```typescript
// DB column: NUMERIC(18, 8)  — exact decimal, no float errors
// e.g., 0.001 BTC stored as 0.00100000
const price_btc = 0.001; // ✅ BTC is the canonical unit
```

**Display**: Show BTC by default, or the user's chosen currency (CHF default). Use `useDisplayCurrency()` hook in components.

### Payment Methods Are Universal

Bitcoin/Lightning is native and preferred, but the platform supports any payment method. Use `payment_methods` concepts (not just "wallet") where possible.

### Bitcoin Orange (#F7931A)

**ONLY for Bitcoin-related UI**:

- Bitcoin balance displays
- Lightning Network indicators
- Bitcoin icons

**NEVER for general UI elements**.

---

## Critical: Actor System

Everything is owned by an Actor (users AND groups have actors).

```typescript
// CORRECT - query by actor_id
const { data } = await supabase
  .from(meta.tableName)
  .select('*')
  .eq('actor_id', actorId);

// WRONG - don't query by user_id directly
.eq('user_id', userId);  // NO!
```

---

## Critical: Self-Hosted Supabase on Hetzner is the SSOT

The database is a **self-hosted Supabase instance on the Hetzner box (`bitbaum`),
reachable at `https://supabase.orangecat.ch`**. This is the single source of truth.

> ⚠️ **The managed Supabase Cloud project (`ohkueislstxomdjavyhs.supabase.co`) is
> RETIRED (2026-06).** Do NOT use it, and do NOT use the Supabase **MCP**
> (`mcp_supabase_*` / `mcp__claude_ai_Supabase__*`) — it only talks to the
> managed-cloud Management API, which no longer backs production. Any
> `mcp_supabase_*` examples elsewhere in `.claude/` have been replaced with the current mechanisms.

```bash
# Credentials live in .env.local (points at supabase.orangecat.ch).
NEXT_PUBLIC_SUPABASE_URL=https://supabase.orangecat.ch
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Do NOT spin up a separate local stack for normal work:
pnpm exec supabase start   # not the workflow
```

**To READ the DB**, go through PostgREST with the keys already in `.env.local`.
This works from an agent sandbox — it is plain HTTPS to `supabase.orangecat.ch`:

```bash
# Any table. Service-role key bypasses RLS, so treat results as privileged.
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/projects?select=id,title&limit=5"
```

Does a column exist? Ask for it — this answers from the schema, so it works on an
EMPTY table, unlike reading `Object.keys(rows[0])` (which reports every column as
missing when there are no rows):

```bash
# 200 = exists, 400 with code 42703 = no such column.
".../rest/v1/<table>?select=<column>&limit=0"
```

`POSTGRES_URL` in `.env.local` points at a local tunnel (`127.0.0.1:5433`) that is
normally NOT running, so `psql "$POSTGRES_URL"` fails from a sandbox. That is a
missing tunnel, not a missing permission. For DDL or anything PostgREST cannot
express, go through the box:

```bash
ssh ubuntu@167.233.22.31 \
  'docker exec supabase-db psql -U postgres -d postgres -c "\d+ projects"'
```

**Schema changes: write the migration and merge it. Do NOT apply it by hand.**
`scripts/deploy-selfhost.sh` runs `scripts/apply-migrations.sh` on every deploy,
which applies pending `supabase/migrations/*.sql` in filename order — each inside
a single transaction — and records them in `public.schema_migrations`. A failed
migration aborts the deploy and leaves the live release untouched. So the chain
is the same as for code: merge → CI → CD → applied.

> Corrected 2026-08-25. This section previously said the sandbox "generally cannot
> reach supabase.orangecat.ch" and that box-side DB work "goes through the founder
> / FleetCrown agent". Both were wrong and cost real time: reads work fine over
> PostgREST, and migrations apply themselves on deploy. Acting on the old text, an
> agent shipped a migration announcing it needed manual application — it had
> already been applied automatically eight minutes after merge.

Never reintroduce the managed-cloud project as a shortcut.

---

## API Pattern

**Thin API routes** - delegate to domain services:

```typescript
// app/api/products/route.ts
export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError('Unauthorized', 401);

  const body = await request.json();
  const commerce = new CommerceService(supabase);
  const product = await commerce.createProduct(body, actorId);

  return apiSuccess({ data: product }, 201);
}
```

---

## Design System

| Element | Value                            |
| ------- | -------------------------------- |
| Primary | Tiffany Blue `#0ABAB5`           |
| Accent  | Orange `#FF6B35`                 |
| Bitcoin | Orange `#F7931A` (Bitcoin-only!) |

---

## Protected Files

**Never modify without backup**:

- `.env.local` - credentials
- `supabase/migrations/*` - immutable once applied
- `src/config/entity-registry.ts` - requires full understanding

---

## Quick Reference

| File                         | Purpose               |
| ---------------------------- | --------------------- |
| `.claude/QUICK_REFERENCE.md` | Common operations     |
| `.claude/CREDENTIALS.md`     | Where credentials are |
| `.claude/rules/`             | All best practices    |

---

## Don't

- Hardcode entity names (use `ENTITY_REGISTRY`)
- Use any unit other than BTC for Bitcoin storage (always `NUMERIC(18,8)`)
- Bypass `useDisplayCurrency()` for amount display — always use it
- Use Bitcoin Orange for non-Bitcoin UI
- Query by `user_id` (use `actor_id`)
- Run local Supabase (use remote)
- Edit `.env.local` without backup

---

**Last Updated**: 2026-09-04
