/**
 * Does this entity's fund account for itself in public — and if so, where?
 *
 * Open accounting is opt-in per WALLET (wallets.open_accounting), and its
 * ledger lives on the wallet's own page. Nothing on a cause, research or
 * project page pointed there, so a reader deciding whether to fund something
 * could not find the one record that answers "where did the money go".
 *
 * A link is shown only when BOTH owners' decisions already make it public:
 *   - the entity's primary wallet link is `public` — the receiving address is
 *     already published on this page (config/wallet-visibility.ts), so naming
 *     the wallet discloses nothing new; and
 *   - the wallet itself has opted into open accounting and is active.
 * `total` is not enough: it publishes an aggregate, not which wallet receives.
 *
 * Database only. The ledger page reads the chain; this page must not, so a
 * view here costs no mempool request. Never throws: any failure reads as "no
 * open ledger", which renders nothing.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { getTableName } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { EntityType } from '@/config/entity-registry';

export async function getEntityOpenLedgerWalletId(
  entityType: EntityType,
  entityId: string
): Promise<string | null> {
  try {
    const db = getAdminClient();

    // The same primary link get_entity_funding_stats reads: is_primary, oldest first.
    const { data: link, error: linkError } = await db
      .from(DATABASE_TABLES.ENTITY_WALLETS)
      .select('wallet_id, visibility')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('is_primary', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const primary = link as { wallet_id: string; visibility: string } | null;
    if (linkError || !primary || primary.visibility !== 'public') {
      return null;
    }

    const { data: wallet, error: walletError } = await db
      .from(getTableName('wallet'))
      .select('id, is_active, open_accounting')
      .eq('id', primary.wallet_id)
      .maybeSingle();

    const row = wallet as {
      id: string;
      is_active: boolean | null;
      open_accounting: boolean | null;
    } | null;
    if (walletError || !row?.is_active || !row.open_accounting) {
      return null;
    }
    return row.id;
  } catch (err) {
    logger.warn('Could not resolve an entity open ledger', {
      entityType,
      entityId,
      error: err instanceof Error ? err.message : 'unknown',
    });
    return null;
  }
}
