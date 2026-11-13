/**
 * The fallback-chain ordering rule, defined once.
 *
 * A user's chain interleaves their API keys (each carrying `sort_order`) with
 * the free platform default (carrying `platform_chain_position` in prefs) in
 * ONE 0-based index space. A persisted order is an array of ids — key ids
 * plus the 'platform' sentinel — where array index = chain position.
 *
 * Previously this rule lived in three places (the manager component, the
 * settings hook's optimistic update, and the service's persistence loop) and
 * could drift; every consumer now goes through these helpers.
 */

/** Sentinel id for the free OrangeCat default's slot in the chain. */
export const PLATFORM_CHAIN_ID = 'platform';

export interface ChainKey {
  id: string;
  sort_order: number;
}

export type ChainItem<K extends ChainKey = ChainKey> =
  { kind: 'key'; key: K } | { kind: 'platform' };

/**
 * Reconstruct the merged chain from stored positions. Sorting by the shared
 * index interleaves keys and the platform default correctly even after
 * reordering leaves gaps in the key sort_orders.
 */
export function buildChain<K extends ChainKey>(
  keys: K[],
  platformPosition: number
): ChainItem<K>[] {
  return [
    ...keys.map(key => ({ order: key.sort_order, item: { kind: 'key', key } as ChainItem<K> })),
    { order: platformPosition, item: { kind: 'platform' } as ChainItem<K> },
  ]
    .sort((a, b) => a.order - b.order)
    .map(entry => entry.item);
}

export function chainItemId(item: ChainItem): string {
  return item.kind === 'platform' ? PLATFORM_CHAIN_ID : item.key.id;
}

/**
 * Move the item at `from` to slot `to` and return the resulting persisted
 * order (ids, first = tried earliest) — or null when the move is a no-op or
 * out of range.
 */
export function moveChainItem<K extends ChainKey>(
  chain: ChainItem<K>[],
  from: number,
  to: number
): string[] | null {
  if (from === to || from < 0 || to < 0 || from >= chain.length || to >= chain.length) {
    return null;
  }
  const next = [...chain];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next.map(chainItemId);
}

/** Stamp each key's new sort_order from its index in a persisted order. */
export function applyOrderToKeys<K extends ChainKey>(keys: K[], orderedIds: string[]): K[] {
  const byId = new Map(keys.map(k => [k.id, k]));
  const reordered: K[] = [];
  orderedIds.forEach((id, idx) => {
    if (id === PLATFORM_CHAIN_ID) {
      return;
    }
    const key = byId.get(id);
    if (key) {
      reordered.push({ ...key, sort_order: idx });
    }
  });
  return reordered;
}

/** The platform default's position in a persisted order (absent → unchanged marker -1). */
export function platformPositionFromOrder(orderedIds: string[]): number {
  return orderedIds.indexOf(PLATFORM_CHAIN_ID);
}
