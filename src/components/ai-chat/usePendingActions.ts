/**
 * Fetch/confirm/reject pending Cat actions. Split from PendingActionsCard.tsx
 * when the card crossed the component size limit; the component renders, this
 * talks to /api/cat/actions.
 */

import { useCallback } from 'react';
import { API_ROUTES } from '@/config/api-routes';

export interface PendingAction {
  id: string;
  actionId: string;
  category: string;
  parameters: Record<string, unknown>;
  description: string;
  expiresAt: string;
  /** Confirming also allows this category from now on (still confirm-each-time). */
  grantOnConfirm?: boolean;
}

/**
 * Hook to manage pending actions state.
 *
 * NB: every function returned here is wrapped in useCallback with an empty
 * dependency array. They are pure thin wrappers around fetch — they need no
 * deps and they MUST be stable across renders. Otherwise consumers that wire
 * them through useEffect(deps) get a fresh reference on every render, the
 * effect re-runs, an immediate fetch fires, setState triggers a re-render,
 * and the whole thing infinite-loops. This loop was visible in production as
 * hundreds of polls per second against /api/cat/actions.
 */
export function usePendingActions() {
  const confirmAction = useCallback(
    async (actionId: string): Promise<{ message?: string; url?: string }> => {
      const res = await fetch(`${API_ROUTES.CAT.ACTIONS}/${actionId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Failed to confirm action (${res.status})`);
      }
      // The route returns the executor's ActionResult; a handler's message and
      // link live one level down, on `result.data`. Reading the top level only
      // showed "Action confirmed and executed" for a handler that had returned
      // the share link the user needed next (seen live 2026-09-10).
      const result = json?.data as Record<string, unknown> | undefined;
      const inner = (result?.data ?? {}) as Record<string, unknown>;
      const message =
        typeof inner.displayMessage === 'string'
          ? inner.displayMessage
          : typeof result?.displayMessage === 'string'
            ? result.displayMessage
            : undefined;
      const url = typeof inner.url === 'string' ? inner.url : undefined;
      return { message, url };
    },
    []
  );

  const rejectAction = useCallback(
    async (actionId: string, reason?: string): Promise<{ success: boolean }> => {
      const res = await fetch(`${API_ROUTES.CAT.ACTIONS}/${actionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Failed to reject action (${res.status})`);
      }
      return json;
    },
    []
  );

  const getPendingActions = useCallback(async (): Promise<PendingAction[]> => {
    const res = await fetch(API_ROUTES.CAT.ACTIONS);
    if (!res.ok) {
      return [];
    }
    const json = await res.json();
    return json.success ? json.data.pendingActions : [];
  }, []);

  return {
    confirmAction,
    rejectAction,
    getPendingActions,
  };
}
