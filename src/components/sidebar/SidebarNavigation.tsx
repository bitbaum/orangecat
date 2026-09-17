/**
 * Sidebar Navigation Component
 *
 * Displays navigation sections and items in the sidebar
 * Desktop: Icon-only list (section headers hidden)
 * Mobile: Full section headers with collapsible sections
 *
 * Created: 2025-01-07
 * Last Modified: 2026-01-07
 * Last Modified Summary: Hide section headers on desktop for fixed-width sidebar
 */

'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NavSection, NavItem } from '@/hooks/useNavigation';
import { navigationLabels } from '@/config/navigation';
import { SidebarNavItem } from './SidebarNavItem';

interface SidebarNavigationProps {
  sections: NavSection[];
  bottomItems: NavItem[];
  isExpanded: boolean;
  collapsedSections: Set<string>;
  isItemActive: (href: string) => boolean;
  toggleSection: (sectionId: string) => void;
  onNavigate?: () => void;
}

export function SidebarNavigation({
  sections,
  bottomItems,
  isExpanded,
  collapsedSections,
  isItemActive,
  toggleSection,
  onNavigate,
}: SidebarNavigationProps) {
  const visibleSections = isExpanded
    ? sections
    : sections.filter(
        (section, index) =>
          section.id === 'main' ||
          index === 0 ||
          section.items.some(item => item.href && isItemActive(item.href))
      );

  return (
    <>
      {/* Navigation Sections */}
      <nav
        className="relative flex-1 space-y-2 overflow-y-auto overflow-x-hidden py-3"
        aria-label={navigationLabels.MAIN_NAVIGATION}
      >
        {visibleSections.map(section => {
          const isCollapsed = collapsedSections.has(section.id);
          const sectionItemsId = `sidebar-section-${section.id}`;

          return (
            <div key={section.id} className="space-y-1">
              {/* Section Divider - Only on desktop for visual separation between icon groups */}
              {!isExpanded && section.id !== sections[0].id && (
                <div className="mx-2 my-2 border-t border-default" />
              )}

              {/* Section Header - Hidden on desktop (icons only), visible on mobile (expanded).
                  The WHOLE row toggles, not just the chevron: a label that looks
                  like a control but isn't reads as a dead click, and the arrow
                  alone is a 44px target inside a full-width row of affordance. */}
              {isExpanded &&
                (section.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={!isCollapsed}
                    // Only reference the panel while it exists — aria-controls
                    // pointing at an unrendered id is an invalid-value violation.
                    aria-controls={isCollapsed ? undefined : sectionItemsId}
                    className="flex w-full min-h-11 items-center justify-between gap-2 rounded-md px-3 mb-1 text-left transition-colors hover:bg-surface-raised active:bg-surface-raised touch-manipulation"
                    aria-label={`${navigationLabels.SECTION_TOGGLE} ${section.title}`}
                  >
                    <h3 className="text-xs font-semibold uppercase text-fg-secondary">
                      {section.title}
                    </h3>
                    {isCollapsed ? (
                      <ChevronRight
                        className="w-4 h-4 shrink-0 text-fg-tertiary"
                        aria-hidden="true"
                      />
                    ) : (
                      <ChevronDown
                        className="w-4 h-4 shrink-0 text-fg-tertiary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                ) : (
                  section.title && (
                    <div className="flex items-center px-3 mb-1">
                      <h3 className="text-xs font-semibold uppercase text-fg-secondary">
                        {section.title}
                      </h3>
                    </div>
                  )
                ))}

              {/* Section Items - always show on desktop, respect collapse on mobile.
                  An explicit toggle always wins: keeping a section open because it
                  happens to hold the active page made the chevron lie and the
                  click look dead. Landing on a page inside a collapsed section is
                  handled at load time, not by overriding the user here. */}
              {(!isExpanded || !section.collapsible || !isCollapsed) && (
                <div id={sectionItemsId} className={`space-y-1 ${isExpanded ? 'px-2' : ''}`}>
                  {section.items.map(item => (
                    <SidebarNavItem
                      key={item.name}
                      item={item}
                      isActive={item.href ? isItemActive(item.href) : false}
                      isExpanded={isExpanded}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Navigation Items */}
      {bottomItems.length > 0 && (
        <div className={`border-t border-subtle py-2 space-y-1 ${isExpanded ? 'px-2' : ''}`}>
          {bottomItems.map(item => (
            <SidebarNavItem
              key={item.name}
              item={item}
              isActive={item.href ? isItemActive(item.href) : false}
              isExpanded={isExpanded}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </>
  );
}
