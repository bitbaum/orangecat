# Site audit — what works, what is broken (living document)

Started 2026-11-04 after G (as test user Anya) hit several dead ends. **Keep this
file current**: when you fix or find something, update its row and the date.

## How this was tested

- Live site `https://orangecat.ch`, real Chromium (Playwright), signed in as
  throwaway QA accounts created through normal sign-up
  (`qa-grokbot-*@orangecat-qa.test`, email autoconfirm is on). Two accounts are
  used for messaging (sender + reader). Never use a real member's account.
- Scripts used (box-local, not in the repo yet): login → `storageState`, crawl
  every sidebar/nav link on desktop 1366px and iPhone 13, record HTTP ≥400,
  console errors, horizontal overflow and empty/error copy; targeted flow
  scripts for uploads, Contact → messages, DM read receipts.
- API probes with the user's own bearer token for storage and entity APIs.

## Matrix

| Area | Flow | Status | Root cause / note | PR |
|---|---|---|---|---|
| Profile | Upload avatar | **Fixed** (pending deploy check) | `storage.objects` had no INSERT/UPDATE policies for `avatars` (dashboard-only policies lost in the self-host move) → `403 new row violates row-level security policy` → "Upload failed" | #1544 |
| Profile | Upload banner | **Fixed** (same) | same, `banners` bucket | #1544 |
| Articles | Cover image upload | **Fixed** (same) | uses `banners` bucket | #1544 |
| Wishlists | Proof upload | **Fixed** (same) | `proofs` bucket, owner of the wishlist item only | #1544 |
| Profile | Fill profile by chat on `/dashboard/info/edit` | **Fixed** | floating Cat hidden on every `/edit` path; profile editor has no Fill-with-AI bar | #1544 |
| Nav | Sidebar name/avatar → your profile | **Fixed** | header only toggled the context switcher; now links to `/profiles/<username>`, chevron opens the switcher, menu has "View my profile" | #1544 |
| Cat | Draft card → Publish a **service** | **Fixed** | card sent `price`; services need `hourly_rate`/`fixed_price` → 422 "Invalid request body". Card now shows the real validation message | #1545 |
| Cat | Draft cards for other types | Works by design / unverified per type | only services use a non-`price` field; other types not yet published end-to-end from a live Cat draft | — |
| Projects | Contact the creator | **Fixed** | read top-level `conversationId` from `{data:{conversationId}}` → `/messages?id=undefined` → "Couldn't load messages" | #1546 |
| Messages | `/messages?id=undefined` | **Fixed** | treated as no conversation | #1546 |
| Messages | New message picker | **Improved** | hides unnamed `user_xxxx` placeholders without a search, ranks named+photo first, "Talk to Cat" row | #1548 |
| Messages | Empty state | **Improved** | explains the page; New chat + Talk to Cat | #1548 |
| Messages | Read receipts (✓ / ✓✓) | **Fixed** | UI existed, but RLS let a member read only their own `conversation_participants` row, so the other side's `last_read_at` was invisible | #1549 |
| Messages | Voice notes | **Missing** (feature) | not built — see Backlog | — |
| Messages | Invite Cat / agents into a conversation | **Undiscoverable** (feature) | see Backlog | — |
| Timeline | Post on an empty own timeline | **Fixed** | `TimelineView` returned the empty state before rendering the composer | #1547 |
| My things | Empty state | **Fixed** | bespoke native form → shared `DashboardIntent` (chatkit `Composer`) + examples | #1546 |
| Collaborate | "No open roles yet" dead end | **Fixed** | shared `EmptyState` + explanation + Create a project / Post a role | #1546 |
| Layout | Horizontal overflow on phone (12 main pages) | Works | 0px overflow at 390px | — |
| Pay | `/pay/cato` desktop + phone | Works | renders amount, presets, "Show the code" | — |
| Nav | Every sidebar link (desktop) | Works (200, no 4xx/5xx) | crawl of 20 signed-in routes | — |

## Duplicated / bespoke UI found (shared-package debt)

- `TheDoor` (native GET form) vs `DashboardIntent` (chatkit `Composer`): two
  "What do you want to do?" boxes. Signed-in surfaces should use
  `DashboardIntent`; `TheDoor` stays only where no JS / signed-out is required
  (`/what-you-can-do`).
- Empty states: `components/ui/EmptyState` exists but many pages hand-roll
  `<Card><p>No … yet</p></Card>`. Grep `No .* yet` under `src/app` and move them
  to `EmptyState` with an explanation + primary action.
- Sidebar header (`ContextSwitcher`) and user menu in the top bar both carry
  profile actions; keep one "View my profile" path in each, same target.

## Backlog (not done yet, in priority order)

1. Empty-state sweep to the shared `EmptyState` (every page: what it is for +
   primary action + optional example).
2. Sidebar IA review: unclear items (Tasks / Analytics / Bookings, "Your civic
   split", "Set up for someone") — group under clear headings with one-line
   descriptions; the new-user sidebar shows only 6 items + collapsed
   People/Work/More groups.
3. Messages: voice notes (record/send/play, Supabase storage with
   per-conversation RLS); "Ask Cat / @ to invite an agent" in the composer and
   empty state; live (realtime) refresh of read ticks without reload.
4. Verify every Cat draft type end-to-end (product, project, event, cause,
   asset, loan, wishlist) from a live Cat draft.
