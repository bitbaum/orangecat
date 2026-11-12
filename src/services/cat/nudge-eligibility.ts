import { CURRENCY_METADATA } from '@/config/currencies';
import { ECOSYSTEM } from '@/config/ecosystem';

const moneyNames = new Set([
  ...Object.entries(CURRENCY_METADATA).flatMap(([code, meta]) => [
    code.toLowerCase(),
    meta.symbol.toLowerCase(),
    meta.label.replace(/^.*\((.*)\)$/, '$1').toLowerCase(),
  ]),
  'cash',
  'money',
  'savings',
  'geld',
  'bargeld',
  'bitcoin',
  'bitcoins',
]);

/**
 * The products a person uses here — OrangeCat, Loki, Solon — are accounts they
 * connect, not things they own and could rent out. The owner's dashboard said
 * "Put your loki to work … List your loki" (2026-11-12): the profile had kept
 * "loki" as an asset because the chat talked about it.
 */
const productNames = new Set(
  Object.values(ECOSYSTEM).flatMap(p =>
    p && typeof p === 'object' && 'title' in p && typeof p.title === 'string'
      ? [p.title.toLowerCase()]
      : []
  )
);

/**
 * A holding of money is not an item to rent out, and neither is a product the
 * person uses. Physical mining equipment is.
 */
export function canSuggestAssetListing(name: string): boolean {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/^(?:my|mein|meine)\s+/, '')
    .replace(/^[\d.,]+\s*/, '')
    .replace(/\s+(?:holdings|balance|savings)$/, '');
  return normalized.length > 0 && !moneyNames.has(normalized) && !productNames.has(normalized);
}

/** Apply on cached responses too, so an old inappropriate card cannot survive the fix. */
export function isEligibleNudge(nudge: { dedupe_key: string }): boolean {
  const prefix = 'growth:asset:';
  return (
    !nudge.dedupe_key.startsWith(prefix) ||
    canSuggestAssetListing(nudge.dedupe_key.slice(prefix.length))
  );
}
