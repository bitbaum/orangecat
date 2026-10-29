# AGENTS.md

<!-- fleet:rules:begin — generated from bitbaum/fleet templates/agent-rules.md; edit it there, not here -->

## Org rules

Read `bitbaum/fleet` `AGENTS.md`, `SHARED.md` and the registers it names before
inventing a host, a name, a page or a shared behaviour. Do not copy their facts
into this file.

- **Packages first.** If a `@bitbaum/*` package (or `bip-kit`, `limitkit`,
  `threadkit`, `ai-forms`) already does it, use it and fix a defect in the
  package, not in this app. Every chat is `@bitbaum/chatkit`, every search box
  `@bitbaum/searchkit`, every chart `@bitbaum/chartkit`, accounts
  `@bitbaum/accountkit`, model calls `@bitbaum/ai-kit`. Review this product's
  `package-plan.json` before building anything.
- **One shape per kind.** Things of the same kind look the same and sit in the
  same place (fleet `AGENTS.md`, "One shape per kind").
- **Finished work ships by itself.** Open a non-draft pull request; the fleet
  auto-merge sweep is the only merge path. Never merge by hand, through the
  merge API, with `--auto` or with an admin bypass, and never force-push a
  shared branch.
- **Nothing made up.** A fact on a page or in a doc needs a source that was
  opened; where there is none, the line is removed or softened.
- **Bitcoin orange is for Bitcoin and top-of-funnel actions only.**
- **No model identifier** in anything pushed to a repository.
- Before you finish, run `node <fleet>/scripts/ci/docs-truth-audit.mjs --dir .`:
  the same check the sweep runs on every pull request.

<!-- fleet:rules:end -->

Operational guide for any coding agent working in this repo. `CLAUDE.md` points
here; this file is the source.

## What this is

**OrangeCat** — an AI-native platform for universal economic and governance
participation ("My Cat" AI agent: earn, fund, lend, invest, govern in any
currency). Bitcoin/Lightning native. In one sentence: your AI economic agent,
and the platform where it operates.

Loki is a live customer here (a typed "customer" stakeholder edge and a shared
BTC wallet): changes to stakeholder relationships or project profiles change
Loki's experience and every later customer's.

## Principles

1. **The Cat is the interface.** "My Cat" is every user's and group's primary
   agent; entities are the structured context it reads and acts on. Ask of a
   feature: does it serve the Cat, a human by hand, or both? Prefer both.
2. **Pseudonymous by default.** Real identity is opt-in; any pseudonymous actor
   is a full economic participant.
3. **Any currency.** Bitcoin/Lightning is native and preferred; Twint, PayPal,
   bank transfer and regional rails are first-class. Payment fields support any
   method — a wallet is one kind of payment method. The rails are SSOT in
   `src/config/payment-methods.ts`, built on identity, custody and reach
   (`docs/architecture/MONEY_RAILS.md`); listing a fiat rail is the opt-in to
   real identity, and a handle can be `on_request` instead of printed.
4. **The full economic spectrum** — gift, loan, investment — belongs here.
5. **Private where needed, transparent where chosen.** E2E-encrypted messaging
   and Nostr are on the roadmap, **not shipped**: direct messages are stored as
   plaintext today. Never describe messaging as encrypted until it is; build it
   with encryption and Nostr in mind.
6. **Entities are the Cat's world model.**

## What an entity is

**An entity is anything that can hold a wallet and is better for holding one** —
a test, not a list. Each sits on three planes, whose one-word roles are SSOT in
`src/config/ecosystem.ts` → `ECOSYSTEM_PILLARS`: economy (OrangeCat — hold,
receive, send value), governance (Solon — decisions put to a signed vote) and
execution (Loki — worked on, built, shipped). What separates them is audience:
OrangeCat is public by design, Loki private by default, Solon shared with its
members; work crosses when it needs to be seen, paid or decided on.

The list has one producer: `ENTITY_TYPES` in `src/config/entity-registry.ts`.
Every type carries `wallet: { holds, why }`, the admission test answered in the
owner's terms, enforced by `__tests__/unit/config/entity-admission.test.ts`.
`wallet` and `document` are the two pinned exceptions (a ratchet that may shrink,
never grow). Never copy the list into a doc.

## Stack

| Layer      | Technology                                                              |
| ---------- | ----------------------------------------------------------------------- |
| Framework  | Next.js 16 (App Router), React 19, TypeScript 6                         |
| Styling    | Tailwind CSS 4 (tokens are CSS vars in `src/app/globals.css`)           |
| Database   | Self-hosted Supabase (Postgres + Auth + RLS) at `supabase.orangecat.ch` |
| Bitcoin    | Lightning Network, BTCPay, NWC                                          |
| Deployment | Self-hosted on Hetzner (`bitbaum`, behind Caddy) — no Vercel            |

## Run it

```bash
pnpm install --frozen-lockfile # install (pnpm only — never write a package-lock.json)
pnpm run dev -p 3020           # dev server on :3020 (avoids conflicts)
```

## Verify before you commit (single source of truth)

```bash
pnpm run verify
```

`verify` is the ONE gate. `scripts/verify.mjs` is the list of what it runs
(type-check, lint, `audit:routes`, `test:unit` and the `check:*` guards, in
parallel lanes) — read it there rather than a copy. CI
(`.github/workflows/ci.yml`, `build-and-smoke` job) calls `pnpm run verify`
verbatim, so green locally ⇒ green CI. Add or remove a check in the `verify` script only — never re-list checks
inline in the workflow. (E2E/Playwright is a separate post-build gate; it needs a
running server + secrets and is not part of `verify`.)

## Database & migrations

- SSOT is the self-hosted Supabase on Hetzner (`supabase.orangecat.ch`). The
  managed Supabase Cloud project is **retired** — do NOT use it or the Supabase MCP.
- Migrations live in `supabase/migrations/*.sql`. **Immutable once applied** —
  never edit an existing one; always add a new file. Migrations are the schema SSOT.
- **Schema changes: write the migration and merge it; never apply it by hand.**
  `scripts/deploy-selfhost.sh` runs `scripts/apply-migrations.sh` on every
  deploy, applying pending files in filename order, each in one transaction,
  recorded in `public.schema_migrations`; a failed one aborts the deploy and
  leaves the live release untouched.
- **Read** through PostgREST with the keys in `.env.local` (plain HTTPS, works
  from a sandbox; the service-role key bypasses RLS, so treat results as
  privileged):

  ```bash
  curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
       -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
       "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/projects?select=id,title&limit=5"
  ```

  Ask for a column to learn whether it exists, even on an empty table:
  `…/rest/v1/<table>?select=<column>&limit=0` → 200, or 400 with code 42703.

- `POSTGRES_URL` points at a local tunnel (`127.0.0.1:5433`) that is normally
  not running — a failure there is a missing tunnel, not a missing permission.
  For DDL or anything PostgREST cannot express, go through the box:
  `ssh ubuntu@167.233.22.31 'docker exec supabase-db psql -U postgres -d postgres -c "\d+ projects"'`.
- Do not run a local Supabase stack (`supabase start`) for normal work.
  `__tests__/unit/ci/agent-instructions.test.ts` fails if anything under
  `.claude/` demonstrates the retired MCP or drives the repo with npm.

## Deploy path

Nobody merges by hand: a green, non-draft PR is squash-merged by
`.github/workflows/auto-merge.yml` (the fleet sweep in `bitbaum/fleet`,
`scripts/ci/auto-merge-sweep.sh`). Then `main` → CI (`ci.yml`) must go green →
its `post-main` job dispatches CD (`cd.yml`), which ships the exact CI-built
standalone artifact to `bitbaum` via `scripts/deploy-selfhost.sh` (atomic swap +
rollback; pending `supabase/migrations/*.sql` are applied on the way). CD stays a
no-op if the `SELFHOST_SSH_KEY` secret is missing. No Vercel. Hold work back
with a draft PR or a `hold` label.

Finished work ships without asking: the owner checks results on the live site
and does not read GitHub. When asked work is done and verified, open a non-draft
PR, stay on it until it is deployed, and give the owner the live URL. Ask the
owner about the product, never about git, and offer options rather than an open
question.

**Two hand-offs keep the chain alive; never remove either.** Both exist because
the sweep falls back to `GITHUB_TOKEN` when `FLEET_PAT` is absent, and a
`GITHUB_TOKEN` push triggers no workflow:

1. The CI re-arm (`rearm_workflows: 'ci.yml'` in `auto-merge.yml`) dispatches CI
   on `main` after a merge; the sweep also reconciles deployment
   (`deploy_workflow: cd.yml`), dispatching CD when `main`'s tip differs from the
   last successful run.
2. The `post-main` job in `ci.yml` files or closes the red-main issue
   (`scripts/ci/main-red-alert.sh`) and dispatches CD with this run's id and SHA
   (`scripts/ci/arm-cd.sh`), failing if no CD run appears — because a
   `GITHUB_TOKEN`-created run fires no `workflow_run` either.

Drop either and CI is green while nothing deploys: on 2026-08-04 that stranded
14 verified commits for eight hours.

## Core conventions (don't fight these)

- **Entity registry is SSOT**: `src/config/entity-registry.ts`. Never hardcode
  table names, API paths, or entity labels — read them from the registry
  (`ENTITY_REGISTRY[type].tableName`, `.basePath`). A new entity is a registry
  entry, a schema in `src/lib/validation/`, and a migration file.
- **Actor ownership**: everything is owned by an actor (users and groups both
  have one); query by `actor_id`, never `user_id` directly.
- **Bitcoin**: store amounts as BTC in `NUMERIC(18,8)` (never integer sats).
  Display via the `useDisplayCurrency()` hook (CHF default) — never bypass it.
- **API routes are thin**: authenticate, validate, delegate to a domain service
  in `src/domain/`, answer through `src/lib/api/standardResponse.ts`.
- **Design tokens**: CSS custom properties in `src/app/globals.css` are the only
  SSOT for color/radius/shadow. No hardcoded hex in components or Tailwind config.
- **Layering**: `config/` (what exists) → `domain/` (business logic, no HTTP/UI)
  → `app/api/` (thin HTTP) → `components/` (UI) → `hooks/` (data fetching).

## Design system

Tokens are SSOT in `src/app/globals.css`; `tailwind.config.ts` only maps
utilities onto those vars and never declares a hex. Two layers: the legacy
shadcn-style HSL tokens and brand palette (`bg-card`, `text-foreground`,
`tiffany-*`, `orange-*`), and the semantic tier new code uses
(`text-fg-*`, `bg-surface-*`, `border-*`, `bg-accent-warm`, `bg-status-*`,
`tracking-display`, `max-w-shell`). Existing components migrate as touched; no
new uses of `tiffany` or `orange-*`. Fonts are self-hosted in `src/fonts/`,
wired in `src/app/layout.tsx`: Space Grotesk (`font-heading`), Inter
(`font-sans`), IBM Plex Mono (`font-mono`). The end state is monochrome surfaces,
one orange, and status colours only for status.

**One orange.** `--public-accent` resolves to `--bitcoin-orange` (`#f7931a`), so
`bg-accent-warm` and `bg-bitcoinOrange` are one colour. Orange means exactly
two things: Bitcoin (balances, Lightning, icons — `bg-bitcoinOrange`) and the one
action that brings someone in (the `accent` Button variant, on public
top-of-funnel surfaces only). In-app actions are monochrome `primary`. Orange is
never decoration, a second button or a disabled state. Ink on it is
`text-on-accent`; `check:accent-ink` fails white. There is no `bitcoin-orange`
utility class.

Two global rules fight your classes: every `<p>` has a bottom margin (give
stacked paragraphs `mb-0` and let the parent set the gap), and every text
`<input>` is pinned to 16px so iOS does not zoom — a larger input uses
`oc-figure-input`, the one exemption.

## One shape per kind, here

The reference implementation is the money surface (`/receive`, `/send`,
`/requests`, `/pay/<username>`):

| Rule                                                     | Where it lives                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| Siblings share one frame: title, one line, tabs, content | `src/components/money/MoneyPage.tsx` — no `icon` prop, on purpose |
| Pick one of a few → equal cells in one row               | `src/components/ui/SegmentedControl.tsx`                          |
| A few suggestions → an even grid                         | `AmountField` presets: `grid grid-cols-4`                         |
| Two actions together → two equal cells                   | `ReceiveCode`: Copy link · Share                                  |
| Rows of one list have one anatomy                        | `WaysToPay`, `OtherWaysToPay`, `RequestList`                      |
| Closed-until-wanted is a button that says so             | `src/components/money/OptionalNoteField.tsx`                      |
| An amount is a figure: number large, unit small          | `src/components/money/MoneyFigure.tsx`                            |
| The object gets the surface, not the page                | `ReceiveCode`: only the QR is a plate                             |
| A row of a list has a face                               | `RailGlyph`; only the Bitcoin tile is orange                      |

Gates (in `pnpm run verify` except the last): `check:choice-rows`,
`check:accent-ink`, `check:type-scale`, `grep -rn '\[#' src/`, and
`BASE_URL=http://localhost:3020 pnpm run check:broken-words` (a word drawn
across two lines on the landing page, the Cat chat and the money surface at
320/390/1440, measured in Chromium; `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` open
the signed-in pages; CI runs it against the standalone build).

Before a PR with a screen in it: open it at 390px (no sideways scroll, 44px
targets, the committing action reachable), put it beside its siblings, read
every label aloud, count the primary buttons (one), run the gates.

## Protected files (back up before touching)

`.env.local`, `supabase/migrations/*`, `src/config/entity-registry.ts`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
