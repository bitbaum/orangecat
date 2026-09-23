'use client';

/**
 * SegmentedControl — SSOT for the pill-in-a-trough switch.
 *
 * It existed three times by copy-paste (the Money tabs and Send's
 * person/invoice switch among them) with the class strings typed out again
 * each time — so they drifted the moment one was touched.
 *
 * Two modes, because a segment is sometimes a route and sometimes local state:
 *  - give an item an `href` and it renders as a link (real navigation, real
 *    middle-click, `aria-current="page"`);
 *  - leave it off and it renders as a button reporting through `onChange`.
 *
 * Every segment is at least 44px tall — a control this size is aimed at with a
 * thumb far more often than a cursor.
 */

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

export interface SegmentedItem<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Present ⇒ this segment navigates instead of setting local state. */
  href?: string;
}

interface SegmentedControlProps<T extends string> {
  items: readonly SegmentedItem<T>[];
  /** The currently selected segment's value. */
  value: T;
  /** Required for button-mode items; ignored for links. */
  onChange?: (value: T) => void;
  /** Names the group for screen readers, e.g. "Money surface". */
  label: string;
  className?: string;
}

const SEGMENT_BASE =
  'flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-3 sm:text-sm';
const SEGMENT_ACTIVE = 'bg-surface-base text-fg-primary shadow-sm';
const SEGMENT_IDLE = 'text-fg-secondary hover:text-fg-primary';

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex gap-1 rounded-lg bg-surface-raised p-1', className)}
    >
      {items.map(item => {
        const active = item.value === value;
        const classes = cn(SEGMENT_BASE, active ? SEGMENT_ACTIVE : SEGMENT_IDLE);
        const content = (
          <>
            {item.icon && <item.icon className="h-4 w-4" aria-hidden="true" />}
            {item.label}
          </>
        );

        return item.href ? (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={classes}
          >
            {content}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) {
                haptic('tap');
              }
              onChange?.(item.value);
            }}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
