'use client';

/**
 * Three sliders that always sum to 100, and the bar that shows the split at a
 * glance. Moving one level takes the difference from the other two in
 * proportion (rebalanceShares), so the person never has to do the arithmetic
 * and can never save a split that is not one.
 */
import { CIVIC_LEVELS, CIVIC_SPLIT_TOTAL, type CivicLevelId } from '@/config/civic-split';
import { rebalanceShares, type CivicShares } from '@/domain/civic-split/schema';
import { cn } from '@/lib/utils';

/** One colour per level, from the semantic tier — nothing chromatic. */
const LEVEL_BAR: Record<CivicLevelId, string> = {
  locality: 'bg-accent-warm',
  region: 'bg-fg-secondary',
  nation: 'bg-fg-muted',
};

interface ShareSlidersProps {
  shares: CivicShares;
  onChange: (shares: CivicShares) => void;
  /** Place names typed above, echoed beside each level so it reads as theirs. */
  placeNames: Partial<Record<CivicLevelId, string>>;
  disabled?: boolean;
}

export function SplitBar({ shares, className }: { shares: CivicShares; className?: string }) {
  return (
    <div
      className={cn('flex h-3 w-full overflow-hidden rounded-full bg-surface-raised', className)}
      role="img"
      aria-label={CIVIC_LEVELS.map(l => `${l.label} ${shares[l.id]}%`).join(', ')}
    >
      {CIVIC_LEVELS.map(level => (
        <div
          key={level.id}
          className={cn('h-full transition-[width] duration-200', LEVEL_BAR[level.id])}
          style={{ width: `${shares[level.id]}%` }}
        />
      ))}
    </div>
  );
}

export default function ShareSliders({
  shares,
  onChange,
  placeNames,
  disabled,
}: ShareSlidersProps) {
  return (
    <div className="space-y-5">
      <SplitBar shares={shares} />
      {CIVIC_LEVELS.map(level => {
        const id = `civic-share-${level.id}`;
        const name = placeNames[level.id]?.trim();
        return (
          <div key={level.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={id} className="flex items-center gap-2 text-sm text-fg-primary">
                <span
                  className={cn('inline-block h-2.5 w-2.5 rounded-full', LEVEL_BAR[level.id])}
                  aria-hidden="true"
                />
                <span className="font-medium">{name || level.label}</span>
                {name && <span className="text-fg-tertiary">{level.label.toLowerCase()}</span>}
              </label>
              <span className="font-heading text-lg tabular-nums text-fg-primary">
                {shares[level.id]}%
              </span>
            </div>
            <input
              id={id}
              type="range"
              min={0}
              max={CIVIC_SPLIT_TOTAL}
              step={1}
              value={shares[level.id]}
              disabled={disabled}
              onChange={e => onChange(rebalanceShares(shares, level.id, Number(e.target.value)))}
              className="h-2 w-full cursor-pointer accent-accent-warm disabled:cursor-not-allowed disabled:opacity-50"
              aria-valuetext={`${shares[level.id]} percent to ${name || level.label}`}
            />
            <p className="text-xs text-fg-tertiary">{level.hint}</p>
          </div>
        );
      })}
    </div>
  );
}
