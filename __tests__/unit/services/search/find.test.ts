/**
 * The search behind ⌘K and Discover finds what was meant.
 *
 * The database half (search_public) matches what was typed, or any of the
 * corrections it is handed, exactly or by prefix. These tests hold the other
 * half to account: for every one-slip misspelling of every word of real
 * listing titles, the corrections must reach the right listing, and the
 * ranking must put it first. That is the SoundCloud failure — one wrong letter
 * in a name and nothing comes back — as a test that fails the day it returns.
 */
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const rpc = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => ({ rpc }) }));

import { corrections, createVocabulary, evaluate, typoCases, words } from '@bitbaum/searchkit';
import { findPublic, rankFound } from '@/services/search/find';
import type { PublicHit } from '@/services/search/public-search';

// Titles as they appear on /discover today.
const TITLES = [
  'Loki',
  'Cato',
  'Farmhouse',
  "Paul's Flower Shop in Zurich",
  'Open Accounting',
  'substrata',
  'Morning with Cat — Digital Art Print',
  'Flash Sheet PDF — 12 Original Designs',
  'Tattoo aftercare kit',
  'Bitcoin Art Print — Limited Edition',
  'Vlad — Minimal DJ Sets & Sound Curation',
  'Zurich Sublet Compliance & Concierge Service',
  'Custom Portrait Painting',
  'Remise Rosa in Zürich',
  'Ceramics Workshop Fund',
  'Peer Loan - Fix My Velo',
  'Graphic Design Services',
  'Website design & development',
  'one-shot.slop — The One-Shot Slop Machine',
];

const hit = (title: string, i: number): PublicHit => ({
  type: 'project',
  id: String(i),
  title,
  snippet: '',
  imageUrl: null,
  href: `/projects/${i}`,
  amount: null,
  currency: null,
  startsAt: null,
  place: null,
  createdAt: null,
  handle: null,
  rank: 0,
});
const HITS = TITLES.map(hit);
const vocab = createVocabulary(TITLES.flatMap(t => words(t)));

/** search_public's contract: a row is a candidate when any of its words starts with a typed word or a correction. */
function recall(query: string, terms: string[]): PublicHit[] {
  const asked = [...words(query), ...terms];
  return HITS.filter(h => words(h.title).some(w => asked.some(a => w.startsWith(a))));
}

describe('findPublic', () => {
  it('a one-slip misspelling of any title word still finds that title first', async () => {
    const cases = typoCases(
      HITS.map(h => ({ id: h.id, name: h.title })),
      { fold: words }
    );
    expect(cases.length).toBeGreaterThan(500);
    const report = await evaluate(cases, q =>
      rankFound(q, recall(q, corrections(q, vocab))).map(h => h.id)
    );
    expect(report.misses).toEqual([]);
    expect(report.zeroResults).toBe(0);
  });

  it('hands the database the corrections, and ranks what comes back', async () => {
    rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === 'public_search_text') {
        // PostgREST serves a one-column function as plain strings.
        return { data: TITLES, error: null };
      }
      const terms = (args.p_terms as string[] | null) ?? [];
      const rows = recall(String(args.p_query), terms).map(h => ({
        entity_type: h.type,
        id: h.id,
        title: h.title,
        snippet: '',
        image_url: null,
        path_key: null,
        amount: null,
        currency: null,
        starts_at: null,
        place: null,
        created_at: null,
        rank: 0,
        total: 1,
      }));
      return { data: rows, error: null };
    });

    const found = await findPublic('cqto');
    const call = rpc.mock.calls.find(([fn]) => fn === 'search_public');
    expect(call?.[1].p_terms).toContain('cato');
    expect(found.hits[0]?.title).toBe('Cato');
    expect(found.hits[0]?.marks.title).toEqual([{ start: 0, end: 4 }]);

    const none = await findPublic('xqzvbn');
    expect(none.hits).toEqual([]);
  });

  it('offers the closest real query when nothing matches', async () => {
    rpc.mockImplementation(async (fn: string) =>
      fn === 'public_search_text'
        ? { data: TITLES.map(text => ({ text })), error: null }
        : { data: [], error: null }
    );
    expect((await findPublic('farmhuose')).suggestion).toBe('farmhouse');
  });
});
