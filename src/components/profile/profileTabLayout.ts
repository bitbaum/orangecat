/**
 * Profile tab layout — SSOT for which profile tabs are primary vs. overflow.
 *
 * A profile can surface up to ~13 tabs (Overview, Info, Timeline, Projects, and
 * one per public entity type, plus People and Wallets). Showing all of them at
 * once is exactly the cognitive overload we want to avoid: keep the few tabs
 * people actually use up front, and tuck the long tail behind a "More" menu.
 *
 * This is the single decision point — change PRIMARY_PROFILE_TAB_IDS to re-rank
 * what stays visible. `partitionTabs` is pure so it can be unit-tested and reused
 * by the tab bar without pulling in React.
 */

/**
 * Tab ids kept visible up front, in the order they naturally appear. Everything
 * else falls into the overflow "More" menu. Ids match those built in
 * ProfileLayout (`overview`, `info`, `timeline`, `projects`, and entity plurals
 * kebab-cased, e.g. `products`, `companions`).
 *
 * `wallets` is up front because it is the one tab that answers "how do I pay
 * this person?" — the platform's whole premise. It sat in the overflow menu,
 * so a profile with two live wallets read, to its own owner, as a profile with
 * no way to be paid: the API returned them, the tab existed, and nothing on
 * screen linked to it. Hiding the payment surface behind "More" is the one
 * ranking this list must not make.
 */
export const PRIMARY_PROFILE_TAB_IDS: readonly string[] = [
  'timeline',
  'overview',
  'projects',
  'wallets',
  'products',
  'services',
  'people',
];

export interface PartitionedTabs<T> {
  primary: T[];
  overflow: T[];
}

/**
 * Split tabs into primary (in `primaryIds`) and overflow (the rest), each
 * preserving the input order. Only ids actually present in `tabs` matter, so a
 * primary id with no corresponding tab (e.g. a visitor whose empty tabs were
 * already filtered out) simply doesn't appear.
 */
export function partitionTabs<T extends { id: string }>(
  tabs: T[],
  primaryIds: readonly string[] = PRIMARY_PROFILE_TAB_IDS
): PartitionedTabs<T> {
  const primarySet = new Set(primaryIds);
  const primary: T[] = [];
  const overflow: T[] = [];
  for (const tab of tabs) {
    (primarySet.has(tab.id) ? primary : overflow).push(tab);
  }
  return { primary, overflow };
}
