import { highlightParts, queryWords } from '@/lib/search/highlight';

const marked = (text: string, query: string) =>
  highlightParts(text, query)
    .filter(p => p.match)
    .map(p => p.text);

describe('highlightParts', () => {
  it('marks every typed word, case- and accent-insensitively', () => {
    expect(marked('Remise Rosa in Zürich', 'zurich')).toEqual(['Zürich']);
    expect(marked('Minimal DJ Sets & Sound', 'dj sound')).toEqual(['DJ', 'Sound']);
    expect(marked('Loki loki', 'LOKI')).toEqual(['Loki', 'loki']);
  });

  it('marks a prefix the way the engine matches one, and only at a word start', () => {
    expect(marked('Bitcoin hardware wallet', 'bit')).toEqual(['Bit']);
    expect(marked('the technological local loop', 'lo')).toEqual(['lo', 'lo']);
    expect(marked('Fix My Velo', 'lo')).toEqual([]);
  });

  it('keeps the original text intact, in order', () => {
    const text = 'Café Zürich — open late';
    expect(
      highlightParts(text, 'cafe late')
        .map(p => p.text)
        .join('')
    ).toBe(text);
  });

  it('returns the text unmarked for an empty query, and nothing for empty text', () => {
    expect(highlightParts('Loki', '  ')).toEqual([{ text: 'Loki', match: false }]);
    expect(highlightParts('', 'loki')).toEqual([]);
  });

  it('splits a query into folded words, once each', () => {
    expect(queryWords('  Zürich, zurich & DJ ')).toEqual(['zurich', 'dj']);
  });
});
