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
7. **The product fits the person** — anything a user dislikes, they can point at and choose "change it for me" or "show me how to get there". Loki (embedded widget, `window.Loki.report({ target, intent })`) builds that experience, or shows the path and makes it findable. Tailored experiences for each person are the long-run direction. New surfaces carry `data-loki-target`, and where it earns the space a `ChangeThisLink` (`src/components/feedback/ChangeThisLink.tsx`). The direction, and what is and isn't shipped, is SSOT in bitbaum/loki `docs/architecture/tailored-experience.md`.

### What an entity IS

**An entity is anything that can hold a wallet and is better for holding one.**

That is the whole definition, and it is deliberately a TEST rather than a list.
The list is open in principle: a new type earns its place by answering the
test, not by taste and not by resembling the types already there.

Each entity sits on three planes, and the wallet is only the first:

| Plane      | Product       | What it means for the entity              |
| ---------- | ------------- | ----------------------------------------- |
| Economy    | **OrangeCat** | it can hold, receive and send value       |
| Governance | **Solon**     | its decisions can be put to a signed vote |
| Execution  | **Loki**      | it can be worked on, built and shipped    |

This plane was called "Engineering" until 2026-09-20. That named Loki's
deepest capability rather than the product: Loki is where an operator's work
gets done, and building software is the largest part of that but not the whole
of it — the people, commitments and spending the work runs on live there too.
The narrow label made those read as scope creep and produced a recurring
proposal to move them onto the Cat, which has no such surfaces and never has.
The one-word role is SSOT in `src/config/ecosystem.ts` → `ECOSYSTEM_PILLARS`;
this table follows it.

What actually separates the three is AUDIENCE, not category — the same thing
the pillar config means by different security boundaries. OrangeCat is public
by design, Loki is private by default, Solon is shared with its members. Work
crosses a boundary when it needs to be seen, paid, or decided on, which is why
a Loki crew assignment mirrors here as a service only once it is paid.

**The list itself has exactly one producer: `src/config/entity-registry.ts`.**
Every type there carries `wallet: { holds, why }` — the admission test answered
in the owner's terms, naming the money that actually moves — and
`__tests__/unit/config/entity-admission.test.ts` enforces it. Do not restate
the list in any doc; point here instead. The copy that used to sit in
`.claude/rules/domain-specific.md` named `organization`, which has never been a
type, and omitted six that are.

Two types are deliberate exceptions, pinned by that test as a ratchet that may
shrink and may never grow: `wallet` (it IS the primitive the test is written
against) and `document` (context the Cat reads — it receives nothing and owes
nothing).

### What This Means for Development

- When adding features, ask: does this serve the Cat, or does it serve a human manually? Prefer both.
- When adding a surface, ask: can a person who dislikes it point at it and have it changed? (Principle 7.)
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

**Supported Entities**: read `ENTITY_TYPES` in `src/config/entity-registry.ts`.

This was the THIRD copy of that list in the agent-read docs, and like the other
two it had drifted — it omitted `wallet`. Each entry in the registry carries
its own one-line `wallet.why`, which is a better description than any of these
copies were, and it cannot go stale because it sits next to the thing it
describes. See "What an entity IS" above for the test a new type must pass.

**Adding New Entity**:

1. Add to `src/config/entity-registry.ts`
2. Create schema in `src/lib/validation.ts`
3. Add a migration file under `supabase/migrations/` — the deploy applies it
   (see "Self-Hosted Supabase" below). Never apply it by hand, and never via the
   retired Supabase MCP.

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
> `mcp_supabase_*` example elsewhere in `.claude/` is a bug, and
> `__tests__/unit/ci/agent-instructions.test.ts` fails on one. That sentence used
> to read "have been replaced with the current mechanisms" — a claim, made while
> three command scripts still printed ten of them. A gate says it; prose cannot.

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
> / Loki agent". Both were wrong and cost real time: reads work fine over
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
