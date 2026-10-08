-- Money goes where its owner says: an ordered rule for a person's inflow.
--
-- A person lists where money paid to them should land, in order. Each line is
-- one of their own wallets and either
--   * a SHARE — "25% of everything that comes in" (taxes first), or
--   * a FILL  — an amount to reach, once (a debt) or every month (rent, health
--               insurance), in a currency they name.
-- When someone pays them, OrangeCat sends the whole payment to the first line
-- still behind its target (src/domain/money-routes). OrangeCat never holds the
-- money: the payer's wallet pays that wallet directly. A "debt" wallet may be
-- an address the creditor holds the key to — then the payment goes straight to
-- the creditor.
--
-- Keyed by profile_id, not actor_id, because it routes between PERSONAL
-- wallets, which are keyed by profile_id, and is read by resolveUserWallet,
-- which resolves by the same id. A row can only name the owner's own wallet
-- (the policies check it), so nobody can route someone else's money.
--
-- No rule = behaviour exactly as before. Additive only.

CREATE TABLE IF NOT EXISTS public.money_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  -- Order of the waterfall, lowest first.
  position integer NOT NULL CHECK (position >= 0),
  kind text NOT NULL CHECK (kind IN ('share', 'fill')),
  -- share: basis points of every inflow (2500 = 25%).
  share_bps integer CHECK (share_bps BETWEEN 1 AND 10000),
  -- fill: the amount to reach, in its own currency.
  target_amount numeric(14, 2) CHECK (target_amount > 0),
  target_currency text CHECK (target_currency ~ '^[A-Z]{3}$'),
  -- once: until reached since starts_at. monthly: again every calendar month.
  period text NOT NULL DEFAULT 'once' CHECK (period IN ('once', 'monthly')),
  -- Payments before this moment never count towards the line.
  starts_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT money_routes_shape CHECK (
    (kind = 'share' AND share_bps IS NOT NULL AND target_amount IS NULL AND target_currency IS NULL)
    OR
    (kind = 'fill' AND share_bps IS NULL AND target_amount IS NOT NULL AND target_currency IS NOT NULL)
  ),
  -- A wallet appears once in a person's rule.
  CONSTRAINT money_routes_one_line_per_wallet UNIQUE (profile_id, wallet_id)
);

CREATE INDEX IF NOT EXISTS idx_money_routes_profile ON public.money_routes (profile_id, position);

ALTER TABLE public.money_routes ENABLE ROW LEVEL SECURITY;

-- Owner only, both ways: the row is yours AND the wallet it names is yours.
DROP POLICY IF EXISTS money_routes_select_own ON public.money_routes;
CREATE POLICY money_routes_select_own ON public.money_routes
  FOR SELECT USING (profile_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS money_routes_insert_own ON public.money_routes;
CREATE POLICY money_routes_insert_own ON public.money_routes
  FOR INSERT WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.wallets w
       WHERE w.id = money_routes.wallet_id AND w.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS money_routes_update_own ON public.money_routes;
CREATE POLICY money_routes_update_own ON public.money_routes
  FOR UPDATE USING (profile_id = (SELECT auth.uid()))
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.wallets w
       WHERE w.id = money_routes.wallet_id AND w.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS money_routes_delete_own ON public.money_routes;
CREATE POLICY money_routes_delete_own ON public.money_routes
  FOR DELETE USING (profile_id = (SELECT auth.uid()));

-- Default privileges hand every new table to anon and authenticated with ALL.
-- This is private configuration: nothing for anon, and for the owner exactly
-- the four row operations RLS governs.
REVOKE ALL ON public.money_routes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.money_routes TO authenticated;
GRANT ALL ON public.money_routes TO service_role;

DROP TRIGGER IF EXISTS set_money_routes_updated_at ON public.money_routes;
CREATE TRIGGER set_money_routes_updated_at
  BEFORE UPDATE ON public.money_routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
