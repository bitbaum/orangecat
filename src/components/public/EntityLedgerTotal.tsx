/**
 * EntityLedgerTotal — the honest, ledger-derived Bitcoin funding total for a
 * public entity, shown only when the owner has opted the fundraise into
 * transparency (entity_wallets.visibility = 'total' | 'public').
 *
 * Async server component. Reads via getEntityFundingStats (the SECURITY DEFINER
 * RPC), which returns null for private fundraises — in which case this renders
 * nothing. The figure is always in BTC (the contributions ledger is BTC-native)
 * and is rendered as its own explicit line rather than merged into an entity's
 * goal bar, whose goal may be denominated in fiat.
 */

import { createServerClient } from '@/lib/supabase/server';
import { getEntityFundingStats } from '@/services/wallets/funding-stats';
import { displayBTC } from '@/services/currency';
import type { EntityType } from '@/config/entity-registry';

interface EntityLedgerTotalProps {
  entityType: EntityType;
  entityId: string;
}

export default async function EntityLedgerTotal({ entityType, entityId }: EntityLedgerTotalProps) {
  const supabase = await createServerClient();
  const stats = await getEntityFundingStats(supabase, entityType, entityId);

  // Private fundraise (or no primary wallet link) → expose nothing.
  if (!stats) {
    return null;
  }

  const supporters = stats.namedSupporterCount;

  return (
    <div className="rounded-lg border border-subtle bg-surface-raised p-4">
      <p className="text-xs uppercase tracking-caps text-fg-tertiary">Raised in Bitcoin</p>
      <p className="mt-1 text-2xl font-bold text-bitcoin-text">{displayBTC(stats.totalBtc)}</p>
      <p className="mt-1 text-sm text-fg-secondary">
        {stats.contributorCount === 0
          ? 'Be the first to contribute'
          : `${stats.contributorCount} ${stats.contributorCount === 1 ? 'contribution' : 'contributions'}`}
        {supporters > 0 && ` · ${supporters} public`}
      </p>
    </div>
  );
}
