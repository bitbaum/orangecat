import { readFileSync } from 'fs';
import path from 'path';
import { parseFaq, parseFrontmatter, type FaqSection } from 'bip-kit';
import { CAT_CREDITS_MARKUP_LABEL, CAT_FREE_DAILY_LIMIT } from '@/config/cat-plans';

const FAQ_PATH = path.join(process.cwd(), 'content/faq.md');

/** The `{{NAME}}` placeholders content/faq.md may use. */
const FAQ_VALUES: Record<string, string> = {
  CAT_FREE_DAILY_LIMIT: String(CAT_FREE_DAILY_LIMIT),
  CAT_CREDITS_MARKUP_LABEL,
};

/** Fills `{{NAME}}` from FAQ_VALUES; an unknown name throws, so a typo fails the build. */
export function fillFaqPlaceholders(markdown: string): string {
  return markdown.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (!(name in FAQ_VALUES)) {
      throw new Error(`content/faq.md: unknown placeholder ${match}`);
    }
    return FAQ_VALUES[name];
  });
}

/** The questions at /faq, read once at build time (the page is static). */
export function getFaqSections(): FaqSection[] {
  const { body } = parseFrontmatter(readFileSync(FAQ_PATH, 'utf8'));
  return parseFaq(fillFaqPlaceholders(body));
}
