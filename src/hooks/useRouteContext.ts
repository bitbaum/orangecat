/**
 * Route Context Hook
 *
 * Single source of truth for determining current route context.
 * Eliminates duplicate route checking logic across components.
 *
 * Created: 2026-01-16
 */

import { useShellPathname } from '@/hooks/useShellPathname';
import { getRouteContext, type RouteContext } from '@/config/routes';

/**
 * Hook to get the current route context
 *
 * @returns Current route context ('authenticated' | 'public' | 'universal' | 'auth' | 'contextual')
 */
export function useRouteContext(): RouteContext {
  return getRouteContext(useShellPathname());
}

/**
 * Hook to check if current route is authenticated
 *
 * @returns true if route requires authentication
 */
export function useIsAuthRoute(): boolean {
  const context = useRouteContext();
  return context === 'authenticated' || context === 'contextual';
}
