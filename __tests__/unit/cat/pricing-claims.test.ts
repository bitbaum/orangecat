/**
 * What we tell users about their money must agree with itself.
 *
 * Two adjacent screens made two different claims about the same charge:
 * /settings/ai said credits are "priced near cost" (a hardcoded string) while
 * /settings/usage said "provider cost + 40%" (derived from CREDIT_USAGE_MARKUP,
 * under a comment reading "derived so marketing never drifts"). It drifted in
 * the one place the comment was defending, and +40% is not "near cost".
 *
 * The same shape bit the provider list: the literal "Six providers wired
 * direct:" sat immediately before a DERIVED list of them, so wiring a seventh
 * made the sentence contradict its own next clause.
 *
 * These pin the rule rather than the wording: a number about money or
 * inventory is derived, or it is wrong the next time someone changes the
 * thing it describes.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAT_CREDITS_MARKUP_LABEL,
  CAT_WIRED_PROVIDERS,
  CAT_WIRED_PROVIDER_COUNT_WORD,
  CAT_PLANS,
} from '@/config/cat-plans';
import { CREDIT_USAGE_MARKUP } from '@/services/cat/credit-metering';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('the credit markup is stated once', () => {
  it('derives the label from the metering constant', () => {
    expect(CAT_CREDITS_MARKUP_LABEL).toBe(
      `provider cost + ${Math.round((CREDIT_USAGE_MARKUP - 1) * 100)}%`
    );
  });

  it('no surface claims credits are "near cost" while we charge a markup', () => {
    const panel = read('src/components/ai/CatCreditsPanel.tsx');
    expect(panel).not.toMatch(/near cost/i);
    expect(panel).toContain('CAT_CREDITS_MARKUP_LABEL');
  });
});

describe('the provider count is derived', () => {
  it('the word matches the list length', () => {
    const words = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
    expect(CAT_WIRED_PROVIDER_COUNT_WORD).toBe(words[CAT_WIRED_PROVIDERS.length]);
  });

  it('the BYOK plan never hardcodes a count beside the derived list', () => {
    const byok = CAT_PLANS.find(p => p.id === 'byok')!;
    const line = byok.bullets.find(b => b.includes('wired direct'))!;
    expect(line).toContain(CAT_WIRED_PROVIDER_COUNT_WORD);
    expect(line).toContain(CAT_WIRED_PROVIDERS[0]);
  });
});

describe('image generation is described honestly', () => {
  it('is not called "free" — it is billed to Cat Credits', () => {
    const usage = read('src/app/(authenticated)/settings/usage/page.tsx');
    expect(usage).not.toMatch(/Image generation is free/i);
    expect(usage).toMatch(/Cat\s*\n?\s*Credits/);
  });
});

describe('a plan nobody can buy does not claim to be arriving', () => {
  const supporter = CAT_PLANS.find(p => p.id === 'supporter')!;

  it('is not badged "Activating" while it has no price and no checkout', () => {
    if (supporter.status === 'coming-soon') {
      expect(supporter.badge).not.toMatch(/activating/i);
    }
  });

  it('its CTA does not pretend to be a purchase', () => {
    if (supporter.status === 'coming-soon') {
      expect(supporter.cta.label.toLowerCase()).not.toContain('become a supporter →');
    }
  });
});
