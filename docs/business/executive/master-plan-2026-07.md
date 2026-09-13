# OrangeCat × Loki — Master Plan (July 2026)

**Status:** Proposed — supersedes `strategic-plan.md` (Dec 2025) where they conflict
**Basis:** Full-codebase inspection (OC + FC repos), docs/blog audit, live-site outsider audit, and production DB ground truth, all conducted 2026-07-02.

---

> ## ⏱️ Status update — 2026-07-20 (code ground truth)
>
> Re-verified this plan against the codebase. **Most of the code-ownable work is
> already shipped; the plan's own tables lagged reality.** The critical path is
> unchanged and it is not engineering — it is Phase 0.1 (the platform wallet).
>
> **Done (verified in code):**
>
> - **2.1 Cat Credit `usage` metering** — wired (`chat-orchestrator.ts` → `meterCreditUsage`) **and now tested** (PR #405: assistant-charge + top-up + ledger-wrapper, 46 money-path assertions).
> - **3.2 generic edit** — done: `EntityCreateEditPage` + `useEntityCreateEdit` (`?edit=<id>`) across 13 entity types (the "3 of 15" figure was stale).
> - **3.3 entity detail redesign** — done for all marketplace types via `PublicEntityDetailPage`; the flat column-dump is deleted. Wishlist owner page was the last holdout → PR #406. **(SSR `/discover` is still `'use client'` — the SEO/crawler half of 3.3 is still open.)**
> - **0.3 fee copy** — reconciled to one SSOT (`FEE_CLAIMS` in `config/landing-page.ts`); 0% = P2P, 95% = Cat-Credits/paid-AI. No user-facing contradiction. _(But see 2.4 — `strategic-plan.md` still says "transaction fees"; not yet reconciled.)_
> - **Hardening:** dead 7,468-line `database.generated.ts` deleted; status-label + `AiService` SSOT collapse done (`4dd6465e`, straggler PR #407); money-path tests (4.1, money half).
> - **Phase 1 (FC⇄OC bridge)** continues shipping: FC feedback widget embedded as "customer #2", notify-sibling on settled project/cause funding (commits `415d5177`, `24089501`).
>
> **Still open — the real backlog:**
>
> - **0.1 `PLATFORM_NWC_URI`** (founder) — the single blocker. Go-live is env-driven: set it on the box → `npx tsx scripts/bitcoin/verify-platform-wallet.ts` → `NEXT_PUBLIC_CAT_CREDITS_LIVE=true` → one live top-up. Unblocks top-ups + frontier metering + paid-assistant 95/5 at once. **0.2** (first real payment) and **2.2** (first live top-up) are gated on this.
> - **2.4** reconcile `strategic-plan.md` §Business Model (still claims transaction fees — line 22); **2.5** Swiss attorney (founder).
> - **3.3** SSR `/discover`; **3.4** search across all entity types; **3.5** LNURL-verify; **3.6** seed real supply; **3.1** Cat economic interviewer (partially built: `economic-profile.ts` + interview handler).
> - **4.3** dead `MockPaymentProvider` stack still present; **4.1** OIDC/governance test coverage; **4.2** remaining `AnySupabaseClient` casts.
>
> Bottom line: **one founder env action stands between OrangeCat and its first-ever
> economic event.** Everything downstream of it is wired and, for the money paths,
> tested.

---

## 1. Ground Truth (2026-07-02)

### Usage (production DB, supabase.orangecat.ch)

| Metric                           | Value                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------ |
| Registered users                 | 44 (12 signed up last 30d, 13 active last 30d)                                 |
| Entities (all 15 types combined) | ~50 (6 products, 11 services, 6 projects, 4 causes, 6 groups, 5 assistants, …) |
| **Completed payments, ever**     | **0** (1 expired intent, 1 stuck at `invoice_ready`, both a single April test) |
| Cat conversations / messages     | 12 / 36                                                                        |
| DMs                              | 176 across 110 conversations                                                   |
| OAuth clients                    | 1 (Loki)                                                                 |
| Stakeholder edges                | 1 (Loki = customer)                                                      |

### Technology (what actually works)

The plumbing is unusually far along. Working end-to-end **in code**:
create+view for all 15 entity types (registry-driven generic CRUD), a production-grade
**OIDC identity provider** (PKCE, refresh rotation, JWKS, hashed secrets — live, Loki
registered), a real payment orchestration (`paymentFlowService`: NWC and on-chain
auto-verify; LNURL falls back to buyer-confirm), governance that tallies votes and
**auto-executes** passed proposals, full messaging/timeline/notifications, and a Cat with
29 implemented actions, tool use, pgvector memory, offer engine, and demand signals.

Loops that are ~80% wired but **do not close**:

1. **Cat Credits** — ledger + Lightning top-up built; the chat path **never spends credits**
   (`'usage'` ledger kind defined, never written). Top-up itself gated on unset
   `PLATFORM_NWC_URI`.
2. **Identity bridge** — OC side (OIDC provider) shipped; **Loki side unbuilt**
   (no OrangeCat provider in FC's Auth.js, no `orangecatActorId` column). FC docs still
   call the whole thing "not yet built" — stale.
3. **Publish bus** — OC ingest endpoint (`POST /api/v1/timeline/publish`, idempotent,
   scoped) is live; the **Loki emit half is unbuilt**. Today's only live integration
   is a one-way subscription→service mirror over a single shared service key.
4. **Edit UX** — only 3 of 15 entity types have a human edit form.
5. **Payments in production** — code paths exist; nothing has ever settled.

Debt: money/security paths under-tested (0 dedicated tests for OIDC flows and
governance execution; 5 for payments); newest tables (`oauth_*`, `cat_credit_*`,
`stakeholder_relationships`) untyped via `AnySupabaseClient` casts; repeated corrective
schema-drift migrations; dead `MockPaymentProvider` stack; all settlement is polling;
box disk at 91%.

### Business (what the docs actually say)

- **Revenue model is undefined and self-contradictory.** `strategic-plan.md` claims
  "percentage-based fees on Bitcoin transactions"; `legal-compliance-overview.md` rests
  the entire low-regulatory-risk posture on the platform **never touching funds**; the
  live landing page advertises **"0% fees / 100% to creator"**; a Dec 2025 blog post says
  95%. All four cannot be true.
- No pricing, no tiers defined (a `user_plans` table exists with no documented plans),
  no financials, no CAC/funnel.
- ICP is split-brained: Dec 2025 personas (doctors, lawyers, artists — fictional,
  AI-generated) vs the June 2026 blog thesis (AI-assisted solo builders). Never reconciled.
- BitBaum AG is claimed publicly as owner but listed internally as an unstarted TODO.
- Loki's business is conventional and coherent: tiered SaaS (Stripe today),
  ICP = builders running agent fleets, raising money.

### Outside view (live sites)

Message is clear and credible; the social-proof layer says "pre-launch": ~16 public
items on Discover, two of three flagship projects are OrangeCat and Loki
themselves, "Test Organization" debris in public listings, Discover ships zero HTML
(client-rendered → invisible to search engines and AI crawlers), Loki shows no
pricing and doesn't surface "Login with OrangeCat".

---

## 2. Diagnosis

Three problems, in causal order:

1. **No loop has ever closed.** The platform's thesis is economic participation, and
   zero economic events have completed on it. Everything else is downstream of this.
   The constraint is not missing features — it is that the existing 80%-wired loops
   (payment, credits, identity bridge, publish bus) were each stopped one step short.

2. **The business model contradicts itself.** You cannot simultaneously be non-custodial
   ("we never touch funds"), advertise 0% fees, and plan to earn % of transactions.
   One of these must be dropped — and the codebase has already voted: the only
   monetization actually built is **Cat Credits** (prepaid, Bitcoin-paid AI) and the
   **95/5 paid-assistant split** — both are "selling intelligence", not "taxing rails".

3. **No distribution, and the marketplace cold-start is being fought head-on.**
   44 users cannot make a marketplace liquid. But OrangeCat doesn't need liquidity to
   be useful: a profile + wallet + Cat + published offers is valuable to **one person
   alone**. The distribution engine that exists and is being ignored is Loki —
   its audience is exactly OC's ICP, and the founder's own build-in-public loop is the
   demo. "FC emits, OC distributes" is the right thesis; it just isn't wired.

---

## 3. Strategy

### 3.1 What OrangeCat is (positioning, sharpened)

**Single-player first, marketplace second.** OrangeCat is your public economic
homepage plus an AI agent that runs it: a page, a wallet, and a Cat that interviews
you, packages what you can offer, publishes it, and handles the money — pseudonymously,
in Bitcoin or anything else, with 0% platform fees. Network effects (discovery,
matchmaking, funding) compound later; the product must be worth signing up for at N=1.

### 3.2 The division of labor with Loki

- **Loki = the revenue engine.** Conventional SaaS, clear ICP, Stripe now,
  per-seat later. It pays the bills and acquires the users.
- **OrangeCat = the moat and the upside.** It is what makes Loki different from
  every other agent-orchestration tool (your fleet's output gets a public face, a
  wallet, funding, and customers), and it owns the long-term "economic layer for
  AI-assisted individuals" position.
- **The integration is the product.** Neither is compelling enough alone at current
  scale; the closed loop (build in FC → publish to OC → get funded/paid on OC → fund
  more building) is the story no competitor tells.

Consequence: **do not burden OrangeCat with near-term revenue targets.** Burden it
with _closed loops and activation_. Loki carries revenue; OrangeCat carries proof.

### 3.3 The business model (resolves the contradiction)

Adopt "**sell intelligence, not rails**" as the codified model:

1. **Peer-to-peer payments: 0% forever, non-custodial.** This stays the marketing
   wedge and keeps the legal posture coherent (platform never processes funds;
   NWC/LNURL/on-chain settle wallet-to-wallet).
2. **Cat Credits (built, needs wiring):** prepaid Lightning top-ups spent on
   frontier-model Cat usage. Platform margin lives in the credit price. This is
   selling _your own service_, not payment processing — legally clean.
3. **Supporter plan** (use the existing `user_plans` table): flat CHF 10/month or
   10k sats — monthly frontier-Cat allowance, priority support, supporter badge.
   Keep it to exactly two tiers: Free and Supporter.
4. **Paid AI assistants:** 95/5 creator split (already built) — the only take-rate,
   and it's on platform-mediated AI services, not P2P money.
5. **Loki as first customer:** its value is _proof and distribution_, not
   revenue. Long-term: FC settles its own billing over OC rails ("Lightning rails,
   no Stripe in the path") — that's the roadmap demonstration, not a 2026 revenue line.

**Kill** the "% of Bitcoin transactions" line from `strategic-plan.md`. **Reconcile**
public copy to one claim: 0% platform fees on payments; we make money when you use
frontier AI.

### 3.4 ICP and go-to-market

**ICP (narrowed):** AI-assisted solo builders and micro-studios — people already
shipping with agents who need a public economic presence without a company, a Stripe
account, or a real name. Secondary: Swiss Bitcoin community (local, reachable,
values-aligned). **Drop** the doctors/lawyers persona set.

Channels, in order of leverage:

1. **The founder's own machine as the demo.** Every FC-built project auto-publishes
   to OC; weekly build-in-public posts; the OC timeline becomes living proof. This is
   free and differentiated — do it before any paid channel.
2. **Loki cross-sell** (per the bridge spec's detect-and-suggest): after FC
   onboarding → "Claim your public profile + wallet on OrangeCat" — one click via the
   identity bridge.
3. **Seed real supply from the real portfolio.** The founder's orbit (RevampIT and
   the ~15 projects in ~/dev) contains genuinely sellable products/services. 20–30
   real entities with real wallets makes Discover look alive because it _is_ alive.
4. **Zurich/Swiss Bitcoin community**: meetups, Bitcoin Association Switzerland,
   hand-onboard the first 10 external users personally.
5. **SEO/AI-discoverability**: SSR Discover + entity pages. Every public entity is a
   landing page; today crawlers see nothing.

**The activation moment** (the north-star flow, spec'd in
`cat-economic-interviewer.md` + `economic-agent-capability.md`): sign up → Cat
interviews you ("what do people ask you for help with?") → proposes 3 grounded offers →
one click publishes → wallet attached → shareable page. Target: **median
signup→first-published-offer under 15 minutes**, and the second metric that matters:
**time to first sat received**.

---

## 4. The Plan

Sequencing rule: **one loop closed end-to-end beats ten features at 80%.** Phases are
ordered by dependency; each ends with a public, verifiable proof.

### Phase 0 — Close the money loop (days) 🔴

The whole thesis is unproven until one payment settles.

| #   | Item                                                                                                                                                                                | Owner   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0.1 | **Provision `PLATFORM_NWC_URI`** (Alby Hub or NWC-capable wallet for the platform) — the single blocker named in every audit; unblocks Cat Credit top-ups and paid assistants       | Founder |
| 0.2 | Execute one real payment end-to-end in production for each pattern: fixed-price product (NWC), contribution (on-chain or LNURL). Fix whatever breaks. **Payments-ever goes 0 → ≥2** | Agent   |
| 0.3 | Trust scrub: hide/delete "Test Organization" groups from public listings; reconcile 0%-vs-95% copy; fix "Loading blog posts…" artifact                                              | Agent   |
| 0.4 | Box hygiene: disk at 91% — clean; verify off-site backup path (B2) for the supabase-db container dump                                                                               | Agent   |

**Proof:** a real invoice paid on orangecat.ch, screenshotted, blogged.

### Phase 1 — Wire the machine: FC ⇄ OC (2–3 weeks) 🟠

The bridge spec (`loki/docs/architecture/cross-product-identity-bridge.md`) is
correct and its build order stands — except step 1 is already half-done (OC's OIDC
provider is live). Remaining work is mostly FC-side:

> **Status update 2026-07-02 (from the Loki tab):** 1.1, 1.3, and 1.4
> SHIPPED same day this plan was written (FC PR #55, commits `6e96bce` +
> `b879625`; token-auth-method fix `7bdf0c9`). 1.2 is effectively satisfied via
> per-user OIDC bearer tokens with refresh rotation (`orangecat-identity.ts`)
> instead of `ock_` keys. 1.6 done. Still open: 1.5 (FC-side wallet/funding
> read surface), plus FC-side backfill job and settings-connect (tracked in
> `loki/docs/master-plan-2026-07.md`, the FC counterpart to this plan).

| #   | Item                                                                                                                                                                                                           | Where   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1.1 | "Login with OrangeCat" in Loki: custom Auth.js OIDC provider against orangecat.ch, `users.orangecatActorId` column, account-linking UI; surface the button on FC's sign-in                               | FC      |
| 1.2 | One-consent capability grant: authorize flow mints actor-bound `ock_` key, replacing the shared service-account key                                                                                            | FC + OC |
| 1.3 | "Publish to OrangeCat" per FC project → creates/links OC project entity (`user_projects.orangecatProjectId`)                                                                                                   | FC      |
| 1.4 | FC emit half of the publish bus: config-driven promote step → `POST /api/v1/timeline/publish` (OC ingest already live; async, idempotent `dedupe_key`)                                                         | FC      |
| 1.5 | Surface both directions: OC timeline/home feed shows FC build events; FC project page shows OC wallet/funding state (read via API — defer iframe embeds until pain is real, per PLATFORM_AND_COLLABORATION.md) | Both    |
| 1.6 | Update FC's stale integration docs to reflect OC OIDC reality                                                                                                                                                  | FC      |

**Proof:** the Loki project page on orangecat.ch shows a live stream of real
build events, and a Loki user signs in with OrangeCat.

### Phase 2 — Monetization coherence (2 weeks) 🟠

| #   | Item                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Wire Cat Credit **`'usage'` metering** into `chat-orchestrator.ts`: frontier-tier requests debit the ledger; free tier stays on platform quota. The pay-Bitcoin-for-AI loop closes                                                      |
| 2.2 | First live top-up test (founder, real sats) — Cat Credits Phase 2 exit criterion                                                                                                                                                        |
| 2.3 | Define Free/Supporter in `user_plans` + pricing page on orangecat.ch; Loki publishes its pricing page (currently none — a trust gap)                                                                                              |
| 2.4 | Rewrite `strategic-plan.md` §Business Model to this document's §3.3; delete the transaction-fee claim; align legal doc (credits = prepaid service, not payment processing)                                                              |
| 2.5 | Founder decision: engage a Swiss attorney on (a) credits/prepaid model, (b) the **loans** feature vs Consumer Credit Act — consider unlisting P2P loans publicly until reviewed, (c) BitBaum AG — register it or scrub the public claim |

**Proof:** first franc/sat of platform revenue in the credit ledger.

### Phase 3 — Activation + supply (4–6 weeks) 🟡

| #   | Item                                                                                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | **Cat economic interviewer** (spec exists; remove the system-prompt prohibition): the signup→interview→3 offers→publish flow. This is the product's magic moment      |
| 3.2 | **Registry-driven generic edit form** — one component, all 15 entity types (the architecture begs for it; closes the create-but-can't-edit gap)                       |
| 3.3 | SSR `/discover` + entity detail pages (SEO/AI-crawler visibility); implement `entity-detail-redesign.md` (founder already flagged detail pages as "useless and ugly") |
| 3.4 | Search across **all** entity types (today: effectively profiles/projects/loans despite embeddings existing)                                                           |
| 3.5 | LNURL-verify (LUD-21) where the receiving wallet supports it — trustless lightning-address settlement instead of "I've paid"                                          |
| 3.6 | Seed 20–30 real entities from the founder's real portfolio with real wallets; hand-onboard first 10 external users (Zurich Bitcoin community)                         |
| 3.7 | Weekly build-in-public cadence: FC events on OC timeline + a blog post; the two-layer format of `your-most-valuable-skill.mdx` is the template                        |

**Proof:** 10 external users each with a published offer; ≥1 stranger-to-stranger payment.

### Phase 4 — Hardening (ongoing, parallel) 🟢

| #   | Item                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Tests on money/security paths first: payment E2E (all 3 methods), OIDC flows (code replay, PKCE, rotation), governance auto-execution. Target: no untested path that moves money or grants identity |
| 4.2 | Regenerate DB types; eliminate `AnySupabaseClient` casts on `oauth_*`, `cat_credit_*`, `stakeholder_relationships`                                                                                  |
| 4.3 | Delete the dead `MockPaymentProvider`/`getPaymentProvider()` stack                                                                                                                                  |
| 4.4 | Migration auto-apply on deploy (root cause of the repeated drift-remediation migrations; sovereign-infra P0)                                                                                        |
| 4.5 | Fix the ~27 tables missing from `DATABASE_TABLES` SSOT; split the 7 >500-LOC service files as touched                                                                                               |
| 4.6 | Later, at scale: webhook/event settlement instead of polling; iframe embed routes when FC actually needs them                                                                                       |

---

## 5. What "working perfectly" means (success metrics, 90 days)

| Metric                                | Now   | Day 90 target                       |
| ------------------------------------- | ----- | ----------------------------------- |
| Completed payments (cumulative)       | 0     | ≥ 50                                |
| External users with a published offer | ~0    | ≥ 10                                |
| Median signup → first published offer | n/a   | < 15 min                            |
| Users who received ≥1 sat             | 0     | ≥ 10                                |
| FC public projects publishing to OC   | 0     | 100%                                |
| Cat Credit revenue                    | 0     | > 0, ≥ 5 paying users               |
| Money-path test coverage              | ~thin | payment/OIDC/governance all covered |
| Public copy contradictions            | 3+    | 0                                   |

Technology "perfect" = every advertised loop closes and is tested; deploys apply
migrations automatically; no drift; no dead payment code. Business "perfect" = one
coherent, legal, built model (0% rails, paid intelligence) with public pricing and a
narrowed ICP, distributed through Loki and the founder's own loop.

---

## 6. Risks & honest constraints

- **Marketplace cold start** — mitigated by single-player-first positioning; do not
  measure OC on liquidity in 2026, measure it on activation.
- **Solo founder bandwidth** — the phases are strictly sequential for a reason; agents
  can execute nearly all engineering items, but 0.1 (NWC), 2.2 (real-sats test), 2.5
  (legal/AG), and 3.6 (community onboarding) are founder-only.
- **Regulatory** — the loans feature is the sharpest edge (Swiss Consumer Credit Act);
  credits model is defensible but should be attorney-reviewed before scale.
- **Free-tier AI cost** — platform quota + rate-limit fallback chain already bound it;
  wire usage metering (2.1) before promoting frontier features.
- **Aspirational public claims** (DAO multisig/quadratic voting, "wired in production",
  BitBaum AG) — either build, or soften the copy. Credibility is the scarcest asset at
  44 users. The blog's honesty norm (label what's roadmap) should apply retroactively.
- **Any-currency promise** — keep the claim, don't build Twint/PayPal yet (YAGNI);
  Lightning first-class is the wedge.

---

## 7. Decisions needed from the founder

1. **Provision the platform NWC wallet** (Phase 0.1) — everything paid is behind it.
2. **Sign off the business model** (§3.3): 0% rails + paid intelligence; kill the
   transaction-fee model.
3. **Pricing numbers** for Supporter (proposal: CHF 10/mo or 10k sats).
4. **ICP narrowing**: retire the Dec 2025 personas.
5. **Legal**: attorney engagement scope; loans feature exposure; BitBaum AG register-or-scrub.
6. **Green-light Phase 1** (FC-side identity bridge) — it's the highest-leverage
   engineering block and it's ready to build today.
