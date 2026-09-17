# Cat Credits — activation runbook

Everything for the paid Cat Credits rail is built and break-even-hardened. It is
**dormant behind one env var**: `PLATFORM_NWC_URI` (the platform's inbound
Lightning wallet). Until it's set, top-up is disabled, every balance is 0, and
frontier models are never reachable — so the paid tier earns nothing.

This is the whole activation. Do it on the box (`/opt/orangecat/app`).

## 0. Pre-flight (already done in code)

- Margin is break-even: markup 40%, registry estimates padded, missing-rate
  audited, failed-debit retried (`src/services/cat/credit-metering.ts`, PR #454).
- ⚠️ **Weigh the money-transmission / custody question before going live** —
  holding a prepaid Bitcoin float for users may carry regulatory obligations.
  Add a max-balance cap if that's a concern.

## 1. Provision the platform wallet

Create/choose a Lightning wallet that will **receive** OrangeCat's credit
revenue (Alby, Coinos, your own node…). Get its **NWC connection URI** with at
least `make_invoice` + `lookup_invoice` permissions:

    nostr+walletconnect://<pubkey>?relay=<wss…>&secret=<secret>

Set it on the box (never commit it):

    # /opt/orangecat/app/.env
    PLATFORM_NWC_URI='nostr+walletconnect://…'

## 2. Verify the wallet can receive (no money moves)

    cd /opt/orangecat/app && pnpm dlx tsx scripts/bitcoin/verify-platform-wallet.ts

Proves the URI is valid, connects, and can mint an invoice.

## 3. Verify the full loop (one real ~1000-sat payment to your own account)

    cd /opt/orangecat/app && VERIFY_USER_ID=<your-user-uuid> pnpm dlx tsx scripts/bitcoin/verify-credits-roundtrip.ts

It issues a real invoice, prints the BOLT11 — **pay it from any wallet** — then
confirms `checkTopUp` settles it and the ledger balance increases. This is the
part `verify-platform-wallet` can't prove (payment → ledger credit).

## 4. Flip live

    # /opt/orangecat/app/.env
    NEXT_PUBLIC_CAT_CREDITS_LIVE=true

Restart the app. The `/pricing` Credits + Supporter cards flip from "Activating"
to live, and the top-up button enables. Buy a small top-up as a real user and
confirm a frontier model deducts — you're collecting revenue.
