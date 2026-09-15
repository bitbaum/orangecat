/**
 * The public address of a page set up for someone (ADR-0005 D7), from her
 * name as the steward typed it.
 *
 * `slugify()` used to keep ASCII only, so a Cyrillic, Greek or accented name
 * produced an EMPTY slug and the claim fell back to the word "someone" — which
 * then became her handle on claim (walked live 2026-09-11: Марина →
 * /profiles/someone, @someone). A Lightning address made of a placeholder
 * word, shared with the next Марина. The transliteration that fixed it now
 * lives inside `slugify` itself, where every other caller gets it too. What
 * stays here is the part that is specific to a claim: a name that still yields
 * nothing gets `person-<random>`, never a dictionary word.
 */

import { randomBytes } from 'node:crypto';
import { slugify } from '@/utils/string';

export { transliterate } from '@/utils/string';

export function claimSlugFor(name: string): string {
  const base = slugify(name, { maxLength: 40, randomSuffix: false });
  return base || `person-${randomBytes(3).toString('hex')}`;
}
