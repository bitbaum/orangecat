import { metaDescription } from '@/lib/og/share-line';

describe('metaDescription', () => {
  it('keeps a short description whole', () => {
    expect(metaDescription('Learn Swiss German.')).toBe('Learn Swiss German.');
  });
  it('cuts a long one on a word boundary with an ellipsis, within the limit', () => {
    const long = 'Loki is the capability layer of a three-product thesis: '.repeat(10);
    const out = metaDescription(long);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
    expect(long.startsWith(out.slice(0, -1))).toBe(true);
    expect(out.slice(0, -1)).not.toMatch(/[\s:]$/);
  });
  it('is empty for nothing', () => {
    expect(metaDescription(null)).toBe('');
  });
});
