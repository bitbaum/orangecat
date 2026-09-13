# Spec — Cat Economic Loop (Workstream C, one-week plan)

**Date:** 2026-07-13
**Status:** Ready to build. Derived from a full code map of the current flow.
**TL;DR:** The "talk → published → payable" loop **already works end-to-end** for cause / project / product — real Lightning invoices and all. The gaps are **surfacing and one silent dead-end (wallet-at-publish)**, not missing plumbing. So Workstream C is smaller than the plan assumed. Highest-leverage move: **make the Cat the default surface** so the loop actually gets entered.

## What already works (don't rebuild)

| Stage                | State                                                                                                                                                          | Key files                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Intent → proposal    | ✅ Two-stage tool pipeline; `prefill_entity_form` + `suggest_offers` produce prefilled cards with per-field confidence. cause/project/product all prefillable. | `services/cat/tool-use-detection.ts`, `tool-executor.ts`, `lib/ai/form-prefill-service.ts`, `services/cat/offer-engine.ts`  |
| Proposal → published | ✅ **Inline publish** from the chat card — POST draft → PUT live, no nav/wizard, ~1 click. (The "skip template-picker" TODO is already closed.)                | `components/ai-chat/ModernChatPanel/components/PrefilledFormCard.tsx`, `hooks/useCreatePrefill.ts`                          |
| Published → payable  | ✅ **Real** invoices: NWC (BOLT11 via Nostr), Lightning Address (LNURL-pay), on-chain (BIP21). Cause/project = open contribution; product = fixed price.       | `components/payment/PublicEntityPaymentSection.tsx`, `domain/payments/paymentFlowService.ts`, `invoiceGenerationService.ts` |
| Cat-first surface    | ⚠️ **The real gap.** Cat lives at `/dashboard/cat`; `/dashboard` shows timeline/projects. Not the default landing.                                             | `app/(authenticated)/dashboard/page.tsx`, `dashboard/cat/page.tsx`                                                          |

## The build list (ranked by leverage)

### C-1 — Make the Cat the default `/dashboard` surface ⭐ highest leverage

The loop works; it just isn't what users land on. Two options:

- **Option A (cheapest, ~1 line):** always `router.replace(ROUTES.DASHBOARD.CAT)` from `/dashboard` (drop the `isTrulyEmpty` guard at `dashboard/page.tsx:59-82`). Ship this first — it's reversible and instantly makes OC feel Cat-first.
- **Option B (better, more layout):** embed `ModernChatPanel` as the hero of `/dashboard`, dashboard sections secondary. `ModernChatPanel` is already reusable (`variant`, `conversationId`, callbacks).
  **Recommendation:** ship A this week; consider B next week. **Decision needed from founder:** redirect (A) vs hero-embed (B)?

### C-2 — Close the wallet-at-publish dead-end ⭐ demo-critical

Today an owner can publish a cause/project/product with **no wallet connected** → it's born **unpayable** and they're never told. "Published" and "payable" silently diverge. For the Loki demo (Workstream D) this looks broken.

- Gate/strongly-nudge a payment method at publish in `PrefilledFormCard` publish flow (and the create form). Minimum: after publish, if no wallet, show a prominent "Connect a wallet to get paid" step instead of a plain success link.
- Wallet field exists at create (`wallet-field-group.ts`, present on all three configs incl. `product-config.ts:127`) — it's just **optional**. This is a nudge/gate, not new UI.

### C-3 — Seed the Cat surface with 3 one-tap starter prompts

On the (now-default) Cat surface: "Start a fundraiser", "Sell something I make", "Raise money for a cause" → straight into `prefill_entity_form`. Uses existing `quick_replies`/nudge machinery. Turns the landing into an on-ramp.

### C-4 — Make the success card show the payable public link + its state

`PrefilledFormCard` success (L184-205) currently links to the owner list view. Instead: "Here's your public page — it's payable ✅ / connect a wallet to make it payable." Closes the loop visibly.

### C-5 — (optional) Collapse project's fallback wizard for prefilled drafts

`useEntityCreationWizard.ts:49` — jump prefilled projects to the final step so the "Open full form" fallback matches cause/product's 3 clicks. Low priority (inline card already bypasses the wizard).

## Decisions / cleanup

- **Double down on the inline `PrefilledFormCard` path.** Treat the wizard "Open full form" as pure fallback. All C work optimizes the inline path.
- **Delete legacy dead code** (separate cleanup commit, not on the critical path): `CAT_ACTIONS` create actions (`config/cat-actions.ts`, superseded by the tool pipeline) and `ProjectDonationSection.tsx` (superseded by `PublicEntityPaymentSection`). They're confusion risks; don't build on them.

## Risks

- **Prefill quality depends on Groq/OpenRouter keys** (`offer-engine.ts`, `form-prefill-service.ts`). Degrades gracefully to "Cat just answers" but produces **no cards** if keys/models are down → **verify keys on the box before any live demo.**
- **Wallet is the true gate on "payable."** Without C-2, the demo can look broken even though the code is correct.
- Two publish paths coexist — keep the spec's focus on the inline card to avoid divergence.

## Sequencing (fits the one-week plan, Days 3–5)

1. **C-1 Option A** (Cat default surface) — ship first, instant Cat-first feel.
2. **C-2** (wallet-at-publish nudge) — before the Loki demo.
3. **C-3** (starter prompts) + **C-4** (payable success card).
4. C-5 + legacy cleanup if time permits.

**Definition of done:** a first-time user lands in the Cat, taps "Start a fundraiser", edits one line, hits Publish, and sees a live public page with a working pay button — in under a minute, without touching the nav.
