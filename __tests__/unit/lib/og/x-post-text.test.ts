/**
 * The text "Share on X" prefills. It used to carry the whole description
 * (434-983 characters on production), so X opened over its 280 limit with
 * Post disabled and the hashtags past the cut.
 */

import { shareLine, xPostText, xWeightedLength } from '@/lib/og/share-line';

// X counts the link as 23 and joins it to the text with a space.
const TEXT_BUDGET = 280 - 23 - 1;
const TAGS = '#Bitcoin #OrangeCat';

const LONG_DESCRIPTION =
  'Loki is the capability layer of a three-product thesis: a captain over a fleet of AI agents ' +
  'that builds and ships software for the projects people fund here, with every step on the ' +
  'record. '.repeat(6);

describe('xPostText', () => {
  it('fits one post beside the link when the description is long', () => {
    const text = xPostText('Support: Loki', LONG_DESCRIPTION, TAGS);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(TEXT_BUDGET);
    expect(text.startsWith('Support: Loki\n\n')).toBe(true);
    expect(text).toContain(shareLine(LONG_DESCRIPTION));
    expect(text).not.toContain(LONG_DESCRIPTION.trim());
  });

  it('keeps title, line and tags when they fit', () => {
    expect(xPostText('Support: Kiln', 'A shared kiln for the street.', TAGS)).toBe(
      `Support: Kiln\n\nA shared kiln for the street.\n\n${TAGS}`
    );
  });

  it('drops the tags before the line', () => {
    const title = `Support: ${'A'.repeat(80)}`;
    const description = `${'word '.repeat(30)}end.`;
    const text = xPostText(title, description, TAGS);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(TEXT_BUDGET);
    expect(text).toContain(shareLine(description));
    expect(text).not.toContain('#Bitcoin');
  });

  it('is the title and tags for no description', () => {
    expect(xPostText('Marco Rossi on OrangeCat', null, TAGS)).toBe(
      `Marco Rossi on OrangeCat\n\n${TAGS}`
    );
  });

  it('cuts a title longer than a post on a word boundary', () => {
    const text = xPostText('word '.repeat(80).trim(), null, TAGS);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(TEXT_BUDGET);
    expect(text.endsWith('word…')).toBe(true);
  });

  it('counts the way X does: CJK and emoji weigh two', () => {
    expect(xWeightedLength('abc')).toBe(3);
    expect(xWeightedLength('Zürich — “hi”')).toBe(13);
    expect(xWeightedLength('日本')).toBe(4);
    expect(xWeightedLength('🙂')).toBe(2);
    const text = xPostText('支持', '日本語の説明。'.repeat(40), TAGS);
    expect(xWeightedLength(text)).toBeLessThanOrEqual(TEXT_BUDGET);
  });
});
