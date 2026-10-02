/**
 * EntityOpenLedger — the server half of OpenLedgerCard for entity detail
 * configs: resolves whether this entity's fund publishes its ledger and
 * renders the link, or nothing. Sits beside EntityLedgerTotal, which shows
 * how much came in; this shows where to check what happened to it.
 */

import OpenLedgerCard from '@/components/wallets/OpenLedgerCard';
import { getEntityOpenLedgerWalletId } from '@/services/wallets/entityOpenLedger';
import type { EntityType } from '@/config/entity-registry';

export default async function EntityOpenLedger({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const walletId = await getEntityOpenLedgerWalletId(entityType, entityId);
  return walletId ? <OpenLedgerCard walletId={walletId} /> : null;
}
