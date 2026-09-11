/**
 * The public address of a page set up for someone (ADR-0005 D7), from her
 * name as the steward typed it.
 *
 * `slugify()` keeps ASCII only, so a Cyrillic, Greek or accented name produced
 * an EMPTY slug and the claim fell back to the word "someone" — which then
 * became her handle on claim (walked live 2026-09-11: Марина → /profiles/someone,
 * @someone). A Lightning address made of a placeholder word, shared with the
 * next Марина. Names are transliterated first; a name that still yields
 * nothing gets `person-<random>`, never a dictionary word.
 */

import { randomBytes } from 'node:crypto';
import { slugify } from '@/utils/string';

const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ґ: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'yi',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

/** Latin letters keep their base (é → e, ü → u, ß → ss); Cyrillic is mapped. */
export function transliterate(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[Ѐ-ӿ]/g, ch => {
      const lower = ch.toLowerCase();
      const out = CYRILLIC[lower];
      return out === undefined ? '' : out;
    });
}

export function claimSlugFor(name: string): string {
  const base = slugify(transliterate(name), { maxLength: 40, randomSuffix: false });
  return base || `person-${randomBytes(3).toString('hex')}`;
}
