# Principles Audit — 2026-07-03 (SSOT / DRY / SoC / KISS / YAGNI)

Founder-mandated sweep: "how many violations are scattered all over?" — counted,
top offenders fixed on branch `fix/principles-audit`, remainder listed here.

Baseline: `origin/main` @ `48e2b5e9`. Live schema verified directly on the box
(`root@167.233.22.31` → `docker exec supabase-db psql`).

## Violation counts by category

| Category                                                                 |                    Found | Fixed |                                  Deferred |
| ------------------------------------------------------------------------ | -----------------------: | ----: | ----------------------------------------: |
| Live schema drift breaking production (P1 bugs)                          |                        2 |     2 |                                         0 |
| Stale `scripts/db/live-schema.json` snapshot (audit:schema false alarms) |                        5 |     5 |                                         0 |
| Arbitrary hex in className (`grep -rn '\[#' src/`)                       |                        0 |     — |                                         0 |
| Inline-style hex (`style={{…#`)                                          |                        0 |     — |                                         0 |
| Hardcoded table names in `.from('…')` outside SSOT                       |                        0 |     — |                                         0 |
| Hardcoded page routes outside `src/config/routes.ts`                     |                       10 |     9 | 1 (prose in Cat system prompt — not code) |
| Hardcoded `fetch('/api/…')` outside `src/config/api-routes.ts`           |                        5 |     5 |                                         0 |
| Stale tests asserting retired `SATS` currency (failing on main)          |                        3 |     3 |                                         0 |
| Components > 300 lines (`*.tsx`, excl. tests)                            |                       17 |     0 |                                        17 |
| Duplicated code (jscpd, exact clones)                                    | 468 clones / 3.25% lines |     0 |                                       468 |

Gates after this pass: `type-check` 0 errors · `lint` clean · `jest` 957/957
green · `audit:routes` clean · `audit:schema` clean.

## Fixed in this pass

### 1. POST /api/research 500s live — inserts columns dropped by migration 20260404000005

`research_entities` no longer has the 9 denormalized counters
(`citation_count`, `follower_count`, `total_votes`, `total_contributors`,
`completion_percentage`, `days_active`, `funding_velocity`, `share_count`,
`average_rating`) — verified live. But the code still wrote/read them:

- `src/domain/research/createResearch.ts` — removed dropped columns from the insert (root cause of the live 500).
- `src/services/cat/handlers/entities.ts` — same fix for Cat's `create_research` tool.
- `src/types/research.ts`, `src/types/database.ts` — types no longer claim the dropped columns exist (SSOT: types match live schema).
- `src/app/(authenticated)/dashboard/research/page.tsx` — stopped rendering the dead counters (Contributors stat card, "Research Progress %", "N contributors / N followers" — they displayed `undefined`/fake zeros; red-flag #9).

### 2. Group-events APIs broken live — profiles embeds on FKs that point at auth.users

Live FKs: `group_events_creator_id_fkey` and `group_event_rsvps_user_id_fkey`
both reference `auth.users`, **not** `profiles`. PostgREST therefore rejects
`profiles!group_events_creator_id_fkey` embeds with a 400, killing the whole
query (list events, event detail, RSVPs, RSVP write-response).

Fix: split queries, `fetchEntityOwner`-style, via a new shared helper
`src/services/groups/eventProfiles.ts` (`fetchProfilesMap`,
`attachEventProfiles`, `attachRsvpProfiles` — one batched profiles query, DRY
across server and browser):

- `src/app/api/groups/[slug]/events/route.ts` (GET list + POST creator enrichment)
- `src/app/api/groups/[slug]/events/[eventId]/route.ts` (GET detail)
- `src/app/api/groups/[slug]/events/[eventId]/rsvp/route.ts` (POST)
- `src/services/groups/queries/events.ts` (browser: `getGroupEvents`, `getEvent`, `getEventRsvps`)

No migration added: repo migrations match live here — the code was behind, not
the DB. (Re-pointing the FKs at `profiles` would be a schema decision beyond
this audit's scope; the split-query pattern is the established one.)

### 3. Stale live-schema snapshot

`npm run audit:schema` reported 5 drifts (`search_queries`,
`user_economic_profile`, `payment_intents.lnurl_verify_url`) — all exist on the
box; the committed `scripts/db/live-schema.json` was stale. Refreshed via
`scripts/db/dump-live-schema.sh` (now 120 tables). Audit is clean again and
back to being a trustworthy gate.

### 4. Route/API-endpoint SSOT stragglers

- `/dashboard/cat?welcome=true` was duplicated in 5 places → new
  `ROUTES.DASHBOARD.CAT_WELCOME`; consumers: `src/app/auth/confirm/route.ts`,
  `src/app/auth/callback/route.ts`, `src/app/(authenticated)/dashboard/page.tsx`.
- Ad-hoc `startsWith('/dashboard/cat')` checks (also matched `/dashboard/catalog`)
  → exported the existing `isCatHubPath()` helper from `src/config/routes.ts`;
  consumers: `useChatMessages.ts`, `src/services/ai/document-context.ts`.
- 5 hardcoded `fetch('/api/…')` calls → `API_ROUTES` (added
  `WEBHOOK_ENDPOINTS.DELIVERIES`, `AUTH.OAUTH_PROVIDERS`, `DISCOVER.COUNTS`):
  `WebhookDeliveriesDrawer.tsx`, `oauthProviders.ts`,
  `settings/notifications/page.tsx` (×2), `useDiscoverCounts.ts`.
- `src/lib/navigation/contextual-create.ts` migrated to `ROUTES.*` +
  single `COMPOSE_HREF` constant (was 5× `'/timeline?compose=true'` plus 7 raw
  path literals).

### 5. Stale unit tests (failing on main)

`tests/unit/utils/currency.comprehensive.test.ts` and
`tests/unit/utils/project-validation.test.ts` still asserted the retired `SATS`
currency code (3 failures on clean main). Updated to the currency SSOT
(`CURRENCY_CODES = USD/EUR/CHF/GBP/BTC`): unknown codes fall back to plain
locale formatting; project fixture uses `CHF`.

## Deferred (tracked, not fixed here)

### Components > 300 lines (17)

Top offenders — split as touched, per the migration-as-touched convention:

| Lines | File                                                       |
| ----: | ---------------------------------------------------------- |
|   460 | `src/components/search/CommandPalette.tsx`                 |
|   432 | `src/components/entity/EntityDashboardPage.tsx`            |
|   402 | `src/components/public/PublicEntityDetailPage.tsx`         |
|   377 | `src/components/groups/GroupWallets.tsx`                   |
|   375 | `src/app/(authenticated)/dashboard/bookings/[id]/page.tsx` |
|   373 | `src/components/dashboard/TasksSection.tsx`                |
|   342 | `src/app/groups/[slug]/settings/page.tsx`                  |
|   339 | `src/app/(public)/faq/page.tsx`                            |
|   338 | `src/components/groups/GroupMembers.tsx`                   |
|   333 | `src/components/profile/ProfileOverviewTab.tsx`            |

…plus 7 more in the 300–315 range. Several are near-threshold content pages
(faq, docs, blog) where splitting adds indirection without value — judge per
file, don't split mechanically.

### Code duplication (jscpd)

468 exact clones, 3.25% duplicated lines across 1,465 files. Mostly entity-page
scaffolding that the EntityCard/PageHeader/EntityListShell convergence work is
already eating through. Re-run `npx jscpd src` after the next design-discipline
PR and attack the biggest clone clusters (entity dashboard pages).

### Other

- `group_events.creator_id` / `group_event_rsvps.user_id` FKs point at
  `auth.users`; a future migration re-pointing them at `profiles` (or an
  `actor_id` migration per the Actor rule) would allow real embeds again and
  retire `eventProfiles.ts`. Product/schema decision — flag for founder.
- `ALLOW` set in `scripts/db/audit-schema-drift.mjs` still tracks 3 known
  drifts (wishlist_feedback.user_id, wishlist_fulfillment_proofs.user_id,
  group_proposals.is_public) — unchanged, still triaged.
- One prose mention of `/dashboard/projects/abc` inside the Cat system prompt
  (`src/services/cat/system-prompt.ts`) — an example string for the LLM, not a
  route reference; intentionally left.
