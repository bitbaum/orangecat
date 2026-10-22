import { CURRENCY_METADATA } from '@/config/currencies';

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

/** A holding of money is not an item to rent out. Physical mining equipment is. */
export function canSuggestAssetListing(name: string): boolean {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/^(?:my|mein|meine)\s+/, '')
    .replace(/^[\d.,]+\s*/, '')
    .replace(/\s+(?:holdings|balance|savings)$/, '');
  return normalized.length > 0 && !moneyNames.has(normalized);
}

/** Apply on cached responses too, so an old inappropriate card cannot survive the fix. */
export function isEligibleNudge(nudge: { dedupe_key: string }): boolean {
  const prefix = 'growth:asset:';
  return (
    !nudge.dedupe_key.startsWith(prefix) ||
    canSuggestAssetListing(nudge.dedupe_key.slice(prefix.length))
  );
}
