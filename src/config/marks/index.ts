/**
 * Every product's mark, by fleet slug — from @bitbaum/design-tokens/marks,
 * the one place the fleet's marks live. OrangeCat's tiles, banners, share
 * cards and its own icons read them from there, so a logo is replaced once,
 * in that package, and every product follows on the next release.
 *
 * The cat itself is still drawn by generators/cat-rotorelief.ts here; the
 * package stores its output, and __tests__/unit/config/brand-mark.test.ts
 * fails if the two ever differ.
 */

import { MARKS } from '@bitbaum/design-tokens/marks';

export { MARKS, markFor } from '@bitbaum/design-tokens/marks';

export type MarkSlug = keyof typeof MARKS;
