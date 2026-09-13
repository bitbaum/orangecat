# Spike — First Fiat Rail (TWINT, Swiss-first)

**Date:** 2026-07-13
**Type:** Research + integration plan (the one-week plan's "half-day Twint spike" — **no build this week**).
**Owner decision needed:** yes — this crosses a philosophical line (custody/KYC). See "The decision" at the end.

## Why

The mission says **any currency** — "meet users where they are." Today that's aspirational: OC settles **Bitcoin only** (`walletResolutionService` resolves NWC > Lightning Address > on-chain; there's a `profiles.payment_preferences` JSON field and a `loan_payments.payment_method` enum, but **no fiat rail** and no first-class `payment_methods` concept). For a Swiss-first launch (Loki), the single highest-impact fiat rail is **TWINT** — Switzerland's dominant mobile-payment method (6M+ users). A funder who has Twint but not a Bitcoin wallet currently **cannot pay at all**.

## The unavoidable tension (read this first)

Fiat rails cannot preserve all three of OC's values at once:

| Value                                  | Bitcoin path (today)             | Fiat/Twint path                                           |
| -------------------------------------- | -------------------------------- | --------------------------------------------------------- |
| Non-custodial (OC never holds funds)   | ✅ seller wallet receives direct | ⚠️ a regulated PSP/merchant-of-record holds + routes fiat |
| Pseudonymous                           | ✅ no identity required          | ❌ KYC on whoever _receives_ the fiat (the seller)        |
| Any currency / low-friction for payers | ❌ needs a BTC wallet            | ✅ pay with the app they already have                     |

**Conclusion:** fiat is opt-in and additive, never a replacement. Bitcoin stays the **default, non-custodial, pseudonymous** track. Fiat is a **second track** for sellers who _choose_ to KYC in exchange for reaching fiat-only buyers. This keeps the ethos intact while making "any currency" real for those who want it.

## Provider landscape

| Provider    | TWINT                                                         | Marketplace (split + payout + seller-KYC)                                                                                                       | Dev effort     | Fit                                                                                        |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| **Payrexx** | ✅ (auto-provisions Twint merchant acct, no bank application) | ✅ split payments, automated sub-merchant KYC onboarding, payouts; also PostFinance/cards/PayPal/QR-bill/**Bitcoin**; **white-label** available | Low–medium     | **Recommended** — Swiss-first, marketplace-native, one provider covers Twint→seller payout |
| Stripe      | ✅ (bank-redirect method)                                     | ✅ Stripe Connect                                                                                                                               | Low (great DX) | Fallback / international; lacks PostFinance & Reka                                         |
| Datatrans   | ✅ (deepest Twint/PostFinance)                                | ✅                                                                                                                                              | Higher         | Overkill until volume is large                                                             |

Twint economics (Payrexx Standard): **1.25% + CHF 0.18** per transaction.

## Two integration models

**Model A — PSP marketplace (fiat-native for fiat payers).** Buyer pays Twint → **Payrexx** receives, splits, and pays the **seller out in fiat** (to their bank). Seller is a Payrexx sub-merchant (KYC'd via Payrexx's automated onboarding). OC touches **no funds** — Payrexx is merchant-of-record. Simplest, fastest to the Swiss market, and it's exactly what a real business (Loki) wants. Cost: seller KYC + a bank account; fiat end-to-end (no BTC).

**Model B — Fiat-in → BTC-out bridge.** Buyer pays Twint → converted to BTC → seller receives BTC to their **existing** OC wallet. Preserves Bitcoin-native settlement _and_ seller pseudonymity (no bank/KYC for the seller). But: the conversion is a custodial moment, needs an on-ramp/OTC step, and the fiat-in leg likely still triggers KYC on the **payer** or OC. More complex; Payrexx's crypto product runs the _opposite_ direction (crypto-in → fiat-out), so this needs a different piece. **Defer** — it's the "have your cake" option but it's a bigger build and a heavier regulatory footprint.

**Recommendation: Model A, Loki-first.** Loki is a real Swiss business with a bank account, motivated to accept Twint, and willing to KYC. Pilot there. Bitcoin remains the default for everyone else. Revisit Model B once there's demand for pseudonymous fiat.

## How it plugs into OC (architecture)

The clean abstraction is the one the mission already implies — **`payment_methods` per seller**, not "a wallet":

1. **Extend seller receive-resolution.** `resolveSellerReceiveInfo` currently returns `{ method: 'nwc'|'lightning_address'|'onchain', address }`. Add a `method: 'fiat_psp'` variant carrying a PSP checkout handle (e.g. a Payrexx merchant/paylink id) for sellers who connected a fiat account. `PublicEntityPaymentSection`/`PublicPayPanel` then offer **both** "Pay with Bitcoin" and "Pay with TWINT" when both exist — payer chooses their rail.
2. **Seller opt-in.** A "Connect a fiat payout (TWINT/cards)" flow alongside the existing wallet connect — kicks off Payrexx sub-merchant onboarding (KYC handled by Payrexx). Stored as a new payment-method row, not on the wallet.
3. **Checkout + settlement.** For a fiat payment, create a Payrexx transaction (amount from the entity price, split to the seller sub-merchant), redirect/embed Payrexx's Twint checkout, and confirm settlement via Payrexx webhook — mirroring the existing `payment_intents` + polling pattern (`paymentFlowService`), just a new provider adapter.
4. **Reuse everything else.** Amount, presets, receipts, the payable/`sellerReceive` gating, the C-2 wallet nudge — all generalize from "has a wallet" to "has any payment method."

Blast radius is bounded: one new resolver branch, one new provider adapter, one seller-onboarding flow, one payer button. No change to the Bitcoin path.

## Requirements / blockers

- **Payrexx account** for OC (platform) — evaluate Standard vs white-label; confirm marketplace/split + sub-merchant KYC on the plan tier.
- **Legal/regulatory:** OC facilitating fiat marketplace payments in CH — confirm OC is _not_ the merchant-of-record (Payrexx is) so OC avoids money-transmitter/holding obligations. Get this checked before shipping.
- **Seller side:** bank account + KYC (Payrexx automated). Acceptable for Loki; a barrier for pseudonymous sellers (hence opt-in).
- **Fees + display:** show the payer the Twint total; decide who eats the 1.25%+0.18 (seller, usually).

## Phased plan

- **P0 (this spike — done):** pick TWINT + Payrexx (Model A), Loki-first, Bitcoin stays default. This doc.
- **P1 — Loki pilot (lowest code):** a Payrexx-hosted Twint pay-link for one Loki offering, surfaced on its OC entity page. Proves fiat-in end-to-end with near-zero platform code.
- **P2 — In-app checkout + split:** Payrexx API integration — `method: 'fiat_psp'` in the resolver, seller onboarding, `payment_intents` provider adapter, "Pay with TWINT" button. Generalize to any KYC'd seller who opts in.
- **P3 (later) — Model B bridge:** fiat-in → BTC-out for pseudonymous sellers, if demand appears.

## The decision (founder)

1. **Do we cross the fiat line at all now**, or stay Bitcoin-only until after the first BTC payment (Workstream A) proves the core loop? (Recommend: **land the first BTC payment first**, then pilot Twint with Loki — don't split focus.)
2. **Model A vs B** — recommend A (fiat track, Payrexx, opt-in, KYC'd sellers), Bitcoin stays default.
3. **Provider** — recommend **Payrexx** (Swiss-first, marketplace-native); Stripe as the international fallback later.

---

_Sources:_
[Stripe TWINT docs](https://docs.stripe.com/payments/twint) ·
[Payrexx TWINT](https://payrexx.com/en/twint) ·
[Payrexx marketplaces (split + KYC + payouts)](https://payrexx.com/en/solutions/marketplaces) ·
[Payrexx split payment](https://payrexx.com/en/glossar/split-payment) ·
[Payrexx crypto](https://payrexx.com/en/kryptowaehrungen) ·
[Swiss PSP comparison 2026](https://payrexx.com/en/content-hub/blog/vergleich-der-schweizer-online-zahlungsanbieter-f%C3%BCr-2026)
