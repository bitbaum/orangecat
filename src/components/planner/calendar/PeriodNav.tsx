'use client';

/** Back a period, back to today, forward a period. */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CALENDAR_COPY } from './copy';

const iconButton =
  'flex h-11 w-11 items-center justify-center rounded-full text-fg-primary hover:bg-surface-raised';

export function PeriodNav({
  onPrevious,
  onToday,
  onNext,
}: {
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        className={iconButton}
        aria-label={CALENDAR_COPY.previous}
        onClick={onPrevious}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onToday}
        className="min-h-11 rounded-full border border-default px-3 text-sm text-fg-primary hover:bg-surface-raised"
      >
        {CALENDAR_COPY.today}
      </button>
      <button type="button" className={iconButton} aria-label={CALENDAR_COPY.next} onClick={onNext}>
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
