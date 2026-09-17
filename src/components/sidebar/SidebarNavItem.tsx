/**
 * Sidebar Navigation Item Component
 *
 * Reusable component for rendering navigation items in the sidebar
 * Follows DRY principle by centralizing item rendering logic
 *
 * Fixed-width sidebar pattern with flyout tooltips:
 * - Desktop: Icon-only with flyout tooltip on hover (appears to the right)
 * - Mobile: Full text labels when drawer is open
 * - Clean, no jarring animations
 *
 * Created: 2025-01-27
 * Last Modified: 2026-01-07
 * Last Modified Summary: Replaced hover-expand with flyout tooltips for desktop
 */

'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { NavItem } from '@/hooks/useNavigation';
import { navigationLabels } from '@/config/navigation';
import { SIDEBAR_COLORS, SIDEBAR_SPACING } from '@/constants/sidebar';
import { useUnreadCount } from '@/stores/messaging';
import { FlyoutTooltip } from './FlyoutTooltip';

interface SidebarNavItemProps {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  onNavigate?: () => void;
}

/**
 * Reusable sidebar navigation item component
 *
 * Fixed-width pattern:
 * - Desktop (collapsed): Icon centered with flyout tooltip on hover
 * - Mobile (expanded): Icon + text inline
 */
export function SidebarNavItem({ item, isActive, isExpanded, onNavigate }: SidebarNavItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  // Counter source is config-driven (item.counter='messages') instead
  // of comparing href. Adding a new counter (e.g. notifications dot) is
  // a NavItem-config change, not a SidebarNavItem change. useUnreadCount
  // is called unconditionally to respect Rules of Hooks; when
  // item.counter is unset the value is simply ignored.
  const unreadCount = useUnreadCount();
  const count = item.counter === 'messages' ? unreadCount : 0;
  const showMessagesBadge = item.counter === 'messages';

  // Active style follows the x.ai / Loki pattern: subtle background +
  // a 2px inset accent bar on the left edge, instead of a full bordered
  // pill. Two visual axes change (text color + accent bar) — restraint
  // rather than a chunky shape shift between inactive/active.
  const linkClasses = [
    'group relative flex items-center rounded-md py-2.5 text-sm font-medium transition-colors duration-150',
    SIDEBAR_SPACING.ITEM_HEIGHT,
    isExpanded ? 'px-3' : 'mx-2 justify-center',
    isActive
      ? `${SIDEBAR_COLORS.ACTIVE_BACKGROUND} ${SIDEBAR_COLORS.ACTIVE_TEXT} shadow-[inset_2px_0_0_hsl(var(--text-primary))]`
      : item.comingSoon
        ? `text-fg-secondary ${SIDEBAR_COLORS.HOVER_BACKGROUND} hover:text-fg-primary`
        : `text-fg-primary ${SIDEBAR_COLORS.HOVER_BACKGROUND}`,
  ].join(' ');

  const iconClasses = [
    'h-5 w-5 shrink-0 transition-colors',
    isActive
      ? 'text-fg-primary'
      : item.comingSoon
        ? 'text-fg-secondary group-hover:text-fg-secondary dark:group-hover:text-fg-secondary'
        : 'text-fg-secondary group-hover:text-fg-primary dark:group-hover:text-fg-primary',
  ].join(' ');

  return (
    <div
      ref={itemRef}
      className="relative overflow-visible"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={item.href || '#'}
        className={linkClasses}
        onClick={onNavigate}
        aria-label={item.comingSoon ? `${item.name} - ${navigationLabels.COMING_SOON}` : item.name}
      >
        {item.icon && <item.icon className={iconClasses} />}

        {/* Collapsed (desktop): tiny unread dot for Messages */}
        {showMessagesBadge && count > 0 && !isExpanded && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-sm border-2 border-surface-page bg-fg-primary"></span>
        )}

        {/* Expanded (mobile): Show text labels inline */}
        {isExpanded && (
          <div className="flex-1 min-w-0 ml-3">
            <span className="whitespace-nowrap overflow-hidden text-ellipsis block">
              {item.name}
            </span>
            {item.description && (
              <span className="block text-xs text-fg-secondary mt-0.5 leading-tight line-clamp-1">
                {item.description}
              </span>
            )}
          </div>
        )}

        {/* Active indicator - only visible on mobile expanded */}
        {isActive && isExpanded && (
          <div className="absolute right-3 h-2 w-2 rounded-sm bg-fg-primary" />
        )}

        {/* Coming soon badge - mobile only */}
        {item.comingSoon && isExpanded && (
          <span className="ml-auto rounded-md bg-surface-raised px-2 py-0.5 text-xs text-fg-secondary">
            Soon
          </span>
        )}

        {/* Static badge - mobile only */}
        {item.badge && !item.comingSoon && isExpanded && (
          <span className="ml-auto rounded-md bg-surface-raised px-2 py-0.5 text-xs font-medium text-fg-primary">
            {item.badge}
          </span>
        )}

        {/* Dynamic messages unread badge - mobile only */}
        {showMessagesBadge && count > 0 && isExpanded && (
          <span className="ml-auto rounded-md bg-fg-primary px-2 py-0.5 text-xs font-medium text-fg-inverted">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>

      {/* Flyout Tooltip - Desktop only, appears on hover to the right of icon */}
      {!isExpanded && isHovered && (
        <FlyoutTooltip isVisible={true} targetElement={itemRef.current}>
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.name}</span>

            {/* Show badges in tooltip */}
            {item.comingSoon && (
              <span className="rounded bg-surface-raised px-1.5 py-0.5 text-xs text-fg-secondary">
                Soon
              </span>
            )}
            {item.badge && !item.comingSoon && (
              <span className="text-xs bg-fg-primary text-fg-inverted px-1.5 py-0.5 rounded font-medium">
                {item.badge}
              </span>
            )}
            {showMessagesBadge && count > 0 && (
              <span className="text-xs bg-fg-primary text-fg-inverted px-1.5 py-0.5 rounded font-medium">
                {count > 99 ? '99+' : count}
              </span>
            )}
          </div>
        </FlyoutTooltip>
      )}
    </div>
  );
}
