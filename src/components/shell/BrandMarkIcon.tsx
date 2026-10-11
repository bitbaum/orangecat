/**
 * This app's own mark, wherever the brand appears (header, auth, hero).
 *
 * It renders BRAND_MARK — whichever file src/config/marks/<APP_SLUG>.ts holds
 * — through the generic <Mark>, so replacing the logo never touches this
 * file: `pnpm run brand:import orangecat path/to/logo.svg`.
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
