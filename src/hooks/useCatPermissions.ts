'use client';

import { useAuth } from '@/hooks/useAuth';
import { useCatPermissionsData } from '@/components/cat-settings/permissions/useCatPermissionsData';
export type { PermissionData } from '@/components/cat-settings/permissions/types';

/** The summary and editor share the same lifecycle and canonical snapshots. */
export function useCatPermissions() {
  const { user } = useAuth();
  const state = useCatPermissionsData(Boolean(user));
  return {
    permissions: state.data,
    isLoading: state.loading,
    isSaving: state.saving,
    toggleCategory: state.toggleCategory,
  };
}
