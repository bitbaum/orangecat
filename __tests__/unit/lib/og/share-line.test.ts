/**
 * The line a project's share card carries under its title.
 */

import { shareLine } from '@/lib/og/share-line';

describe('shareLine', () => {
  it('is empty for no description', () => {
    expect(shareLine(null)).toBe('');
    expect(shareLine('   ')).toBe('');
  });

  it('takes the first sentence when it is a reasonable length', () => {
    expect(shareLine('Help fund a new ceramics workshop. It opens in May.')).toBe(
      'Help fund a new ceramics workshop.'
    );
  });

  it('keeps a short description whole', () => {
    expect(shareLine('A shared kiln for the street')).toBe('A shared kiln for the street');
  });

  it('cuts a long run-on on a word boundary, with an ellipsis', () => {
    const line = shareLine(`${'word '.repeat(60)}end`);
    expect(line.endsWith('…')).toBe(true);
    expect(line.length).toBeLessThanOrEqual(141);
    expect(line).not.toMatch(/\s…$/);
  });

  it('collapses the line breaks people typed', () => {
    expect(shareLine('Two\n\nlines   here')).toBe('Two lines here');
  });
});
