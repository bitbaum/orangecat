/**
 * A companion's log lines are memory, not speech. Before this, a reply read
 * "Urban beekeeping in Zurich sounds fascinating.\nAbout | Keeps bees on their
 * balcony in Zurich." — the bookkeeping printed to the person it was about.
 */
import { describe, expect, it } from 'vitest';
import { statedMemoryLines, visibleReply } from '@/services/companions/memory-lines';
import { cloneTitle } from '@/services/companions/clone';

const reply = [
  'Urban beekeeping in Zurich sounds fascinating.',
  'About | Keeps bees on their balcony in Zurich.',
  '- Method log | sleep | breath count | no move | too tired to count',
  '> Do not | journaling for sleep | failed twice',
].join('\n');

describe('the log lines', () => {
  it('are hidden from what the person reads', () => {
    expect(visibleReply(reply)).toBe('Urban beekeeping in Zurich sounds fascinating.');
  });

  it('are still what memory keeps, markup removed', () => {
    expect(statedMemoryLines(reply)).toEqual([
      'About | Keeps bees on their balcony in Zurich.',
      'Method log | sleep | breath count | no move | too tired to count',
      'Do not | journaling for sleep | failed twice',
    ]);
  });

  it('never leave a reply blank — a log-only reply is shown as written', () => {
    const only = 'About | Prefers mornings.';
    expect(visibleReply(only)).toBe(only);
  });

  it('do not swallow a sentence that merely mentions a word like "About"', () => {
    const text = 'About the bees: keep going.';
    expect(visibleReply(text)).toBe(text);
  });
});

describe('a clone', () => {
  it('says it is a copy', () => {
    expect(cloneTitle('Thinker')).toBe('Thinker (copy)');
  });

  it('stays within the 100-character title limit', () => {
    const t = cloneTitle('x'.repeat(100));
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t.endsWith(' (copy)')).toBe(true);
  });
});
