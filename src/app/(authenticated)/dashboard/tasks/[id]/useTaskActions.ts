/**
 * useTaskActions Hook
 *
 * Encapsulates API action handlers for task detail page:
 * complete, flag attention, request, and archive.
 *
 * Created: 2026-02-19
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface UseTaskActionsOptions {
  taskId: string;
  onSuccess: () => void;
}

export function useTaskActions({ taskId, onSuccess }: UseTaskActionsOptions) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const handleComplete = async (notes: string, durationMinutes: number | '') => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_ROUTES.TASKS.BASE}/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notes || null,
          duration_minutes: durationMinutes || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(apiErrorMessage(data, 'Failed to complete task'));
      }

      toast.success('Task completed!');
      onSuccess();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete task';
      toast.error(message);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleFlagAttention = async (attentionMessage: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_ROUTES.TASKS.BASE}/${taskId}/attention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: attentionMessage || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(apiErrorMessage(data, 'Failed to flag task'));
      }

      toast.success('Task flagged');
      onSuccess();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to flag task';
      toast.error(message);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequest = async (requestUserId: string, requestMessage: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_ROUTES.TASKS.BASE}/${taskId}/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_user_id: requestUserId || null,
          message: requestMessage || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(apiErrorMessage(data, 'Failed to send request'));
      }

      toast.success(requestUserId ? 'Request sent' : 'Request sent to everyone');
      onSuccess();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send request';
      toast.error(message);
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const requestArchiveConfirm = () => setArchiveConfirmOpen(true);

  const executeArchive = async () => {
    setArchiveConfirmOpen(false);
    try {
      const response = await fetch(`${API_ROUTES.TASKS.BASE}/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(apiErrorMessage(data, 'Failed to archive task'));
      }

      toast.success('Task archived');
      router.push(ROUTES.DASHBOARD.TASKS);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to archive task';
      toast.error(message);
    }
  };

  return {
    actionLoading,
    handleComplete,
    handleFlagAttention,
    handleRequest,
    archiveConfirmOpen,
    requestArchiveConfirm,
    executeArchive,
    closeArchiveConfirm: () => setArchiveConfirmOpen(false),
  };
}
