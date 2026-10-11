/**
 * The OrangeCat mark in React — a coil that is a cat.
 *
 * Geometry comes from the SSOT (src/config/brand-mark.ts); this file only
 * strokes it with `currentColor` so it follows the text colour and the theme.
 * The same path drives favicon.svg, the PWA icons and the share cards.
 *
 * `animated` draws the coil in from its tail to its centre once, then lets
 * it breathe — the hero treatment. Chrome-sized marks stay still: a 22px
 * glyph that moves reads as noise, not brand.
 */

import { BRAND_MARK, catCoilPathD } from '@/config/brand-mark';
import { cn } from '@/lib/utils';

export interface BrandMarkIconProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

export function BrandMarkIcon({ size = 24, className, animated = false }: BrandMarkIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${BRAND_MARK.viewBox} ${BRAND_MARK.viewBox}`}
      fill="none"
      className={cn('oc-brand-coil', animated && 'oc-brand-coil-animated', className)}
      aria-hidden
    >
      <path
        d={catCoilPathD()}
        pathLength={1}
        stroke="currentColor"
        strokeWidth={BRAND_MARK.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
