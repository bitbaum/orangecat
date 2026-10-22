'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { useMessagingStore } from '@/stores/messaging';
import { useBulkSelection } from '@/hooks/useBulkSelection';

interface UseMessagePanelStateParams {
  isAuthReady: boolean;
  user: { id: string } | null | undefined;
  initialConversationId?: string;
}

export function useMessagePanelState({
  isAuthReady,
  user,
  initialConversationId,
}: UseMessagePanelStateParams) {
  const router = useRouter();
  const { currentConversationId, setCurrentConversation } = useMessagingStore();

  const selectedConversationId = currentConversationId;
  const [hasInitializedFromUrl, setHasInitializedFromUrl] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [convSelectionMode, setConvSelectionMode] = useState(false);
  const {
    selectedIds: selectedConvIds,
    toggleSelect: toggleConvSelect,
    clearSelection: clearConvSelection,
  } = useBulkSelection();
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const setSelectedConversationId = useCallback(
    (id: string | null) => setCurrentConversation(id),
    [setCurrentConversation]
  );

  const bulkDeleteSelected = () => {
    if (selectedConvIds.size === 0) {
      return;
    }
    setBulkDeleteConfirm(true);
  };

  const executeBulkDelete = async () => {
    const convIds = Array.from(selectedConvIds);
    setBulkDeleteConfirm(false);
    try {
      const res = await fetch(API_ROUTES.MESSAGES.BULK_CONVERSATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ids: convIds }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        toast.error('Could not delete conversations', { description: txt || 'Please try again.' });
        return;
      }
      toast.success(`Deleted ${convIds.length} conversation${convIds.length > 1 ? 's' : ''}`);
      clearConvSelection();
      setConvSelectionMode(false);
      setRefreshSignal(s => s + 1);
      if (selectedConversationId && convIds.includes(selectedConversationId)) {
        setSelectedConversationId(null);
        router.replace('/messages');
      }
    } catch (e) {
      logger.error('Bulk conversation leave error', e, 'Messaging');
      toast.error('Could not delete conversations. Please try again.');
    }
  };

  // Wait until auth is fully ready before loading conversations from URL
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    if (user && initialConversationId && !hasInitializedFromUrl) {
      setSelectedConversationId(initialConversationId);
      setHasInitializedFromUrl(true);
    } else if (!user) {
      setSelectedConversationId(null);
      setHasInitializedFromUrl(false);
    } else if (!initialConversationId && selectedConversationId && hasInitializedFromUrl) {
      setSelectedConversationId(null);
      setHasInitializedFromUrl(false);
    }
  }, [
    initialConversationId,
    user,
    isAuthReady,
    hasInitializedFromUrl,
    selectedConversationId,
    setSelectedConversationId,
  ]);

  useEffect(() => {
    if (initialConversationId !== selectedConversationId) {
      setHasInitializedFromUrl(false);
    }
  }, [initialConversationId, selectedConversationId]);

  return {
    selectedConversationId,
    searchQuery,
    setSearchQuery,
    showNewModal,
    setShowNewModal,
    activeTab,
    setActiveTab,
    convSelectionMode,
    setConvSelectionMode,
    selectedConvIds,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    refreshSignal,
    setRefreshSignal,
    toggleConvSelect,
    clearConvSelection,
    bulkDeleteSelected,
    executeBulkDelete,
    setSelectedConversationId,
  };
}
