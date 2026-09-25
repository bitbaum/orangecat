/**
 * Cat permissions: load them, and change them optimistically.
 *
 * Moved out of the old /dashboard/cat/permissions page so the Cat settings
 * page's "What Cat can do" section and that page share ONE implementation.
 * Behaviour is unchanged: toggles apply instantly and roll back on failure.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { fromAutonomyLevel, type AutonomyLevel } from '@/config/cat-autonomy';
import type { PermissionData } from './types';

export function useCatPermissionsData(enabled: boolean) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [data, setData] = useState<PermissionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) {
      return;
    }
    fetch(API_ROUTES.CAT.PERMISSIONS)
      .then(res => res.json())
      .then(json =>
        json.success
          ? setData(json.data)
          : setError(apiErrorMessage(json.error, 'Couldn’t load what Cat may do.'))
      )
      .catch(() => setError('Failed to load permissions'))
      .finally(() => setLoading(false));
  }, [enabled]);

  /** POST grants, DELETE revokes; the server answers with the new summary. */
  const write = useCallback(
    async (
      key: string,
      optimistic: (prev: PermissionData) => PermissionData,
      granted: boolean,
      body: Record<string, unknown>
    ) => {
      setSaving(key);
      const previous = data;
      setData(prev => (prev ? optimistic(prev) : prev));
      try {
        const res = await fetch(API_ROUTES.CAT.PERMISSIONS, {
          method: granted ? 'POST' : 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (json.success && json.data?.summary) {
          setData(prev => (prev ? { ...prev, summary: json.data.summary } : null));
        } else {
          setData(previous);
          toast.error(json.error?.message || 'Failed to update permission');
        }
      } catch {
        setData(previous);
        toast.error('Failed to update permission');
      } finally {
        setSaving(null);
      }
    },
    [data]
  );

  const toggleCategory = (categoryId: string, on: boolean) =>
    write(
      categoryId,
      prev => {
        const categories = prev.summary.categories.map(cat =>
          cat.category === categoryId
            ? { ...cat, enabled: on, enabledActionCount: on ? cat.actionCount : 0 }
            : cat
        );
        return {
          ...prev,
          summary: {
            ...prev.summary,
            categories,
            enabledActions: categories.reduce((sum, c) => sum + c.enabledActionCount, 0),
          },
        };
      },
      on,
      { actionId: '*', category: categoryId, requiresConfirmation: true }
    );

  // Off / Ask first / Automatic → the two stored booleans (cat-autonomy SSOT).
  const setActionAutonomy = (actionId: string, category: string, level: AutonomyLevel) => {
    const { granted, requiresConfirmation } = fromAutonomyLevel(level);
    return write(
      actionId,
      prev => ({
        ...prev,
        availableActions: prev.availableActions.map(a =>
          a.id === actionId ? { ...a, autonomy: level } : a
        ),
      }),
      granted,
      { actionId, category, requiresConfirmation }
    );
  };

  const toggleExpanded = (categoryId: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });

  return {
    loading,
    error,
    data,
    setData,
    saving,
    expanded,
    toggleCategory,
    setActionAutonomy,
    toggleExpanded,
  };
}
