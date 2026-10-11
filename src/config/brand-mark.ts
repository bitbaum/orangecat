/**
 * This app's own mark — whichever file src/config/marks/<APP_SLUG>.ts holds.
 *
 * Everything that shows the brand imports BRAND_MARK from here and renders it
 * generically (<Mark>, markSvg, the share cards, the static icons), so the
 * mark is replaced by replacing that one file:
 *
 *   pnpm run brand:import orangecat path/to/logo.svg
 *
 * See docs/design-system/branding-design.md → "Replacing a mark".
 */

import { APP_SLUG } from './brand';
import { MARKS } from './marks';
import type { MarkDefinition } from './marks/types';

export const BRAND_MARK: MarkDefinition = MARKS[APP_SLUG];
