'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './useAuth';
import { useActiveNavItem } from './useActiveNavItem';
import {
  useNavigationStorage,
  buildInitialCollapsedSections,
  clearNavigationStorage,
} from './useNavigationStorage';

/**
 * Counter source identifier for nav items that show a live numeric
 * badge (e.g., unread messages). Reads from a dedicated hook in the
 * renderer so the nav config stays config (no hook calls here).
 */
export type NavCounterSource = 'messages';

export interface NavItem {
  name: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
  badge?: string;
  /** Live numeric counter rendered as an unread dot/number on this item. */
  counter?: NavCounterSource;
  description?: string;
  requiresAuth?: boolean;
  requiresProfile?: boolean;
  children?: NavItem[];
  external?: boolean;
  /** Other paths this item owns: it shows active on them as well as on href. */
  activeFor?: readonly string[];
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  priority: number;
  requiresAuth?: boolean;
}

interface NavigationState {
  isSidebarOpen: boolean;
  isSidebarCollapsed: boolean;
  collapsedSections: Set<string>;
  activeSection: string | null;
  activeItem: string | null;
}

interface UseNavigationReturn {
  navigationState: NavigationState;
  toggleSidebar: () => void;
  toggleSidebarCollapse: () => void;
  toggleSection: (sectionId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isItemActive: (href: string, activeFor?: readonly string[]) => boolean;
  getFilteredSections: () => NavSection[];
  resetNavigation: () => void;
}

export function useNavigation(sections: NavSection[]): UseNavigationReturn {
  const { user, profile, hydrated } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Stable refs to break the inline-function dep cycle in useNavigationStorage
  type LoadedState = {
    isSidebarCollapsed: boolean;
    collapsedSections: Set<string>;
  };
  const onStateLoadedRef = useRef<(s: LoadedState) => void>(undefined);
  onStateLoadedRef.current = ({ isSidebarCollapsed, collapsedSections: cs }) => {
    setIsSidebarCollapsed(isSidebarCollapsed);
    setCollapsedSections(cs);
  };
  const onLoadFailedRef = useRef<(d: Set<string>) => void>(undefined);
  onLoadFailedRef.current = defaultCollapsed => setCollapsedSections(defaultCollapsed);

  const onStateLoaded = useCallback((s: LoadedState) => onStateLoadedRef.current?.(s), []);
  const onLoadFailed = useCallback((d: Set<string>) => onLoadFailedRef.current?.(d), []);

  const { persistSidebarCollapsedState, persistCollapsedSections } = useNavigationStorage(
    hydrated,
    sections,
    { onStateLoaded, onLoadFailed }
  );

  const { activeSection, activeItem, isItemActive } = useActiveNavItem(sections);

  // The phone drawer is transient: never saved, always starts closed.
  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const setSidebarOpen = useCallback((open: boolean) => setIsSidebarOpen(open), []);

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      persistSidebarCollapsedState(next);
      return next;
    });
  }, [persistSidebarCollapsedState]);

  const setSidebarCollapsed = useCallback(
    (collapsed: boolean) => {
      setIsSidebarCollapsed(prev => {
        if (prev === collapsed) {
          return prev;
        }
        persistSidebarCollapsedState(collapsed);
        return collapsed;
      });
    },
    [persistSidebarCollapsedState]
  );

  const toggleSection = useCallback(
    (sectionId: string) => {
      setCollapsedSections(prev => {
        const next = new Set(prev);
        if (next.has(sectionId)) {
          next.delete(sectionId);
        } else {
          next.add(sectionId);
        }
        persistCollapsedSections(next);
        return next;
      });
    },
    [persistCollapsedSections]
  );

  const getFilteredSections = useCallback(() => {
    if (!hydrated) {
      return [];
    }
    const canShow = (item: NavItem) =>
      !(item.requiresAuth && !user) && !(item.requiresProfile && !profile);
    return sections
      .filter(s => !(s.requiresAuth && !user) && s.items.some(canShow))
      .map(s => ({ ...s, items: s.items.filter(canShow) }))
      .sort((a, b) => a.priority - b.priority);
  }, [sections, user, profile, hydrated]);

  const resetNavigation = useCallback(() => {
    clearNavigationStorage();
    setIsSidebarOpen(false);
    setIsSidebarCollapsed(false);
    setCollapsedSections(buildInitialCollapsedSections(sections));
  }, [sections]);

  const navigationState = useMemo<NavigationState>(
    () => ({ isSidebarOpen, isSidebarCollapsed, collapsedSections, activeSection, activeItem }),
    [isSidebarOpen, isSidebarCollapsed, collapsedSections, activeSection, activeItem]
  );

  return useMemo(
    () => ({
      navigationState,
      toggleSidebar,
      toggleSidebarCollapse,
      toggleSection,
      setSidebarOpen,
      setSidebarCollapsed,
      isItemActive,
      getFilteredSections,
      resetNavigation,
    }),
    [
      navigationState,
      toggleSidebar,
      toggleSidebarCollapse,
      toggleSection,
      setSidebarOpen,
      setSidebarCollapsed,
      isItemActive,
      getFilteredSections,
      resetNavigation,
    ]
  );
}
