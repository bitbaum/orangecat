/**
 * Which proactive nudges a person sees, and when the Cat stays quiet.
 *
 * Helpful and annoying differ mostly in restraint. The generator proposes
 * every candidate it can ground; this policy decides what reaches the
 * dashboard:
 *
 *  - Never twice. A dismissed nudge (same dedupe_key) never returns. That
 *    rule already existed.
 *  - Fewer of what you wave away. Two dismissals of the same KIND within 30
 *    days ("publish your draft", "list a skill") mute that kind for 30 days
 *    after the latest one. Dismissing one card is "not this"; dismissing two of
 *    a kind is "not these", and the Cat should hear it.
 *  - One per kind. Four "publish your draft" cards are one thought said four
 *    times; the generator already collapses drafts, this enforces it for any
 *    kind.
 *  - Three at most. Past three, a suggestion list becomes wallpaper.
 *
 * Pure: candidates and history in, the shown list out. The route does the I/O.
 */

export const NUDGE_POLICY = {
  maxShown: 3,
  fatigueDismissals: 2,
  fatigueWindowDays: 30,
  muteDays: 30,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The kind of a nudge: its dedupe_key without the instance part.
 * "completion:publish:<id>" → "completion:publish", "completion:bio" → itself.
 */
export function nudgeKind(dedupeKey: string): string {
  const parts = dedupeKey.split(':');
  return parts.length > 2 ? parts.slice(0, 2).join(':') : dedupeKey;
}

export interface DismissedNudge {
  dedupe_key: string;
  dismissed_at: string | null;
}

/** Kinds the person has recently said "not these" to. */
export function mutedKinds(history: DismissedNudge[], now: Date = new Date()): Set<string> {
  const windowStart = now.getTime() - NUDGE_POLICY.fatigueWindowDays * DAY_MS;
  const byKind = new Map<string, number[]>();
  for (const d of history) {
    const at = d.dismissed_at ? Date.parse(d.dismissed_at) : NaN;
    if (!Number.isFinite(at) || at < windowStart) {
      continue;
    }
    const kind = nudgeKind(d.dedupe_key);
    byKind.set(kind, [...(byKind.get(kind) ?? []), at]);
  }
  const muted = new Set<string>();
  for (const [kind, times] of byKind) {
    if (times.length < NUDGE_POLICY.fatigueDismissals) {
      continue;
    }
    const latest = Math.max(...times);
    if (now.getTime() < latest + NUDGE_POLICY.muteDays * DAY_MS) {
      muted.add(kind);
    }
  }
  return muted;
}

/** The nudges worth showing, best first. */
export function selectNudges<N extends { dedupe_key: string; score: number }>(
  candidates: N[],
  history: DismissedNudge[],
  now: Date = new Date()
): N[] {
  const dismissed = new Set(history.map(d => d.dedupe_key));
  const muted = mutedKinds(history, now);
  const seenKinds = new Set<string>();
  const out: N[] = [];
  for (const n of [...candidates].sort((a, b) => b.score - a.score)) {
    const kind = nudgeKind(n.dedupe_key);
    if (dismissed.has(n.dedupe_key) || muted.has(kind) || seenKinds.has(kind)) {
      continue;
    }
    seenKinds.add(kind);
    out.push(n);
    if (out.length === NUDGE_POLICY.maxShown) {
      break;
    }
  }
  return out;
}
