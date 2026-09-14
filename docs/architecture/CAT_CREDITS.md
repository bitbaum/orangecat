# Cat Credits — Bitcoin-paid access to frontier models

---

created_date: 2026-06-25
last_modified_date: 2026-07-08
last_modified_summary: Wire Cat Credits usage metering to OpenRouter’s real per-request cost and refresh the 2026 model roster.

---

**Status:** Phases 1–2 built (ledger + Lightning top-up). Authored 2026-06-25.
**Companion to:** the Settings → AI "sovereignty ladder" (Free → BYOK → Local) and the in-chat upgrade nudge (shipped).

## Decisions (locked 2026-06-25)

- **Denomination: BTC** (canonical unit, `NUMERIC(18,8)` = 1-sat precision). Sats appear ONLY at the Lightning protocol boundary (the `makeInvoice` call). _"Sats" are not a product concept._
- **Pricing: near-cost pass-through** — credits ≈ wholesale + a small disclosed spread; OC's margin is Supporter + platform activity, never inference markup.
- **Receive backend: platform NWC wallet** (`PLATFORM_NWC_URI`) — OC's own receiving wallet, abstracted so it can later point at self-hosted LNbits/BTCPay with no code change. Reuses the existing NWC client + polling-settlement pattern. (BTCPay/LNbits remain the "at scale / max sovereignty" graduation.)
- **Model backend (Phase 3): OpenRouter** = all models, one key/bill — _pending a TOS check on reselling_.
- **User funds stay non-custodial.** OC's receiving wallet only ever holds OC's own credit revenue; a user's credit balance is prepaid, non-withdrawable service credit (an entitlement to inference), not a holding of their bitcoin.

---

## 1. Why this exists

OrangeCat is **pseudonymous by default** and **Bitcoin-native**. BYOK (the path we have today) quietly violates both: to get an OpenRouter/Anthropic/OpenAI key you need a funded account = a credit card = fiat + identity. So a pseudonymous Bitcoin user **cannot reach frontier models at all** right now.

Cat Credits closes that gap: the user pays **OrangeCat in Bitcoin/Lightning**, OC meters usage against frontier models, no card, no per-provider accounts. It's the only upgrade path consistent with the platform's two deepest principles — and it makes sats _useful inside the product_.

**It does not replace BYOK or Local.** It's a new rung on the ladder, the one most users will actually take:

| Rung                      | Pays              | Pseudonymous? | OC liability           | For                        |
| ------------------------- | ----------------- | ------------- | ---------------------- | -------------------------- |
| Free (managed, capped)    | nobody            | yes           | inference (capped)     | everyone, baseline         |
| **OC Credits (this doc)** | **OC, in sats**   | **yes**       | **prepaid float only** | **most upgraders**         |
| BYOK                      | provider directly | no (card)     | none                   | power users                |
| Your own endpoint         | you (your server) | yes           | none                   | max sovereignty (ADR-0009) |
| Local                     | nobody            | yes           | none                   | run-it-yourself            |

---

## 2. Guiding principles (non-negotiable)

1. **Near cost, transparently.** Credits are priced at or barely above wholesale. OC's margin is **Supporter + platform activity, never inference markup** — the Settings page already promises "OrangeCat earns from platform activity, not your AI bill." Keep that promise. Disclose the rate.
2. **Denominated in BTC (canonical unit).** Balance is real BTC (`NUMERIC(18,8)`), shown via `useDisplayCurrency` (BTC or the user's currency). No funny-money "credits" abstraction. Sats appear only at the Lightning protocol boundary.
3. **Prepaid, single-purpose, non-withdrawable, non-refundable service credit.** Credits buy Cat inference and nothing else; they can never be cashed out or transferred. This is the key design constraint that keeps it _prepaid service credit_ (like buying API credits) rather than _stored value / a wallet_ — materially lowering custody/money-transmission exposure. **Flag for legal review regardless.**
4. **Ledger is the source of truth.** Balance is derived from an append-only ledger, never a free-floating mutable number (Ground Truth #2 — no state in two places).
5. **Graceful, never hard-fail.** Out of credits → fall back to the free model + offer top-up. Never a dead end.

---

## 3. Data model

### `cat_credit_entries` (append-only ledger — SSOT)

```
id                uuid pk
seq               bigint identity   -- monotonic order (created_at ties within a txn)
user_id           uuid not null → auth.users (RLS: read own)
kind              text  -- 'topup' | 'usage' | 'grant' | 'refund' | 'adjustment'
amount_btc        numeric(18,8) not null  -- signed: + topup/grant/refund, − usage
balance_after_btc numeric(18,8) not null  -- running balance (set atomically)
ref               text  -- lightning payment hash (topup) | cat_messages.id (usage)
metadata          jsonb
created_at        timestamptz default now()

unique (kind, ref) where ref is not null   -- idempotency: a payment/message credits once
index (user_id, seq desc)
```

- **Balance** = `balance_after` of the latest row (O(1) read), with `SUM(amount_sats)` as the reconciliation check. Optionally a thin `cat_credit_balances` cache row, rebuilt from the ledger — but the ledger is truth.
- Writes are **server-only** (service role); RLS lets a user read their own entries (for the history view) but never insert.
- Every debit/credit happens in a transaction that reads current balance, writes the entry with the new `balance_after`, and (for usage) refuses to go negative.

---

## 4. Flows

### Top-up (Lightning)

1. User picks an amount (presets: 5k / 20k / 100k sats, or custom).
2. OC generates a Lightning invoice for N sats (reuse existing Lightning/BTCPay/NWC infra).
3. On payment confirmation (webhook/callback), append a `topup` entry `+N`, **idempotent on the payment hash** (`unique(kind, ref)` — webhook retries can't double-credit).
4. UI reflects the new balance.

### Usage (metered debit)

1. A frontier request runs on **OC's managed OpenRouter key** (see §5).
2. OpenRouter now returns a per-request `usage.cost` field (USD) alongside token counts. The platform:
   - converts that real request cost → BTC at the live rate (`convertFromBTC`),
   - applies pricing policy (§2.1) as a markup on top of the raw BTC cost, and
   - appends a `usage` entry `−cost` referencing `cat_messages.id`.
3. If OpenRouter omits `usage.cost` (older responses, non-OpenRouter providers), the system falls back to the curated model registry (`AI_MODEL_REGISTRY`) to estimate cost from token counts.
4. Done **after** the response, like `saveMessages` — non-blocking, in a balance-guarding transaction. Ledger metadata records whether each debit used `provider_reported` or `registry_estimate` pricing.

### Pre-flight gate

Before serving a frontier request on credits: if `balance ≤ estimatedCost` → **don't fail**: serve on the free model and surface "you're low on credits — top up?" (the existing upgrade-nudge funnel, inverted).

---

## 5. Resolver integration

The provider-resolver chain today is: per-request header keys → stored BYOK keys (ordered) → platform free default (positioned). Add a **Credits** step:

- Precedence: **BYOK still leads** when present (user pays the provider directly — cheaper for them, zero OC liability). Credits is for users _without_ BYOK who want frontier.
- Logic: if no BYOK key for a frontier model **and** `creditBalance > 0` **and** the request targets a frontier model (explicit pick or "auto-frontier") → route via OC's managed OpenRouter key, tag the call `meteredToCredits: true`.
- The **free platform default (gpt-oss) stays the zero-cost baseline.** Credits are only ever spent on an explicitly-better model — never silently.

Backend = **OpenRouter as wholesale** (one key, 200+ models incl. Claude/GPT/Grok, one bill OC pays). ⚠️ **Confirm OpenRouter TOS permits reselling capacity in a managed offering** before building (Phase 0 blocker).

---

## 6. Supporter integration (the on-thesis monetization)

- Supporter includes a **monthly sat allowance** (a recurring `grant` ledger entry) and/or a better effective rate.
- This is how paying OC aligns with "earn from platform activity, not your AI bill": **becoming a Supporter is platform activity.** One-off Lightning top-ups stay available for free users.
- Pricing page already has a "Pro (waitlist)" slot — Credits + allowance is what fills it.

---

## 7. UX surfaces

- **Settings → AI:** new "OC Credits (pay with Bitcoin)" rung between Free and BYOK — balance (sats + fiat), top-up (Lightning invoice/QR), usage history (the ledger), and which frontier model to spend on.
- **QuotaMeter chip:** shows credit balance when on the Credits path (today it shows free-message quota).
- **Upgrade nudge (shipped):** already links to Settings → AI; once Credits ships, that's where it funnels.
- **Cat itself (later):** low-balance prompt mid-task ("you're low on credits — top up?").

---

## 8. Risks & open questions (need founder calls)

| #   | Question                                                          | Recommendation                                                                                                                     |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **OpenRouter resale TOS**                                         | Confirm before any build. Blocker. Fallback: OC-held direct provider keys.                                                         |
| R2  | **Custody / money-transmission** for holding prepaid sat balances | Keep credits **non-withdrawable, single-purpose, non-refundable** (→ service credit, not stored value). Get legal eyes regardless. |
| R3  | **Pricing: pass-through vs thin margin**                          | Default near-cost; a small disclosed spread (Lightning fees, float, abuse) is defensible. Never a markup business.                 |
| R4  | **Sats vs abstract credits**                                      | Sats, 1:1. Honest + Bitcoin-native.                                                                                                |
| R5  | **Abuse / cost exposure**                                         | Prepaid float caps it; reuse existing per-user rate limits; cap max balance/top-up.                                                |

---

## 9. Phased build plan

- **Phase 0 — decisions (no code):** R1 (OpenRouter TOS), R2 (legal sanity), R3 (pricing), Supporter allowance amount.
- **Phase 1 — ledger:** `cat_credit_entries` migration + balance read + read-only Settings UI (balance + history). No spending.
- **Phase 2 — top-up:** Lightning invoice + payment webhook → idempotent `topup` entry.
- **Phase 3 — metering + routing:** resolver Credits path + post-response usage debit (costBtc→sats) + pre-flight gate + free-model fallback. Credits now buy frontier inference.
- **Phase 4 — Supporter:** monthly `grant` entries + better rate, tied to Supporter status.
- **Phase 5 — polish:** low-balance Cat prompts, QuotaMeter credit display, top-up presets.

Each phase is independently shippable and reuses existing infra (Lightning, provider-resolver, `costBtc`, currency converter, QuotaMeter). The genuinely new build is the ledger + top-up webhook + metering debit; everything else is wiring.
