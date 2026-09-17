-- Open accounting: a wallet can account for itself in public — if its owner says so.
--
-- A wallet's balance and history are already public in one sense: for a plain
-- on-chain address, anyone holding the address can read both from the chain.
-- What is NOT public is the JOIN — this address belongs to this person and is
-- labelled "Monthly Rent". Publishing that is a disclosure of circumstance, not
-- of Bitcoin data, which is why this is opt-in per wallet and off by default.
--
-- Extended public keys are a second reason for the switch. For an xpub wallet
-- the aggregated history is not otherwise discoverable, and the key itself is
-- never published either way (see lib/wallets/publicWallet.ts) — the server
-- derives addresses from it and publishes only the resulting ledger.
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS open_accounting boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.wallets.open_accounting IS
  'Owner opt-in: publish this wallet''s balance and recent transactions on its public page. Default false.';

-- The wallets lockdown replaced the table-level SELECT grant with an explicit
-- column list, so a new column is unreadable by client roles until it is named
-- here. UPDATE stays authenticated-only; RLS still restricts it to the owner.
GRANT SELECT (open_accounting) ON public.wallets TO anon, authenticated;
GRANT UPDATE (open_accounting) ON public.wallets TO authenticated;

-- A transaction is a number until someone says what it was for.
--
-- The note belongs to the WALLET OWNER, not to the payer: contributions already
-- carry the contributor's own message. One note per transaction, so an owner
-- corrects rather than accumulates.
CREATE TABLE IF NOT EXISTS public.wallet_transaction_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  -- A bitcoin txid is 32 bytes as 64 lowercase hex characters. Constrained so a
  -- note can never be attached to something that is not a transaction.
  txid text NOT NULL CHECK (txid ~ '^[0-9a-f]{64}$'),
  note text NOT NULL CHECK (char_length(btrim(note)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet_id, txid)
);

CREATE INDEX IF NOT EXISTS idx_wallet_transaction_notes_wallet
  ON public.wallet_transaction_notes (wallet_id);

ALTER TABLE public.wallet_transaction_notes ENABLE ROW LEVEL SECURITY;

-- Readable by anyone only while the wallet is live AND its owner has opted in.
-- Turning open accounting off hides every note again, which is what an opt-in
-- switch has to mean — otherwise the first publish is irreversible.
DROP POLICY IF EXISTS wallet_transaction_notes_public_read ON public.wallet_transaction_notes;
CREATE POLICY wallet_transaction_notes_public_read ON public.wallet_transaction_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.wallets w
       WHERE w.id = wallet_transaction_notes.wallet_id
         AND w.is_active
         AND w.open_accounting
    )
  );

-- The owner writes and reads their own notes whatever the switch says.
-- profile_id IS the auth user id for profile wallets; user_id covers project
-- wallets — the same pair the wallets_select_own policy keys on.
DROP POLICY IF EXISTS wallet_transaction_notes_owner_all ON public.wallet_transaction_notes;
CREATE POLICY wallet_transaction_notes_owner_all ON public.wallet_transaction_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.wallets w
       WHERE w.id = wallet_transaction_notes.wallet_id
         AND (SELECT auth.uid()) IN (w.user_id, w.profile_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.wallets w
       WHERE w.id = wallet_transaction_notes.wallet_id
         AND (SELECT auth.uid()) IN (w.user_id, w.profile_id)
    )
  );

GRANT SELECT ON public.wallet_transaction_notes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.wallet_transaction_notes TO authenticated;
