/**
 * A room's deck: the editor's edits keep slide ids stable, and what feeds a
 * deck is the room's own words and its generated evidence — never a number
 * anyone typed into a bound slide.
 */
import { generateDeck, normalizeDeck, type Deck } from '@bitbaum/deckkit';
import {
  blankSlide,
  duplicateSlide,
  fromPairs,
  insertSlide,
  moveSlide,
  removeSlide,
  updateSlide,
} from '@/components/room/deck/deckEdits';
import { deckDataFromEvidence, deckSourceFromRoom } from '@/domain/projectRooms/deck';
import type { RoomEvidence } from '@/domain/projectRooms/evidence';

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));

const deck = normalizeDeck({
  slides: [
    { id: 'a', layout: 'cover', title: 'A' },
    { id: 'b', layout: 'statement', title: 'B' },
    { id: 'c', layout: 'closing', title: 'C' },
  ],
}) as Deck;

describe('deck edits', () => {
  it('keeps every id stable through moves and updates', () => {
    const moved = moveSlide(deck, 0, 1);
    expect(moved.deck.slides.map(s => s.id)).toEqual(['b', 'a', 'c']);
    expect(moved.index).toBe(1);
    const updated = updateSlide(deck, 1, { title: 'B2', id: 'hijack' } as never);
    expect(updated.slides[1]).toMatchObject({ id: 'b', title: 'B2' });
  });

  it('gives a duplicate or a new slide a fresh id, after the selected one', () => {
    const dup = duplicateSlide(deck, 1);
    expect(dup.deck.slides).toHaveLength(4);
    expect(dup.index).toBe(2);
    expect(dup.deck.slides[2]!.id).not.toBe('b');
    expect(dup.deck.slides[2]!.title).toBe('B');
    const added = insertSlide(deck, 0, blankSlide('numbers'));
    expect(added.deck.slides[1]!.layout).toBe('numbers');
  });

  it('never removes the last slide, and lands on a neighbour', () => {
    expect(removeSlide(deck, 2)).toMatchObject({ index: 1 });
    const one = normalizeDeck({ slides: [{ layout: 'cover', title: 'only' }] }) as Deck;
    expect(removeSlide(one, 0).deck.slides).toHaveLength(1);
  });

  it('reads "value | label" lines, skipping half-written ones', () => {
    expect(fromPairs('156 | Merged PRs\n\nhalf |\n7 | a | b')).toEqual([
      ['156', 'Merged PRs'],
      ['7', 'a | b'],
    ]);
  });
});

const EVIDENCE: RoomEvidence = {
  facts: [{ label: 'Live since', value: 'Sep 10, 2026', source: '28 days ago' }],
  pace: {
    repoUrl: 'https://github.com/bitbaum/heidi',
    weeks: [
      { start: '2026-09-28', count: 40 },
      { start: '2026-10-05', count: 7 },
    ],
    total: 47,
    capped: false,
    createdAt: null,
    license: 'MIT',
  },
  fleet: {
    name: 'Heidi',
    status: 'live',
    since: '2026-09-10',
    urls: { live: null, repo: null },
    identity: {
      problem: 'The trap. More.',
      solution: 'Exposure.',
      mission: null,
      vision: 'Understanding.',
    },
    roadmap: [
      { title: 'Lexicon', line: null, status: 'in progress' },
      { title: 'Lab', line: null, status: 'later' },
      { title: 'Shipped', line: null, status: 'done' },
    ],
    changelog: [],
    sources: { roadmap: 'https://github.com/bitbaum/heidi/blob/HEAD/ROADMAP.md', changelog: null },
  },
};

describe('what feeds a room deck', () => {
  it('turns generated evidence into live data — and nothing typed', () => {
    const data = deckDataFromEvidence(EVIDENCE);
    expect(data.facts).toEqual([{ value: 'Sep 10, 2026', label: 'Live since' }]);
    expect(data.pace!.bars.map(b => b.value)).toEqual([40, 7]);
    expect(data.roadmap).toEqual([
      { heading: 'Now', items: ['Lexicon'] },
      { heading: 'Next', items: [] },
      { heading: 'Later', items: ['Lab'] },
    ]);
  });

  it('drafts from the room and the product record, in the investor arc', () => {
    const source = deckSourceFromRoom(
      {
        id: 'p',
        title: 'Heidi',
        description: 'desc',
        website_url: 'https://heidi.orangecat.ch',
        cover_image_url: null,
        actor_id: null,
        user_id: null,
      },
      {
        headline: 'Understand it.',
        sections: [{ title: 'Risks', body: 'One risk.' }],
        metrics: [{ label: 'Tests', value: '1047', verify: 'pnpm verify' }],
        metrics_as_of: '2026-10-01',
        deck_url: null,
        documents: [],
        contact_email: 'cato@orangecat.ch',
      },
      EVIDENCE,
      new Date('2026-10-08T12:00:00Z')
    );
    const deck = generateDeck(source, deckDataFromEvidence(EVIDENCE));
    expect(deck.slides[0]).toMatchObject({
      layout: 'cover',
      title: 'Heidi',
      body: 'Understand it.',
    });
    expect(deck.slides[0]!.kicker).toContain('October 2026');
    expect(deck.slides.map(s => s.kicker)).toContain('Risks');
    expect(deck.slides.find(s => s.kicker === 'The numbers')!.sources).toContain('2026');
  });
});
