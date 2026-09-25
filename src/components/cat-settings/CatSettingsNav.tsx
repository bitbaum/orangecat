'use client';

/**
 * The Cat settings page's summary AND its section menu, as one pinned bar:
 * each item names a section and carries its current state ("Sees · 3 of 4"),
 * and the section you are reading is highlighted.
 *
 * A flat bar across the column, not a floating card: the card version sat in
 * mid-air over the content, and on phones its 2×2 grid covered a fifth of the
 * screen. Now ONE row — swipeable on a phone, the four items evenly spread
 * from sm up — pinned under the header, and to the very top once the header
 * hides (`.sticky-below-header`).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface CatSettingsNavItem {
  id: string;
  label: string;
  /** Current state in a few words; null while loading. */
  value: string | null;
}

/** The section whose top most recently crossed the upper third of the screen. */
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActive(visible[0].target.id);
        }
      },
      { rootMargin: '-20% 0px -65% 0px' }
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
      }
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

export function CatSettingsNav({ items }: { items: CatSettingsNavItem[] }) {
  const ids = items.map(i => i.id);
  const active = useActiveSection(ids);

  return (
    <nav
      aria-label="Cat settings sections"
      className="sticky-below-header z-10 -mx-4 border-b border-subtle bg-surface-page sm:-mx-6"
    >
      <ul className="no-scrollbar flex gap-1 overflow-x-auto px-4 py-2 sm:grid sm:grid-cols-4 sm:px-6">
        {items.map(item => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="flex-shrink-0">
              <a
                href={`#${item.id}`}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'flex min-h-11 flex-col justify-center rounded-md px-3 py-1 transition-colors',
                  isActive ? 'bg-surface-raised' : 'hover:bg-surface-raised/60'
                )}
              >
                <span
                  className={cn(
                    'text-sm',
                    isActive ? 'font-semibold text-fg-primary' : 'font-medium text-fg-secondary'
                  )}
                >
                  {item.label}
                </span>
                {item.value === null ? (
                  <span className="mt-0.5 h-3 w-16 animate-pulse rounded bg-surface-raised" />
                ) : (
                  <span className="whitespace-nowrap text-xs text-fg-tertiary">{item.value}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
