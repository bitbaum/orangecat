/**
 * What this browser searched for and opened lately — shown when the palette
 * opens empty, so the second visit starts where the first one ended.
 *
 * Per-viewer convenience only (localStorage): nothing here is shared, sent
 * anywhere or relied on. Storage can be missing or throw (private windows,
 * blocked site data), so every access is guarded and failure means "no recents".
 */

export interface RecentEntry {
  label: string;
  href: string;
  /** A committed search, as opposed to a result that was opened. */
  kind: 'search' | 'hit';
  /** Entity type of an opened result, for its icon. */
  type?: string;
}

const KEY = 'oc:recent-searches';
export const RECENT_LIMIT = 5;

export function readRecents(): RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (e): e is RecentEntry =>
          !!e &&
          typeof e.label === 'string' &&
          typeof e.href === 'string' &&
          e.href.startsWith('/') &&
          (e.kind === 'search' || e.kind === 'hit')
      )
      .slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/** The list after `entry` is used: it moves to the front, once. */
export function withRecent(list: RecentEntry[], entry: RecentEntry): RecentEntry[] {
  return [entry, ...list.filter(e => e.href !== entry.href)].slice(0, RECENT_LIMIT);
}

export function rememberRecent(entry: RecentEntry): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(withRecent(readRecents(), entry)));
  } catch {
    /* no storage: no recents */
  }
}

export function forgetRecents(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
