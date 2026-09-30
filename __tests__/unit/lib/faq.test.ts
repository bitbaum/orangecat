import { blocksToText } from 'bip-kit';
import { CAT_FREE_DAILY_LIMIT } from '@/config/cat-plans';
import { fillFaqPlaceholders, getFaqSections } from '@/lib/faq';

describe('content/faq.md', () => {
  const sections = getFaqSections();
  const items = sections.flatMap(s => s.items);

  it('parses into titled sections of questions with answers', () => {
    expect(sections.length).toBeGreaterThanOrEqual(5);
    for (const section of sections) {
      expect(section.title).toBeTruthy();
      expect(section.items.length).toBeGreaterThan(0);
    }
    for (const item of items) {
      expect(blocksToText(item.blocks), item.question).not.toBe('');
    }
  });

  it('fills the Cat numbers from cat-plans, leaving no placeholder behind', () => {
    const free = items.find(i => i.question === 'Is OrangeCat free to use?')!;
    expect(blocksToText(free.blocks)).toContain(`${CAT_FREE_DAILY_LIMIT} free messages a day`);
    for (const item of items) {
      expect(blocksToText(item.blocks)).not.toMatch(/\{\{/);
    }
  });

  it('fails on an unknown placeholder instead of printing it', () => {
    expect(() => fillFaqPlaceholders('{{CAT_FREE_DAILY_LIMT}}')).toThrow(/unknown placeholder/);
  });
});
