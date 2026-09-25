'use client';

/**
 * The Cat settings page's summary AND its section menu, as one sticky row:
 * each item names a section and carries its current state ("Sees · 3 of 4
 * connected"), so reading the row answers "how is Cat set up?" and tapping it
 * goes to the place to change it. One row instead of a summary plus a menu.
 */

import { cn } from '@/lib/utils';

export interface CatSettingsNavItem {
  id: string;
  label: string;
  /** Current state in a few words; null while loading. */
  value: string | null;
}

export function CatSettingsNav({ items }: { items: CatSettingsNavItem[] }) {
  return (
    <nav
      aria-label="Cat settings sections"
      className="sticky top-14 z-10 -mx-4 border-b border-subtle bg-surface-page/95 px-4 py-2 backdrop-blur sm:top-16 sm:mx-0 sm:rounded-lg sm:border sm:px-2"
    >
      <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {items.map(item => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex min-h-12 flex-col justify-center rounded-md px-3 py-1.5 transition-colors hover:bg-surface-raised"
            >
              <span className="text-sm font-medium text-fg-primary">{item.label}</span>
              <span
                className={cn(
                  'truncate text-xs text-fg-secondary',
                  item.value === null && 'h-3 w-20 animate-pulse rounded bg-surface-raised'
                )}
              >
                {item.value}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
