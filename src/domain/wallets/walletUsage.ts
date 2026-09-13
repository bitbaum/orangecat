/**
 * Shared-wallet usage — the honesty layer for Bitcoin address reuse.
 *
 * On-chain payments to the same address are publicly linkable by anyone with a
 * block explorer. When an owner routes several entities into one wallet, a
 * backer paying entity A can see (on-chain) that the address also collects for
 * B and C — so the platform should say so up front rather than let backers
 * discover it later.
 *
 * Deliberately disclosed as a BARE COUNT, never a list: naming the sibling
 * entities here would hand out an owner's full portfolio in one call — a
 * reverse-lookup the platform intentionally does not offer. The blockchain
 * only ever reveals payments actually made; we match that bar, not lower it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveSellerWallet } from '@/domain/payments';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { logger } from '@/utils/logger';

export interface SharedWalletUsage {
  /** Other entities explicitly linked to the same receiving wallet. */
  shared_count: number;
  /**
   * The wallet is its owner's default (is_primary) — entities with no explicit
   * link fall back to it too, so sharing extends beyond the linked count.
   */
  is_owner_default: boolean;
  /**
   * Wallet is configured with an xpub: every payment derives a fresh, never
   * reused address, so payments are NOT linkable on-chain. No warning needed.
   */
  fresh_address_per_payment: boolean;
}

/**
 * Count the sibling links that are actually PUBLIC pages, using the caller's
 * RLS-scoped client so the database's own visibility rules decide — the same
 * gate the payment surface uses.
 *
 * Two ways the raw link count lies, both observed in prod: entity_wallets keeps
 * rows for entities that were deleted (all nine links on one wallet pointed at
 * rows that no longer exist), and a draft page isn't publicly linkable at all.
 * Claiming "also receives funds for 8 other pages" when none are visible is
 * exactly the fabricated-confidence failure this disclosure exists to prevent.
 */
async function countPubliclyVisible(
  supabase: SupabaseClient,
  siblings: Array<{ entity_type: EntityType; entity_id: string }>
): Promise<number> {
  if (siblings.length === 0) {
    return 0;
  }
  const byType = new Map<EntityType, string[]>();
  for (const s of siblings) {
    byType.set(s.entity_type, [...(byType.get(s.entity_type) ?? []), s.entity_id]);
  }

  const counts = await Promise.all(
    Array.from(byType.entries()).map(async ([type, ids]) => {
      try {
        const { data } = await supabase
          .from(getEntityMetadata(type).tableName)
          .select('id')
          .in('id', ids);
        return data?.length ?? 0;
      } catch {
        // An unknown/unreadable type contributes nothing rather than inflating.
        return 0;
      }
    })
  );
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * Resolve how shared an entity's receiving wallet is, using the SAME wallet
 * resolution the payment flow uses (SSOT) — what we disclose is what actually
 * receives the money. Returns null when no wallet resolves, when resolution
 * fails, or for group treasuries (a group wallet is expected to be shared —
 * that's what a treasury is, and it lives outside entity_wallets).
 */
export async function getSharedWalletUsage(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
): Promise<SharedWalletUsage | null> {
  try {
    const resolved = await resolveSellerWallet(entityType, entityId);
    if (!resolved) {
      return null;
    }

    const admin = getAdminClient() as unknown as SupabaseClient;

    // Group wallets live in group_wallets — a wallets-table lookup misses and
    // we correctly return null (treasury sharing isn't a privacy leak).
    const { data: wallet } = await admin
      .from(DATABASE_TABLES.WALLETS)
      .select('id, is_primary, lightning_address, address_or_xpub')
      .eq('id', resolved.wallet_id)
      .maybeSingle();
    if (!wallet) {
      return null;
    }

    // Count by ADDRESS, not by wallet row. The on-chain linkability a backer
    // cares about is a property of the address itself, and prod really does
    // hold the same address in several wallet rows (one lightning address in
    // two rows, one xpub in eleven) — counting per wallet_id reports "not
    // shared" for the most visible reuse on the platform.
    const address = wallet.lightning_address || wallet.address_or_xpub || null;
    let walletIds = [resolved.wallet_id];
    if (address) {
      const { data: twins } = await admin
        .from(DATABASE_TABLES.WALLETS)
        .select('id')
        .or(`lightning_address.eq.${address},address_or_xpub.eq.${address}`);
      if (twins?.length) {
        walletIds = Array.from(new Set(twins.map(t => t.id as string)));
      }
    }

    const { data: links } = await admin
      .from(DATABASE_TABLES.ENTITY_WALLETS)
      .select('entity_type, entity_id')
      .in('wallet_id', walletIds);

    const siblings = (links ?? []).filter(
      l => !(l.entity_type === entityType && l.entity_id === entityId)
    ) as Array<{ entity_type: EntityType; entity_id: string }>;

    const sharedCount = await countPubliclyVisible(supabase, siblings);

    // No explicit link for THIS entity means resolveSellerWallet fell through
    // to the owner-default chain — so every other unlinked page of the same
    // owner lands on this identical address. That fallback, not the is_primary
    // flag, is what actually makes a wallet the de-facto default: the two
    // Loki passes both display orangecat@coinos.io through it while the
    // resolved wallet row is not flagged primary at all, so keying the
    // disclosure on is_primary alone stayed silent on the platform's most
    // visible reuse.
    const hasExplicitLink = (links ?? []).some(
      l => l.entity_type === entityType && l.entity_id === entityId
    );

    return {
      shared_count: sharedCount,
      is_owner_default: !hasExplicitLink || !!wallet.is_primary,
      fresh_address_per_payment: resolved.method === 'onchain' && !!resolved.onchain_xpub,
    };
  } catch (error) {
    // Disclosure is best-effort: a failure here must never break the page or
    // the payment flow it annotates.
    logger.warn('getSharedWalletUsage failed', { entityType, entityId, error });
    return null;
  }
}
