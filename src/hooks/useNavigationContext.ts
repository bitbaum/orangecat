'use client';

/**
 * Navigation Context Hook
 *
 * Determines and manages the active navigation context:
 * - Individual: User's personal dashboard
 * - Group: A specific group's dashboard
 *
 * Context is determined by URL pattern and user selection.
 * Persisted to localStorage for session continuity.
 *
 * Created: 2026-02-25
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './useAuth';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { isFixtureGroupTitle } from '@/config/public-directory';

type NavigationContextType = 'individual' | 'group';

export interface GroupContextInfo {
  id: string;
  slug: string;
  name: string;
  avatar_url?: string;
  role?: string;
}

interface NavigationContext {
  type: NavigationContextType;
  /** Present when type === 'group' */
  group?: GroupContextInfo;
}

interface UseNavigationContextReturn {
  context: NavigationContext;
  /** Groups the user belongs to (for the switcher) */
  userGroups: GroupContextInfo[];
  /** Whether groups are still loading */
  loadingGroups: boolean;
  /** Switch to individual context */
  switchToIndividual: () => void;
  /** Switch to a group context */
  switchToGroup: (group: GroupContextInfo) => void;
  /** Whether user is in a group context */
  isGroupContext: boolean;
}

const STORAGE_KEY = 'orangecat_nav_context';

export function useNavigationContext(): UseNavigationContextReturn {
  const pathname = usePathname();
  const { user } = useAuth();

  const [context, setContext] = useState<NavigationContext>({ type: 'individual' });
  const [userGroups, setUserGroups] = useState<GroupContextInfo[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Detect context from URL
  useEffect(() => {
    if (!pathname) {
      return;
    }

    // Check if URL indicates a group context
    // Pattern: /groups/[slug]/... or /dashboard/groups/[slug]/...
    const groupMatch = pathname.match(/\/groups\/([^/]+)/);
    if (groupMatch) {
      const slug = groupMatch[1];
      // Only set if we don't already have this group's context
      if (context.type !== 'group' || context.group?.slug !== slug) {
        const existingGroup = userGroups.find(g => g.slug === slug);
        if (existingGroup) {
          setContext({ type: 'group', group: existingGroup });
        }
        // If group not in userGroups yet, URL-based detection will be updated
        // when userGroups loads
      }
    }
  }, [pathname, userGroups, context.type, context.group?.slug]);

  // Load persisted context on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as NavigationContext;
        if (parsed.type === 'group' && parsed.group) {
          setContext(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Load user's groups
  useEffect(() => {
    if (!user?.id) {
      setUserGroups([]);
      return;
    }

    let cancelled = false;

    async function loadGroups() {
      setLoadingGroups(true);
      try {
        const response = await fetch(`${API_ROUTES.GROUPS.BASE}?membership=mine&pageSize=50`);
        if (!response.ok) {
          setUserGroups([]);
          return;
        }
        const data = await response.json();
        if (!cancelled && data.success && data.data?.groups) {
          const groups: GroupContextInfo[] = data.data.groups
            // CI and workflow audits mint throwaway groups ("Audit WF009 …")
            // and add the account they run as to them. Public directories
            // already hide those rows; the switcher never got the same filter,
            // so they sat in the user's own context menu as if they were real
            // teams. Same predicate, one definition — see config/public-directory.
            .filter((g: { name: string }) => !isFixtureGroupTitle(g.name))
            .map((g: { id: string; slug: string; name: string; avatar_url?: string }) => ({
              id: g.id,
              slug: g.slug,
              name: g.name,
              avatar_url: g.avatar_url,
            }));
          setUserGroups(groups);
        }
      } catch (error) {
        logger.warn('Failed to load user groups for context switcher', { error });
        if (!cancelled) {
          setUserGroups([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingGroups(false);
        }
      }
    }

    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const switchToIndividual = useCallback(() => {
    const newContext: NavigationContext = { type: 'individual' };
    setContext(newContext);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const switchToGroup = useCallback((group: GroupContextInfo) => {
    const newContext: NavigationContext = { type: 'group', group };
    setContext(newContext);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newContext));
    } catch {
      // Ignore
    }
  }, []);

  return useMemo(
    () => ({
      context,
      userGroups,
      loadingGroups,
      switchToIndividual,
      switchToGroup,
      isGroupContext: context.type === 'group',
    }),
    [context, userGroups, loadingGroups, switchToIndividual, switchToGroup]
  );
}
