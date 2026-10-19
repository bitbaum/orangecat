# Codebase Audit Report

**Date**: 2026-08-02
**Auditor**: Claude Code (3 parallel read-only audit agents: SSOT/best-practices, API layer, UI/UX)
**Baseline**: main @ 14dec65b · 211 API routes · ~216k lines (723 tsx + 908 ts)
**Previous audit**: 2026-07-13 (overall 7.7/10, updated 2026-07-20) — see delta below.

## Executive Summary

OrangeCat's SSOT discipline is exceptional where the SSOTs already exist: **1** hardcoded table name in 807 `.from()` calls, **0** arbitrary hex colors, **0** `@ts-ignore`, **1** real `console.*`, **0** fake UI metrics, **0** user-facing "sats"/"donate" copy, **0** missing-auth routes across all 211, **0** error-message leaks (10 sampled). Design-token migration is ~98.6% semantic (~5,700 semantic vs ~107 legacy class uses). Route-level async boundaries are near-universal (115 loading/error/not-found files).

The remaining debt concentrates in four places: (1) a **parallel hand-written type layer** — 59 interfaces in `src/types/` with zero `z.infer`, plus a hand-edited 3,500-line `types/database.ts`; (2) **447 code clones** (2.61% of lines — up from 1.09% on 07-13), especially API-route pairs the existing CRUD factory was built to eliminate; (3) **~53 path literals** (`/api/...`, app routes) that predate the API_ROUTES/ROUTES SSOTs; (4) **~22 mutating routes without rate limiting** and ~15 without zod validation — including two unauthenticated endpoints that trigger external calls and one authenticated endpoint that invokes an LLM per request.

One silent-data-loss bug was found during the audit and fixed immediately: the profile PUT's hand-written field allow-list had drifted from the schema and silently dropped `currency`, `background`, and `inspiration_statement` from every save (the `inspiration_statement` column didn't even exist). The allow-list is now derived from `profileSchema`, killing the drift class.

## Health Score

| Area                    | Score      | Notes                                                                             |
| ----------------------- | ---------- | --------------------------------------------------------------------------------- |
| First Principles / SSOT | 8/10       | Config SSOTs superb; `src/types/` parallel layer + clone growth are the gap       |
| Best Practices          | 8/10       | Response format, auth, logging near-perfect; rate-limit + zod gaps                |
| Mission Alignment       | 8/10       | Payments now REAL (Cat Credits live 2026-08-01); terminology + honesty rules hold |
| Functional Correctness  | 7/10       | 0 auth holes, but unmetered LLM/auth endpoints + 1 unbounded query                |
| UI/UX & Responsive      | 8/10       | 98.6% token migration, aria/alt clean; 4 designed-state gaps                      |
| **Overall**             | **7.9/10** | Debt is concentrated and enumerable, not diffuse                                  |

## Delta since 2026-07-13/20

- ✅ **"0 payments ever" is over** — Cat Credits went live 2026-08-01 (Coinos NWC on the box); the paramount 07-20 blocker is resolved.
- ✅ S1 (public profile PII) and F2 (partial-PUT unpublish) fixed in the first-payment sprint (per 07-20 delta); not re-broken.
- ✅ Token migration advanced from 112 legacy refs → ~107 total legacy class _uses_ with semantic usage now ~5,700 (98.6%); `text-gray-*` fully gone.
- ✅ Data controls shipped (memory consent, export, delete-all, account deletion — #518); settings IA unified (#532/#537/#539); agent trust layer complete (spend caps #512, denial reasons #517, action audit UI #538).
- ⚠️ **Duplication regressed**: 1.09% (07-13) → 2.61% (447 clones) — three weeks of high-velocity parallel shipping added clone debt faster than factories absorbed it.
- ⚠️ `any` pressure roughly flat (~130 combined vs ~215 then, different counting methods — treat as "still the biggest suppression class").
- ⏳ Not re-verified this pass: MockPaymentProvider stack, `/discover` SSR, fiat rails, investment settlement, group/circle treasuries (product-depth items — unchanged status assumed).

## Top Findings (ranked, with remediation status)

| #   | Finding                                                                                                                                                                                                                                                                                                                                                   | Count         | Action                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------- |
| 1   | Profile PUT allow-list drift → silent field loss (currency/background/inspiration_statement; inspiration column missing entirely)                                                                                                                                                                                                                         | 3 fields      | **FIXED**: derived `PROFILE_UPDATABLE_FIELDS` from schema + guard test + column migration |
| 2   | Mutating routes without rate limiting — worst: `auth/verify-captcha` + `auth/sync` (unauthenticated, external calls), `cat/offers-from-text` (LLM per request), 6 loan writes, webhook-endpoint routes incl. `replay` (outbound HTTP), integration-key routes, plus `v1/stakeholders` and `v1/timeline/publish`                                           | ~22 files     | Slice 2 + route-walker gate                                                               |
| 3   | Mutating routes without zod — raw property access in `projects/[id]/status`, `notifications/preferences`, `social/follow`+`unfollow`, `wallets` POST, `auth/sync`, `auth/verify-captcha`; dead `_body` parse in `groups/[slug]/members:76`                                                                                                                | ~15 (8 worst) | Slice 2                                                                                   |
| 4   | Parallel type layer: `src/types/` 59 hand interfaces, 0 z.infer; hand-edited `types/database.ts` (internal clones prove hand-maintenance); split-brain input types (CreateGroupInput, CreateLoanRequest vs zod)                                                                                                                                           | 59            | Phase A: generate DB types; restrict entity-input types to `@/lib/validation`             |
| 5   | Code duplication: 447 clones / 5,643 lines — social follower/following route pair, task action route triple, ModernProfileEditor 58-line internal clone, navigation-generator ×3, tasks form hooks                                                                                                                                                        | 447           | Phase B: refactor top-10 via existing factories + jscpd ratchet in verify                 |
| 6   | Hardcoded `/api/` paths bypassing API_ROUTES — worst `articles/ai-client.ts` ×7, `cat-actions.ts` ×4 (one duplicates `API_ROUTES.MESSAGES.BASE`), payment panels ×6                                                                                                                                                                                       | 33            | Slice 3 + `no-restricted-syntax` gate                                                     |
| 7   | Hardcoded app routes bypassing ROUTES (`ProjectHeader`, `MessagePanel`, bookings/tasks pages)                                                                                                                                                                                                                                                             | 20            | Slice 3 (same gate; ROUTES needs param-fns for `/messages/:id`)                           |
| 8   | User-scoped routes lazily on admin client — `cat/nudges`, `cat/offers-from-text` (writes profile bio via service role!), notifications, `messages/self` (also an unbounded `select('*')` + in-memory `.find()` scan + compensating delete)                                                                                                                | ~9 sites      | Slice 2 partial; RLS-policy phase; `no-restricted-imports` gate                           |
| 9   | Public v1 routes (`v1/demand`, `v1/search`, `discover/counts`) served via admin client — public exposure hinges solely on service-level filtering                                                                                                                                                                                                         | 3 routes      | Contract test pinning "public/active rows only"                                           |
| 10  | Currency display bypassing useDisplayCurrency (`DynamicSidebar:88`, `settings/usage:208`, `AnalyticsInsights:145`, `OwnerCollectPanel:232`, timeline formatter `:164`; raw `toLocaleString` in asset/loan/collateral configs)                                                                                                                             | ~8            | Slice 3 + lint gate                                                                       |
| 11  | Legacy design-class tail (tiffany 46 — 13 config-side; shadcn legacy 61) concentrated in `ui/` primitives (CurrencyInput 10, UserProfileDropdownPanel 8, skeletons 7, LocationInput 5, Breadcrumb 5)                                                                                                                                                      | ~107          | Slice 3 mechanical sweep                                                                  |
| 12  | Raw `uppercase tracking-wide*` instead of the semantic `tracking-label`/`caps` utilities built for exactly this                                                                                                                                                                                                                                           | 55            | Slice 3 mechanical sweep                                                                  |
| 13  | Inline status-pill markup (`rounded-full … px-2 py-0.5`) ×29 despite `ui/badge` (37 importers); hand-rolled `animate-pulse` skeletons in 30 files despite `ui/skeletons`                                                                                                                                                                                  | 29+30         | Phase: route to Badge/Skeleton                                                            |
| 14  | Touch targets <44px: `UpgradeNudge:55`, `NostrConnectionCard:91`, `ConversationListItem:202`, `ComposerImageAttachment:131`, `SmartQuestionsPanel:93` (also hover-only-revealed = invisible on touch)                                                                                                                                                     | 5             | Slice 3 (BitcoinWalletStatsCompact:104 is the reference pattern)                          |
| 15  | Missing designed states: analytics (no empty/error — zeros render as real data, violating the no-fake-metrics rule), settings/usage (silent fetch error), MessagePanel (no in-panel error), 4 bare empty states (GroupWallets, ConversationRail, LoanOffersList, DashboardProjects)                                                                       | 4+4 surfaces  | Slice 4 (design judgment)                                                                 |
| 16  | God files: 20 components >300 (ArticleComposer 483, WalletForm 402, bookings/[id] 375), 11 services >500 (**paymentFlowService 931**), 11 routes >150 (cron/payment-reconcile 196 — logic inline)                                                                                                                                                         | 42            | Phase C: split worst-first                                                                |
| 17  | Suppression debt: `any` ~81 + 49 disables; `no-img-element` ×20; `exhaustive-deps` ×16                                                                                                                                                                                                                                                                    | ~130          | Ratchet counts in CI                                                                      |
| 18  | Singletons: raw `.from('match_introductions')` + table missing from DATABASE_TABLES (`reverseMatch.ts:101`); `console.warn` in `useProfileTheme:54`; Bitcoin Orange on non-Bitcoin UI (CatCreditsPanel top-up CTA :102 + 2 icons); `shadow-[…]` in SidebarNavItem:62; `w-96` skeleton overflow at 320px (`app/loading.tsx:8`); careers page 3× accent CTA | 8             | Slice 3 one-liners                                                                        |

## Enforcement Ledger (Never-Twice)

| Class                                   | Gate                                                    | Status          |
| --------------------------------------- | ------------------------------------------------------- | --------------- |
| Form-field ↔ schema drift               | `entity-form-schema-drift.test.ts`                      | ✅ (2026-07-13) |
| Migration timestamp collisions          | `migrations-unique-version.test.ts`                     | ✅ (#541)       |
| Profile allow-list drift                | schema derivation + `profile-updatable-fields.test.ts`  | ✅ this PR      |
| Missing auth on mutating routes         | `api-route-guards.test.ts` walker (pins today's 0)      | ✅ (#559)       |
| Missing rate limit on mutating routes   | same walker, allowlist ratcheting down                  | ✅ (#559)       |
| New `/api/` + app-route literals        | ESLint `no-restricted-syntax`                           | ✅ (#557)       |
| New admin-client call sites             | (deferred — see Phase D)                                | ⏳ open         |
| Hand-written DB schema types drifting   | `types/database.ts` re-exports the generated schema     | ✅ (Phase A)    |
| Wall-clock assertions in unit tests     | currency perf test rewritten deterministically          | ✅ (Phase A)    |
| Raw `NextResponse.json` in api/         | ESLint rule (allowlist lnurlp/openapi)                  | ✅ (#572)       |
| Currency-format bypasses                | swept to the SSOT formatter                             | ✅ (#557)       |
| Clone percentage                        | `check:duplication` ratchet in `verify` (baseline 1.3%) | ✅ (#567)       |
| File sizes (components/routes/services) | `check:sizes` ratchet in `verify` (list only shrinks)   | ✅ (#566)       |
| Public-surface row filtering            | `public-surface-filtering.test.ts`                      | ✅ (#572)       |

## Judged Clean (do not re-litigate)

Auth coverage (five legitimate mechanisms across 211 routes), error-message hygiene, tips flow ("exemplary" — per-IP + per-recipient limits, opaque tokens), list-handler pagination, quota-cap SSOT (`cat-plans.ts`), rendered-copy terminology, aria-labels/alt (0 violations), `oc-error-surface` (32 uses), table overflow (3/3), `lib/supabase/untyped.ts` as a deliberate escape hatch.

---

## Completion status (2026-08-02, end of sweep)

Everything in this report shipped the same day except Phase A, which followed on 2026-08-04 (below).

| Package                                                    | PR   | Outcome                                                                                                                      |
| ---------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| Slice 1 — profile-save SSOT + settings IA                  | #552 | ✅ merged + deployed. Found and fixed silent field loss (currency/background/inspiration_statement dropped from every save). |
| Slice 2 — API rate limits + validation + route-walker gate | #559 | ✅ merged + deployed                                                                                                         |
| Slice 3 — literal sweeps + lint gate + UI mechanical       | #557 | ✅ merged + deployed. Legacy shadcn classes now 0 repo-wide.                                                                 |
| Slice 4 — designed empty/error states + presence beacon    | #569 | ✅ merged                                                                                                                    |
| API polish — responses, session-client, contract test, img | #572 | ✅ merged                                                                                                                    |
| Phase B — clone dedup + ratchet                            | #567 | ✅ **duplication 2.61% → 1.2%** (447 → 157 clones)                                                                           |
| Phase C — god-file splits + size gate                      | #566 | ✅ merged. `paymentFlowService` 931 lines → façade + modules.                                                                |
| Phase A — generated DB types                               | #608 | ✅ `types/database.ts` is now a façade over the live-schema types; found 3 more schema-drift bugs.                          |

### Phase A — shipped (part 2)

`src/types/database.ts` no longer holds a hand-maintained `Database` interface: it
re-exports the one `npm run gen:types` produces from the live self-hosted schema
(7,693 lines via postgres-meta), and keeps only the app-model tail. The live
schema is now the single source of truth for every typed Supabase query.

The swap produced **79 errors in 26 files**, cleared over three `tsc` rounds
(79 → 15 → 0) without re-entering either documented dead end. What worked:

1. **`looseClient(sb)`** (`lib/supabase/untyped.ts`) — a `SupabaseClient` view
   whose rows are `Record<string, unknown>`, so genuinely dynamic-table helpers
   (`listEntitiesPage`, `createEntityListHandler`, `deleteEntity`, the sitemap
   walker, two `/api/v1` routes) can name a table at runtime and still get typed
   results. This is the fix `fromTable()` could not be: it returns `any`, which
   collapsed inference in downstream generics and drove errors 30 → 136.
2. **`FilterChain<B>`** — a structural view of the PostgREST filter methods, for
   the two helpers that receive and return a builder (`applyProjectQueryFilters`,
   the discover `buildQuery`). `B extends FilterChain<B>` keeps the caller's
   exact builder type flowing through instead of widening it.
3. **`AsEntity<T>`** — `Omit`s the two timestamps and re-adds them optional, so
   generated Rows (honestly `string | null`) satisfy `BaseEntity`.
4. **Hand types re-derived from `Database[...]['Row']`** — `Loan`, `LoanOffer`,
   `LoanCategory`, `UserAIPreferences`, `SupportType`, the projectStore row.
   Where Postgres enforces a CHECK constraint that postgres-meta can only emit as
   `string`, the narrowing is asserted in exactly one place per domain
   (`services/loans/queries/narrow.ts`).

**Three more real bugs the swap surfaced** (same class as the `user_causes`
`goal_amount` find in part 1 — a stale hand type hiding a broken query):

- `investments.investor_count` **is not a column**, yet `domain/investments/service.ts`
  and the Cat's `create_investment` handler both wrote it on insert — those
  inserts failed with 42703. Removed from both paths; the field is now declared
  runtime-enriched (like `UserCause.current_amount`), and both unit tests that
  pinned `investor_count: 0` now assert the column is *not* sent.
- `typing_indicators.user_id` is a foreign key to `auth.users`, **not** to
  `profiles`, so the `profiles:user_id (...)` embed in `useTypingSubscription`
  could never resolve — typing indicators never showed a name. Replaced with a
  second profile lookup, the same pattern the messaging queries already use.
- The `Loan` hand type contradicted the DB CHECK constraints:
  `fulfillment_type` was `'lightning' | 'onchain' | 'bank_transfer' | 'other'`
  where the DB allows only `manual | automatic`; `loan_type` said
  `existing_loan` where the DB says `existing_refinance`; `LoanStatus` was
  missing `draft`. Now sourced from the `config/loans.ts` SSOT.

**Known mismatch left as-is, deliberately:** `webhook_endpoints.secret_encrypted`
is a `bytea` column that postgres-meta types as the hex string PostgREST returns
on read, while the insert passes a raw `Buffer`. Runtime behaviour is unchanged
(the read path already accepts both) and the cast is commented at the call site,
but whether the mint actually round-trips is worth verifying against prod.

**Not closed by this phase:** the remaining 59-interface `src/types/` layer, and
the fact that inserts routed through `createEntity()`/`looseClient` are *not*
column-checked at compile time — which is exactly how `investor_count` survived.
A schema-derived check on entity insert payloads would end that class.

### Remaining open (recorded, not started)

- **Phase D — admin-client → RLS**: ~7 user-scoped routes still use the service-role client where owner RLS policies would do (notifications ×2, messages unread-count/read, messages/self insert path). Needs new RLS policies first, then the `no-restricted-imports` gate on `@/lib/supabase/admin`.
- ~~**Flaky perf test**~~: fixed alongside Phase A — `tests/unit/utils/currency.comprehensive.test.ts` no longer asserts wall-clock budgets (they measured the machine, not the code). The conversion test now asserts a sats round-trip lands back on the same BTC value to 8 dp, which is deterministic and catches precision regressions a timer never could.
- `types/database.ts`'s remaining hand-written app-model tail, and the 59-interface `src/types/` layer, are only partially addressed (Phase B derived the group/loan input types from their zod schemas).
