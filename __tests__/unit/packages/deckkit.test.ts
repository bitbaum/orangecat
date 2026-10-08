/**
 * @bitbaum/deckkit — presentations as data. These pin the promises in its
 * README: a stored deck always opens, links are https, ids are stable and
 * unique, the generator invents nothing, and bound slides read live data.
 */
import {
  accentParts,
  bindDeck,
  firstSentence,
  generateDeck,
  leadParts,
  sentences,
  LIMITS,
  normalizeDeck,
  type DeckData,
} from '@bitbaum/deckkit';

describe('normalizeDeck', () => {
  it('keeps what fits, drops what does not, and never fails on an old deck', () => {
    const deck = normalizeDeck({
      title: 'Heidi',
      theme: { mode: 'light', accent: 'red' },
      slides: [
        { id: 'a', layout: 'cover', title: 'Heidi' },
        { id: 'b', layout: 'nonsense', title: 'gone' },
        { id: 'c', layout: 'statement' },
        { id: 'a', layout: 'points', title: 'Dup id', points: ['x', 42, ''] },
        {
          id: 'd',
          layout: 'image',
          title: 'Shot',
          image: 'javascript:alert(1)',
          action: { label: 'Go', href: 'http://x' },
        },
      ],
    });
    expect(deck).not.toBeNull();
    expect(deck!.slides.map(s => s.layout)).toEqual(['cover', 'points', 'image']);
    expect(new Set(deck!.slides.map(s => s.id)).size).toBe(3);
    expect(deck!.slides[0]!.id).toBe('a');
    expect(deck!.slides[1]!.points).toEqual(['x']);
    expect(deck!.slides[2]!.image).toBeUndefined();
    expect(deck!.slides[2]!.action).toBeUndefined();
    expect(deck!.theme).toEqual({ mode: 'light', accent: '#ff5c00' });
  });

  it('enforces the limits that keep a slide short', () => {
    const deck = normalizeDeck({
      slides: [
        {
          layout: 'points',
          title: 'x'.repeat(500),
          points: Array.from({ length: 12 }, (_, i) => `p${i}`),
        },
      ],
    });
    expect(deck!.slides[0]!.title).toHaveLength(LIMITS.title);
    expect(deck!.slides[0]!.points).toHaveLength(LIMITS.points);
  });

  it('is null for a deck with nothing to show', () => {
    expect(normalizeDeck({ slides: [] })).toBeNull();
    expect(normalizeDeck(null)).toBeNull();
  });
});

describe('text', () => {
  it('marks *word* as the accent', () => {
    expect(accentParts('Kein *Prototyp* mehr')).toEqual([
      { text: 'Kein ', accent: false },
      { text: 'Prototyp', accent: true },
      { text: ' mehr', accent: false },
    ]);
    expect(accentParts('plain')).toEqual([{ text: 'plain', accent: false }]);
  });

  it('bolds a short lead before a colon, and only a short one', () => {
    expect(leadParts('Individuals: free, with an account')).toEqual({
      lead: 'Individuals',
      rest: 'free, with an account',
    });
    expect(leadParts('No lead here')).toEqual({ rest: 'No lead here' });
  });

  it('splits sentences and leads without a backtracking pattern — fast on hostile input', () => {
    expect(sentences('One.  Two!\nThree? four')).toEqual(['One.', 'Two!', 'Three?', 'four']);
    expect(sentences('v1.2 is out. Yes.')).toEqual(['v1.2 is out.', 'Yes.']);
    expect(leadParts('a: b')).toEqual({ rest: 'a: b' });
    expect(leadParts('Lead:no space')).toEqual({ rest: 'Lead:no space' });
    const hostile = [
      ' '.repeat(50_000) + 'x',
      '\t\t'.repeat(25_000),
      '.'.repeat(50_000) + 'a',
      ', '.repeat(25_000),
    ];
    const t0 = performance.now();
    for (const s of hostile) {
      sentences(s);
      firstSentence(s, 180);
      leadParts(s);
    }
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('takes the first sentence and cuts at a word', () => {
    expect(firstSentence('One claim. Then more.')).toBe('One claim.');
    expect(firstSentence('word '.repeat(60), 30).endsWith('…')).toBe(true);
    expect(firstSentence('word '.repeat(60), 30).length).toBeLessThanOrEqual(31);
  });
});

const SOURCE = {
  name: 'Heidi',
  headline: 'Understanding the language spoken around you.',
  website: 'https://heidi.orangecat.ch',
  identity: {
    problem:
      'An adult who commands German cannot follow Zurich German. The Swiss switch the moment you struggle.',
    solution: 'A source of exposure that does not withdraw.',
    vision: 'Progress measured by how much of a stranger you understand.',
  },
  sections: [
    {
      title: 'What exists today',
      body: 'A working assistant.\n\nNineteen situations.\n\nA dialect atlas.',
    },
    { title: 'The ask', body: 'We are raising a pre-seed round. More later.' },
  ],
  numbers: [{ value: '156', label: 'Merged pull requests' }],
  numbersAsOf: '1 October 2026',
  contactEmail: 'cato@orangecat.ch',
  dateLabel: 'October 2026',
};

const DATA: DeckData = {
  facts: [{ value: '170', label: 'Merged to main' }],
  pace: {
    bars: [
      { label: 'Sep 7', value: 30 },
      { label: 'Oct 5', value: 7 },
    ],
    caption: 'From the repo',
  },
  roadmap: [
    { heading: 'Now', items: ['Lexicon'] },
    { heading: 'Later', items: [] },
  ],
};

describe('generateDeck', () => {
  const deck = generateDeck(SOURCE, DATA);

  it('drafts the investor arc, ending on the ask', () => {
    expect(deck.slides.map(s => s.kicker ?? s.layout)).toEqual([
      'Investor deck · October 2026',
      'The problem',
      'The solution',
      'Is it real',
      'How it ships',
      'What exists today',
      'The numbers',
      'Roadmap',
      'Where it goes',
      'The ask',
    ]);
    const closing = deck.slides.at(-1)!;
    expect(closing.title).toBe('We are raising a pre-seed round.');
    expect(closing.action).toEqual({
      label: 'cato@orangecat.ch',
      href: 'mailto:cato@orangecat.ch',
    });
  });

  it('invents nothing: claims come from the source, live figures are bound, not copied', () => {
    expect(deck.slides[1]!.title).toBe('An adult who commands German cannot follow Zurich German.');
    expect(deck.slides[1]!.body).toBe('The Swiss switch the moment you struggle.');
    const real = deck.slides.find(s => s.kicker === 'Is it real')!;
    expect(real.bind).toBe('facts');
    expect(real.stats).toBeUndefined();
    expect(deck.slides.find(s => s.kicker === 'What exists today')!.points).toEqual([
      'Nineteen situations.',
      'A dialect atlas.',
    ]);
  });

  it('leaves out evidence slides it has no data for', () => {
    const bare = generateDeck({ name: 'X' });
    expect(bare.slides.map(s => s.layout)).toEqual(['cover', 'closing']);
  });
});

describe('bindDeck', () => {
  it('fills bound slides from live data, and leaves them as written when data is absent', () => {
    const deck = generateDeck(SOURCE, DATA);
    const bound = bindDeck(deck, DATA);
    expect(bound.slides.find(s => s.bind === 'facts')!.stats).toEqual(DATA.facts);
    expect(bound.slides.find(s => s.bind === 'pace')!.bars).toEqual(DATA.pace!.bars);
    // An empty column is not shown as a heading with nothing under it.
    expect(bound.slides.find(s => s.bind === 'roadmap')!.columns).toEqual([
      { heading: 'Now', items: ['Lexicon'] },
    ]);
    const unbound = bindDeck(deck, {});
    expect(unbound.slides.find(s => s.bind === 'facts')!.stats).toBeUndefined();
  });
});
