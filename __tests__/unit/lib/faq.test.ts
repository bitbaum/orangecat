import { blocksToText } from '@bitbaum/bip-kit';
import {
  CAT_BEYOND_FREE_COPY,
  CAT_CREDITS_ON_SALE,
  CAT_FREE_DAILY_LIMIT,
  CAT_ROUTES_COPY,
  getCatPlan,
} from '@/config/cat-plans';
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

  // /faq said "you can add credits" while /pricing badged Cat Credits "Not
  // open yet". Both now read CAT_CREDITS_ON_SALE.
  it('says about Cat Credits what the pricing card says', () => {
    const free = blocksToText(items.find(i => i.question === 'Is OrangeCat free to use?')!.blocks);
    const powers = blocksToText(
      items.find(i => i.question === 'What powers Cat, and who pays for it?')!.blocks
    );
    expect(free).toContain(CAT_BEYOND_FREE_COPY);
    expect(powers).toContain(CAT_ROUTES_COPY);
    const onSale = getCatPlan('credits').status === 'available';
    expect(onSale).toBe(CAT_CREDITS_ON_SALE);
    expect(free.includes('add credits')).toBe(onSale);
    expect(/^Four routes/.test(powers)).toBe(onSale);
  });

  it('fails on an unknown placeholder instead of printing it', () => {
    expect(() => fillFaqPlaceholders('{{CAT_FREE_DAILY_LIMT}}')).toThrow(/unknown placeholder/);
  });
});
