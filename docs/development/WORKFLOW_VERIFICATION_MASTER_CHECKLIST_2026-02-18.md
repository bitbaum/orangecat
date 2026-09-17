# Workflow Verification Master Checklist (One-by-One)

Date: 2026-02-18
Last Modified: 2026-07-05
Last Modified Summary: CI P0 matrix green (11/11); Phase 0/1/9 closed; messaging UI context menu verified.
Owner: Reliability Sweep
Objective: verify **all critical workflows** in Orangecat one by one, capture evidence, and fix failures before close.

## How this run works

- We execute workflows in strict order.
- Each item is marked: ☐ TODO / ◐ IN PROGRESS / ☑ DONE / ⚠ BLOCKED / ✗ FAILED
- Every workflow must include:
  - Test method (API, E2E, manual)
  - Result
  - Evidence (test output, screenshot, API response, commit)
  - Fix notes (if broken)

---

## Phase 0 — Preconditions

- ☑ Confirm test environment URLs and credentials are valid — production Mao + CI fixture `test@orangecat.ch` (2026-07-05)
- ☑ Confirm required CI/E2E secrets exist — configured via `gh secret set`; see `docs/development/CI_P0_E2E_SECRETS_CHECKLIST.md`
- ☑ Confirm fixture user + fixture project ownership — CI bootstrap (`ensure-e2e-fixtures.mjs`) self-heals user/conversation/project each run
- ☑ Confirm Cat provider key status (Groq)
- ☑ Confirm baseline commands run locally: type-check, unit tests — type-check + unit 713/713 green (2026-07-05)

---

## Phase 1 — Authentication & Access Control (P0)

- ☑ Login (valid credentials) — production Mao session verified 2026-07-04 (`butaeff@gmail.com`)
- ☑ Login (invalid credentials handling) — managed browser verified (`/auth/login` shows "Ungültige E-Mail-Adresse oder Passwort")
- ☑ Logout — `POST /auth/signout` → 200; protected API → 401; `/dashboard` redirects to login (2026-07-04)
- ☑ Protected route redirect for unauthenticated user (matrix p0 passed + managed browser `/dashboard` redirects to login)
- ☑ Password reset request — managed browser verified (`/auth/forgot-password` shows "E-Mail gesendet!")
- ☑ Password reset completion — CI P0 matrix `@p0 password reset complete flow` green; tokens minted per run in bootstrap (2026-07-05)
- ☑ Session persistence across reload — dashboard stays authed after reload (2026-07-04)

---

## Phase 2 — Project Lifecycle (P0)

- ☑ Project create route access (authenticated) — `/dashboard/projects/create` loads 4-step wizard (2026-07-04)
- ☑ Create project (happy path) — `POST /api/projects` → 201; ephemeral audit project created + deleted
- ☑ Edit project fields and persist — `PUT /api/projects/[id]` → 200 (note: `PATCH` returns 405; API is PUT-only)
- ☑ Status transitions: draft -> active — art-space draft project (2026-07-04)
- ☑ Status transitions: active -> paused — OrangeCat project (2026-07-04)
- ☑ Status transitions: paused -> active — OrangeCat project (2026-07-04)
- ☑ Status transitions: active/paused -> draft (unpublish) — allowed by transition table (2026-07-04)
- ☑ Invalid transition rejection behavior — `active` → `active` returns 422
- ☑ Publish/unpublish visibility on public surfaces — anonymous `/discover?type=projects` → 200 (2026-07-04)

---

## Phase 3 — Messaging Core (P0)

- ☑ Open/create conversation — `GET /api/messages` lists 10+; `GET /api/messages/self` → 200
- ☑ Send message — `POST /api/messages/[id]` → 201; UI send to Aslan Kurdi thread verified
- ☑ Edit message — `PATCH /api/messages/edit/[messageId]` → 200
- ☑ Delete message — `POST /api/messages/bulk-delete` with `{ conversationId, ids }` → 200 (`DELETE` on edit route is 405 by design)
- ☑ Message list consistency after mutation — API round-trip + UI shows `edited` label; context menu via right-click/tap-hold (`MessageContextMenu`) verified on production Aslan thread (2026-07-05)
- ☑ Conversation preview updates with latest message — list preview shows sent `ui audit …` text
- ☑ Unauthorized conversation access blocked — fake UUID → 404

---

## Phase 4 — Notifications (P0)

- ☑ Unread count fetch — production 2026-07-04: `GET /api/notifications/unread` → 200
- ☑ Mark single notification read — `POST /api/notifications/read` `{ id }` → 200 (idempotent when already read)
- ☑ Mark multiple notifications read — `POST /api/notifications/read` `{ ids }` → 200 (idempotent when already read)
- ☑ Mark all notifications read — production 2026-07-04: `POST /api/notifications/read` → 200 (after migration `20260704000000_fix_notifications_updated_at_trigger.sql`)
- ☑ Unread count decreases correctly after read actions — verified unread 0 after mark-all

---

## Phase 5 — Cat / AI Runtime (P0)

- ☑ /api/cat/chat endpoint liveness — production 2026-07-04: POST → 200
- ☑ Cat response path with configured provider — `POST /api/cat/chat` → 200, reply `CAT_OK` via OpenRouter fallback (2026-07-04)
- ☑ Provider failure behavior (invalid/missing key) is user-safe — Groq rate-limit falls back to OpenRouter; exhausted quota returns 429 with BYOK CTA (code path verified)
- ☑ Cat actions list endpoint — `GET /api/cat/actions` → 200
- ☑ Cat action approve path — `POST /api/cat/actions/[id]` invalid id → 400 "Pending action not found or already processed"
- ☑ Cat action reject path — `DELETE /api/cat/actions/[id]` → 200 `{ rejected: true }` (idempotent for missing id)

---

## Phase 6 — Entity Workflows (P1)

- ☑ Services: create/edit/list/detail — API CRUD 201/200/200/200; list UI loads (2026-07-04)
- ☑ Assets: create/edit/list/detail — fixed `owner_id` on create; API CRUD green after deploy
- ☑ Loans: create/edit/list/detail — fixed `loans_status_check` to allow `draft`; API CRUD green after deploy
- ☑ Causes: create/edit/list/detail — API CRUD green (`cause_category` must match SSOT labels)
- ☑ Events: create/edit/list/detail — API CRUD green (`is_free: true` or ticket_price/funding_goal)
- ☑ Wishlists: create/edit/list/detail — API CRUD green

---

## Phase 7 — Wallet & Payments (P1)

- ☑ Wallet list — `GET /api/wallets?profile_id=…` → 200; `/dashboard/wallets` loads (2026-07-04)
- ☑ Wallet create — valid bech32 + `category: general` → 201; LN-only wallet → 201 (2026-07-04)
- ☑ Duplicate wallet behavior — returns `duplicateWarning`, does not block create (by design)
- ☑ Wallet transfer API validation — bad UUIDs/negative amount → 400; same-wallet → 400; zero balance → 400 insufficient; foreign wallet → 404 (2026-07-04)
- ⚠ Wallet transfer happy-path — blocked: all Mao wallets `balance_btc: 0` (no safe prod funding path)

---

## Phase 8 — Groups & Social (P2)

- ☑ Group create — `POST /api/groups` with `label: circle` → 201 (requires `label` SSOT field, not just `name`)
- ☑ Group membership visibility — `GET /api/groups/[slug]/members` → 200 after WF-009 fix (returns founder member; deployed + prod-verified 2026-07-04)
- ☑ Follow/unfollow basic flow — follow Aslan → 409 already following; unfollow → 200; self-follow → 400; invalid UUID → 404 (2026-07-04)
- ☑ Timeline posting basic flow — UI compose on `/timeline` → post appears in feed (client-side timeline service, no `/api/timeline`)

---

## Phase 9 — Operational & Quality Gates

- ☑ Health endpoint behavior (rerun passed: `@p0 health endpoint responds`)
- ☑ P0 matrix runs green in CI with required secrets — [GitHub Actions run 28722171024](https://github.com/bitbaum/orangecat/actions/runs/28722171024) / commit `d3e1bbe6`: **11/11 passed** (2026-07-05)
- ☑ No skip-based false green in required P0 checks — bootstrap mints reset tokens; missing secrets skip matrix explicitly
- ☑ Lint/type-check/unit tests pass on final state — CI job green; local unit 713/713; type-check pass (2026-07-05)
- ☑ Workflow YAML validity check (all `.github/workflows/*.yml` parse successfully after fixes)

---

## Defect Log (fill during execution)

| ID     | Workflow                  | Symptom                                                                              | Severity | Root cause                                                                                                                                                                     | Fix commit                                                                                        | Status                                  |
| ------ | ------------------------- | ------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------- |
| WF-001 | Health endpoint           | `/api/health` returned HTTP 500 in P0 matrix                                         | P0       | Exception path previously returned generic 500; hardened to deterministic 200/503 readiness endpoint                                                                           | 87c5423a                                                                                          | Closed (retested pass)                  |
| WF-002 | Auth/reset P0 checks      | P0 matrix skipped/blocked auth-dependent tests locally                               | P0       | Playwright specs used `E2E_TEST_USER_*` while CI matrix uses `E2E_USER_*`; stale reset tokens; wrong service role secret                                                       | `credentials.ts` SSOT + CI bootstrap + `refresh-e2e-reset-tokens.mjs` + matrix fixes (`d3e1bbe6`) | Closed (CI 11/11 green 2026-07-05)      |
| WF-004 | Notifications mark-read   | `POST /api/notifications/read` returned 500 ("Database error")                       | P0       | `notifications` had `BEFORE UPDATE` trigger setting `updated_at` but column is `read_at`                                                                                       | `20260704000000_fix_notifications_updated_at_trigger.sql`                                         | Closed (production verified 2026-07-04) |
| WF-005 | Circles discover redirect | `/circles` → `/discover?type=circles` fell back to All tab                           | P1       | Discover tab SSOT lacked `circles`                                                                                                                                             | deploy 2026-07-04                                                                                 | Closed                                  |
| WF-006 | Asset create              | `POST /api/assets` returned 403                                                      | P1       | RLS checks `owner_id` but create only set `actor_id`                                                                                                                           | `createAsset` sets `owner_id` (deploy 2026-07-04)                                                 | Closed                                  |
| WF-007 | Loan create               | `POST /api/loans` returned 500                                                       | P1       | `loans_status_check` omitted `draft` while createLoan inserts draft                                                                                                            | `20260704181500_fix_loans_draft_status_check.sql`                                                 | Closed                                  |
| WF-008 | Draft entity GET          | Owner `GET /api/services/[id]` 404 for draft rows                                    | P1       | `requireActiveStatus` filtered active before ownership check                                                                                                                   | `entityCrudHandler` owner draft read (deploy 2026-07-04)                                          | Closed                                  |
| WF-009 | Group members list        | `GET /api/groups/[slug]/members` → 404 then 500 while `GET /api/groups/[slug]` → 200 | P2       | (1) route passed `!!user` as `bySlug` + no server client to `getGroup`; (2) `getGroupMembers`/`joinGroup` defaulted to browser Supabase client with no server-client injection | `members/route.ts` uses `isBySlug` + threads server client through `getGroupMembers`/`joinGroup`  | Closed (production verified 2026-07-04) |

---

## Exit Criteria (Done-Done)

- ☑ All Phase 1–5 items are ☑ DONE
- ☑ No unresolved P0 defects
- ☑ P0 CI matrix green with full secrets present (`d3e1bbe6`, 2026-07-05)
- Remaining documented exceptions (not P0 blockers):
  - **Wallet transfer happy-path** — Mao wallets have zero balance; validation paths verified
  - **Local Playwright** — optional `npx playwright install` for pre-push smoke when a dev server is running; pre-push skips if `localhost:3000` is down (CI runs full P0 matrix). Some host OS builds (e.g. Ubuntu 26.04) may not have Playwright browser builds yet.
