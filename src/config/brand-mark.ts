/**
 * This app's own mark — MARKS[APP_SLUG] from @bitbaum/design-tokens/marks.
 *
 * Everything that shows the brand imports BRAND_MARK from here and renders it
 * generically (<Mark>, markSvg, the share cards, the static icons), so the
 * mark is replaced by replacing that one file:
 *
 *   pnpm run marks:import orangecat path/to/logo.svg   (in bitbaum/design-tokens)
 *
 * See docs/design-system/branding-design.md → "Replacing a mark".
 */

import { APP_SLUG } from './brand';
import { MARKS } from './marks';
import type { MarkDefinition } from './marks/types';

export const BRAND_MARK: MarkDefinition = MARKS[APP_SLUG];
