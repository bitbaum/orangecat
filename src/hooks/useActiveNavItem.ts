'use client';

import { useMemo, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import type { NavSection } from './useNavigation';
import { ROUTES } from '@/config/routes';
import { isNavHrefActive } from '@/lib/navigation/isActive';

interface UseActiveNavItemReturn {
  activeSection: string | null;
  activeItem: string | null;
  isItemActive: (href: string, activeFor?: readonly string[]) => boolean;
}

/**
 * Resolves which sidebar section/item is "active" for the current route.
 * The matcher is the same `isNavHrefActive` SSOT used by header desktop
 * nav and mobile bottom nav, plus a special case for the Dashboard root
 * (which DOES claim ownership of its sub-pages for sidebar highlighting,
 * since there's no per-subroute sidebar entry).
 */
export function useActiveNavItem(sections: NavSection[]): UseActiveNavItemReturn {
  const pathname = usePathname();

  const isItemActive = useCallback(
    (href: string, activeFor?: readonly string[]) => {
      if (!pathname || !href) {
        return false;
      }
      if (activeFor && isNavHrefActive(pathname, null, activeFor)) {
        return true;
      }
      // Sidebar-specific exception: when no more specific entry matches,
      // /dashboard owns its subtree. (Header/bottom-nav use the strict
      // rule from isNavHrefActive.)
      if (href === ROUTES.DASHBOARD.HOME) {
        return pathname === ROUTES.DASHBOARD.HOME;
      }
      return isNavHrefActive(pathname, href);
    },
    [pathname]
  );

  // Derive activeSection + activeItem from the section walk.
  // Memoize so the result is stable until pathname/sections change.
  const { activeSection, activeItem } = useMemo(() => {
    if (!pathname) {
      return { activeSection: null, activeItem: null };
    }

    // Dashboard-root fallback: when we're on /dashboard/x but no item
    // owns that subtree, treat /dashboard as active in its section.
    let dashboardSectionId: string | null = null;
    let dashboardItemHref: string | null = null;

    for (const section of sections) {
      for (const item of section.items) {
        if (!item.href) {
          continue;
        }
        if (item.href === ROUTES.DASHBOARD.HOME) {
          dashboardSectionId = section.id;
          dashboardItemHref = item.href;
        }
        if (isNavHrefActive(pathname, item.href, item.activeFor)) {
          return { activeSection: section.id, activeItem: item.href };
        }
      }
    }

    if (
      dashboardItemHref &&
      (pathname === ROUTES.DASHBOARD.HOME || pathname.startsWith(ROUTES.DASHBOARD.HOME + '/'))
    ) {
      return { activeSection: dashboardSectionId, activeItem: dashboardItemHref };
    }

    return { activeSection: null, activeItem: null };
  }, [pathname, sections]);

  return { activeSection, activeItem, isItemActive };
}
