import { describe, expect, it } from 'vitest';
import { mutedKinds, nudgeKind, selectNudges, NUDGE_POLICY } from '@/services/cat/nudge-policy';
import { demandMatch, DEMAND_MIN_SEARCHES } from '@/services/cat/nudges';

const NOW = new Date('2026-10-03T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const n = (dedupe_key: string, score: number) => ({ dedupe_key, score });

// Helpful versus annoying is mostly restraint; these pin the restraint.
describe('nudge policy', () => {
  it('reads the kind off the dedupe key', () => {
    expect(nudgeKind('completion:publish:abc')).toBe('completion:publish');
    expect(nudgeKind('growth:skill:web design')).toBe('growth:skill');
    expect(nudgeKind('completion:bio')).toBe('completion:bio');
  });

  it('shows one per kind, best first, three at most', () => {
    const shown = selectNudges(
      [
        n('completion:publish:a', 0.7),
        n('completion:publish:b', 0.71),
        n('demand:match:x', 0.92),
        n('growth:skill:web', 0.82),
        n('growth:asset:van', 0.8),
        n('completion:bio', 0.6),
      ],
      [],
      NOW
    );
    expect(shown.map(s => s.dedupe_key)).toEqual([
      'demand:match:x',
      'growth:skill:web',
      'growth:asset:van',
    ]);
    expect(shown).toHaveLength(NUDGE_POLICY.maxShown);
  });

  it('never shows a dismissed nudge again', () => {
    const shown = selectNudges(
      [n('completion:bio', 0.6)],
      [{ dedupe_key: 'completion:bio', dismissed_at: daysAgo(200) }],
      NOW
    );
    expect(shown).toEqual([]);
  });

  it('mutes a kind dismissed twice this month, for a month', () => {
    const history = [
      { dedupe_key: 'completion:publish:a', dismissed_at: daysAgo(10) },
      { dedupe_key: 'completion:publish:b', dismissed_at: daysAgo(2) },
    ];
    expect(mutedKinds(history, NOW)).toEqual(new Set(['completion:publish']));
    expect(selectNudges([n('completion:publish:c', 0.7)], history, NOW)).toEqual([]);
    // A month after the latest dismissal it may speak again.
    const later = new Date(NOW.getTime() + 29 * 86_400_000);
    expect(mutedKinds(history, later).has('completion:publish')).toBe(false);
  });

  it('one dismissal is "not this", not "not these"', () => {
    const history = [{ dedupe_key: 'completion:publish:a', dismissed_at: daysAgo(1) }];
    expect(selectNudges([n('completion:publish:b', 0.7)], history, NOW)).toHaveLength(1);
  });

  it('old dismissals do not count toward fatigue', () => {
    const history = [
      { dedupe_key: 'growth:skill:a', dismissed_at: daysAgo(90) },
      { dedupe_key: 'growth:skill:b', dismissed_at: daysAgo(2) },
    ];
    expect(mutedKinds(history, NOW).size).toBe(0);
  });
});

describe('demand match', () => {
  const listings = [
    { id: '1', title: 'Website design & development' },
    { id: '2', title: 'Handmade candles' },
  ];

  it('finds the listing people searched for, in any word order', () => {
    const m = demandMatch(listings, ['web design', 'Design web', 'bakery']);
    expect(m?.listing.id).toBe('1');
    expect(m?.count).toBe(2);
  });

  it(`needs ${DEMAND_MIN_SEARCHES} searches — one stray query is not demand`, () => {
    expect(demandMatch(listings, ['candles'])).toBeNull();
    expect(demandMatch(listings, ['candles', 'Candles'])?.listing.id).toBe('2');
  });

  it('ignores searches with no real word', () => {
    expect(demandMatch(listings, ['a', 'a', 'a'])).toBeNull();
  });
});
