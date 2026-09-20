'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import EntityListShell from '@/components/entity/EntityListShell';
import {
  SETTINGS_SECTIONS,
  RELATED_SETTINGS,
  isSettingsSectionActive,
} from '@/config/settings-nav';

/**
 * SettingsShell — the one header + tab rail every /settings/* page renders
 * inside (mounted by the settings layout, so pages can't drift back to
 * hand-rolled headers). Sections come from the SETTINGS_SECTIONS SSOT.
 *
 * Tabs are a horizontal, scrollable rail: identical on mobile and desktop,
 * 44px touch targets, active tab underlined with the warm accent.
 */
export default function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const active = SETTINGS_SECTIONS.find(s => isSettingsSectionActive(s.href, pathname));
  const railRef = useRef<HTMLUListElement>(null);

  // Bring the active tab into view. A scrollable rail that always starts at
  // its left edge can leave you on a section whose tab is off-screen, with
  // nothing on screen saying where you are.
  useEffect(() => {
    const current = railRef.current?.querySelector('[aria-current="page"]');
    current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <EntityListShell title="Settings" description={active?.description}>
      {/* The rail scrolls horizontally, so two things have to be true: the
          native scrollbar must not paint a grey track across the middle of the
          UI (Android does, and it read as a rendering bug), and the fact that
          there is more to the right has to be visible as something other than
          a word chopped in half — "Usage" rendered as "Us". A fade on the
          trailing edge says "keep swiping"; a truncated word says "broken". */}
      <nav aria-label="Settings sections" className="relative border-b border-subtle">
        <ul ref={railRef} className="no-scrollbar -mb-px flex gap-1 overflow-x-auto pr-8">
          {SETTINGS_SECTIONS.map(section => {
            const Icon = section.icon;
            const isActive = section === active;
            return (
              <li key={section.href} className="shrink-0">
                <Link
                  href={section.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'flex min-h-11 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'border-accent-warm text-fg-primary'
                      : 'border-transparent text-fg-secondary hover:border-default hover:text-fg-primary'
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface-page to-transparent"
          aria-hidden
        />
      </nav>

      {/* `min-h-11` on inline text links inside a wrapping row gave each link a
          44px box, so the row wrapped into ragged two-line blocks with the
          "Related:" label orphaned. These are secondary text links, not
          thumb targets in a tab bar: the row gets the height, the links get
          padding, and the wrap is even. */}
      <div className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-2 pt-3 text-sm">
        <span className="text-fg-tertiary">Related:</span>
        {RELATED_SETTINGS.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.description}
              className="inline-flex items-center gap-1.5 py-1.5 text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline"
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="pt-6">{children}</div>
    </EntityListShell>
  );
}
