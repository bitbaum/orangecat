-- Settlement side-effects: record that they ran, so a crash is visible.
--
-- handlePaymentConfirmed flips the intent to `paid` FIRST — deliberately, since
-- the conditional update is the lock that makes settlement run exactly once —
-- and only then writes the order, decrements inventory, notifies the seller and
-- fans out webhooks.
--
-- A crash in that gap loses all of it, permanently and silently:
--
--   * the intent is `paid`, so every later observer's claimPaidTransition
--     returns false and skips the side-effects as "already settled";
--   * refreshPaymentStatus short-circuits on terminal statuses;
--   * the reconcile cron sweeps only CREATED / INVOICE_READY /
--     PENDING_CONFIRMATION, so it never looks at a paid row again.
--
-- The buyer's money is gone and their order sits in pending_payment forever,
-- with nothing anywhere reporting a problem. bitbaum/orangecat#563 finding 4.
--
-- This column is the marker. Set when the settlement path completes; NULL on a
-- paid intent means the side-effects did not finish, which the reconcile sweep
-- now reports.
--
-- DELIBERATELY NOT GRANTED to anon/authenticated. payment_intents uses
-- column-level SELECT grants (same shape as wallets), and this is an internal
-- operations marker with no client use — a column no client can read is a
-- column no client can be confused by. Server-side reads go through
-- service_role.

ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS side_effects_at timestamptz;

COMMENT ON COLUMN public.payment_intents.side_effects_at IS
  'When settlement side-effects finished (order, inventory, notifications, webhooks). NULL on a paid intent means they did not complete — the reconcile sweep reports these. Server-side only: no client SELECT grant.';

-- Finding the stragglers must not seq-scan the whole table every minute. Partial
-- index: only paid rows that have not been marked, which is the exact predicate
-- the sweep asks and — when everything is healthy — an empty index.
CREATE INDEX IF NOT EXISTS payment_intents_settlement_incomplete_idx
  ON public.payment_intents (paid_at)
  WHERE status = 'paid' AND side_effects_at IS NULL;
