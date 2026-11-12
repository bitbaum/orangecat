'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface UseBulkDeleteParams {
  selectedIds: Set<string>;
  apiEndpoint: string;
  entityName: string;
  entityNamePlural: string;
  clearSelection: () => void;
  refresh: () => Promise<void> | void;
  onSuccess?: () => void;
}

export function useBulkDelete({
  selectedIds,
  apiEndpoint,
  entityName,
  entityNamePlural,
  clearSelection,
  refresh,
  onSuccess,
}: UseBulkDeleteParams) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) {
      return;
    }
    setBulkDeleteConfirm(true);
  }, [selectedIds.size]);

  const executeBulkDelete = useCallback(async () => {
    setBulkDeleteConfirm(false);
    setIsDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(async id => {
          const response = await fetch(`${apiEndpoint}/${id}`, {
            method: 'DELETE',
            credentials: 'same-origin',
          });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const err = errorData.error;
            const message =
              typeof err === 'string' ? err : (err as { message?: string } | undefined)?.message;
            throw new Error(message || `Failed to delete ${entityName} ${id}`);
          }
          return response.json().catch(() => ({}));
        })
      );
      toast.success(
        `Successfully deleted ${selectedIds.size} ${selectedIds.size > 1 ? entityNamePlural.toLowerCase() : entityName.toLowerCase()}`
      );
      clearSelection();
      onSuccess?.();
      await refresh();
    } catch (error) {
      logger.error(`Failed to delete ${entityNamePlural}`, { error }, 'useBulkDelete');
      toast.error(`Failed to delete some ${entityNamePlural.toLowerCase()}. Please try again.`);
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, apiEndpoint, entityName, entityNamePlural, clearSelection, refresh, onSuccess]);

  return {
    isDeleting,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    handleBulkDelete,
    executeBulkDelete,
  };
}
