-- A group wallet's balance says when it was read.
--
-- group_wallets.current_balance_btc is NUMERIC(18,8) DEFAULT 0 and the table
-- had no read time, so a treasury nobody had ever looked up showed
-- "Balance CHF 0.00" to its members: a number nobody measured, presented as
-- measured. Personal wallets already keep the read time
-- (wallets.balance_updated_at) and show "Not checked yet" without one; this is
-- the same column for groups, so the group card can follow the same rule.
--
-- NULLABLE ON PURPOSE and not backfilled: when an existing balance was last
-- read is not recorded anywhere (updated_at moves on any edit), so every
-- existing row starts as "not checked yet" until someone refreshes it. Written
-- by updateWalletBalance (src/services/groups/mutations/treasury.ts), under the
-- existing group_wallets_update policy; the table-level grants cover the new
-- column.
--
-- Rollback: ALTER TABLE public.group_wallets DROP COLUMN balance_updated_at;
ALTER TABLE public.group_wallets
  ADD COLUMN IF NOT EXISTS balance_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.group_wallets.balance_updated_at IS
  'When current_balance_btc was last read from the chain. NULL = never checked; do not render the balance as zero.';
