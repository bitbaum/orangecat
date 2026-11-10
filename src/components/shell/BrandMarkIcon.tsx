/**
 * This app's own mark, wherever the brand appears (header, auth, hero).
 *
 * It renders BRAND_MARK — MARKS[APP_SLUG] from @bitbaum/design-tokens/marks
 * — through the generic <Mark>, so replacing the logo never touches this
 * file: `pnpm run marks:import orangecat path/to/logo.svg` in that package.
 */

import { Mark } from '@/components/brand/Mark';
import { BRAND_MARK } from '@/config/brand-mark';

export interface BrandMarkIconProps {
  size?: number;
  className?: string;
  /** Hero treatment only — see <Mark animated>. */
  animated?: boolean;
}

export function BrandMarkIcon({ size = 24, className, animated = false }: BrandMarkIconProps) {
  return <Mark mark={BRAND_MARK} size={size} className={className} animated={animated} />;
}
