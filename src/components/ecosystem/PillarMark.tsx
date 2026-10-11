import { Scale } from 'lucide-react';
import { BrandMarkIcon } from '@/components/shell/BrandMarkIcon';
import type { EcosystemPillar } from '@/config/ecosystem';
import { LOKI_MARK, lokiSpiralPathD } from '@/config/sibling-marks';
import { cn } from '@/lib/utils';

export interface PillarMarkProps {
  pillar: EcosystemPillar['key'];
  size?: number;
  className?: string;
  /** Let the mark move: OrangeCat's coil draws itself, Loki's turns slowly. */
  animated?: boolean;
}

/**
 * The real face of each pillar — OrangeCat's coil, Loki's coil, Solon's
 * scales — stroked with currentColor so the trio sits in any text colour.
 * Every surface that presents the stack renders these, never a generic icon
 * standing in for a product that has a mark of its own.
 */
export function PillarMark({ pillar, size = 24, className, animated = false }: PillarMarkProps) {
  if (pillar === 'orangecat') {
    return <BrandMarkIcon size={size} className={className} animated={animated} />;
  }
  if (pillar === 'loki') {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${LOKI_MARK.viewBox} ${LOKI_MARK.viewBox}`}
        fill="none"
        className={cn('oc-sibling-coil', animated && 'oc-sibling-coil-animated', className)}
        aria-hidden
      >
        <path
          d={lokiSpiralPathD()}
          stroke="currentColor"
          strokeWidth={LOKI_MARK.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return <Scale width={size} height={size} strokeWidth={1.75} className={className} aria-hidden />;
}
