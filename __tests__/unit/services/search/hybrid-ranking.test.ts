import { mergePublicRankings } from '@/services/search/hybrid-ranking';
import type { PublicHit } from '@/services/search/public-search';
const hit = (id: string, title = id, type: PublicHit['type'] = 'project'): PublicHit => ({
  id,
  type,
  title,
  snippet: '',
  imageUrl: null,
  href: `/projects/${id}`,
  amount: null,
  currency: null,
  startsAt: null,
  place: null,
  createdAt: null,
  handle: null,
  rank: 0,
});
describe('Public hybrid ranking', () => {
  it('keeps a whole title/handle match first even against a consensus fuzzy match', () => {
    const exact = { ...hit('exact', 'Cato', 'profile'), handle: 'cato' };
    const fuzzy = hit('fuzzy', 'Cats and Bitcoin');
    expect(
      mergePublicRankings('cato', [fuzzy, exact], [{ ...fuzzy, similarity: 0.9 }]).map(h => h.id)
    ).toEqual(['exact', 'fuzzy']);
  });
  it('combines recall, deduplicates shared hits and retains lexical ordering on ties', () => {
    const a = hit('a'),
      b = hit('b'),
      c = hit('c');
    const results = mergePublicRankings(
      'cqto',
      [a, b],
      [
        { ...b, similarity: 0.7 },
        { ...c, similarity: 0.6 },
      ]
    );
    expect(results.map(h => h.id)).toEqual(['b', 'a', 'c']);
    expect(results[0].similarity).toBe(0.7);
  });
  it('preserves a typo-corrected lexical result ahead of an unrelated semantic tie', () => {
    expect(
      mergePublicRankings(
        'cqto',
        [hit('cato', 'Cato')],
        [{ ...hit('cat', 'Cat'), similarity: 0.7 }]
      ).map(h => h.id)
    ).toEqual(['cato', 'cat']);
  });
  it('bounds both total results and per-kind dominance', () => {
    const projects = Array.from({ length: 8 }, (_, i) => hit(`p${i}`));
    const people = Array.from({ length: 8 }, (_, i) => hit(`u${i}`, `Person ${i}`, 'profile'));
    const results = mergePublicRankings(
      'something',
      projects,
      people.map(h => ({ ...h, similarity: 0.8 })),
      5,
      3
    );
    expect(results).toHaveLength(5);
    expect(results.filter(h => h.type === 'project').length).toBeLessThanOrEqual(3);
    expect(results.filter(h => h.type === 'profile').length).toBeLessThanOrEqual(3);
  });
});
