'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Message, Conversation, Pagination } from '../types';
import { TIMING, debugLog } from '../lib/constants';
import { API_ROUTES } from '@/config/api-routes';
import { announceMessagesRead } from '@/hooks/useUnreadMessagesSync';
import { mergeMessages, confirmOptimisticMessage } from '../lib/message-utils';
import { useReadReceipts } from './useReadReceipts';
import { useMessagesFetcher } from './useMessagesFetcher';

interface UseMessagesOptions {
  enabled?: boolean;
  userId: string | undefined;
}

interface UseMessagesReturn {
  messages: Message[];
  conversation: Conversation | null;
  pagination: Pagination | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: 'forbidden' | 'not_found' | 'network' | 'unknown' | null;
  loadMore: () => Promise<void>;
  /** Re-run the initial fetch — for inline retry after a failed load. */
  retry: () => Promise<void>;
  addOptimisticMessage: (message: Message) => void;
  confirmMessage: (tempId: string, realMessage: Message) => void;
  removeMessage: (messageId: string) => void;
  handleNewMessage: (message: Message) => void;
  markAsRead: () => Promise<void>;
  refreshReadReceipts: () => Promise<void>;
}

export function useMessages(
  conversationId: string | null,
  options: UseMessagesOptions
): UseMessagesReturn {
  const { enabled = true, userId } = options;

  const { participantReadTimes, refreshReadReceipts, applyReadStatus } = useReadReceipts(
    conversationId,
    enabled,
    userId
  );

  const markAsRead = useCallback(async () => {
    if (!conversationId || !userId) {
      return;
    }
    try {
      const res = await fetch(API_ROUTES.MESSAGES.CONVERSATION_READ(conversationId), {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (res.ok) {
        announceMessagesRead();
      }
      setTimeout(() => refreshReadReceipts(), TIMING.READ_RECEIPT_RECALC_DELAY_MS);
    } catch (err) {
      debugLog('Error marking as read:', err);
    }
  }, [conversationId, userId, refreshReadReceipts]);

  const {
    messages,
    setMessages,
    conversation,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
  } = useMessagesFetcher({ conversationId, enabled, applyReadStatus, markAsRead });

  const prevReadTimesKeyRef = useRef('');
  useEffect(() => {
    const readTimesKey = Array.from(participantReadTimes.entries())
      .map(([id, time]) => `${id}:${time?.getTime() || 'null'}`)
      .sort()
      .join(',');

    if (
      messages.length > 0 &&
      readTimesKey !== prevReadTimesKeyRef.current &&
      participantReadTimes.size > 0
    ) {
      prevReadTimesKeyRef.current = readTimesKey;
      setMessages(prev => applyReadStatus(prev));
    } else if (prevReadTimesKeyRef.current === '' && participantReadTimes.size > 0) {
      prevReadTimesKeyRef.current = readTimesKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantReadTimes]);

  const addOptimisticMessage = useCallback(
    (message: Message) => {
      setMessages(prev => mergeMessages(prev, applyReadStatus([message])));
    },
    [applyReadStatus, setMessages]
  );

  const confirmMessage = useCallback(
    (tempId: string, realMessage: Message) => {
      setMessages(prev =>
        confirmOptimisticMessage(applyReadStatus(prev), tempId, applyReadStatus([realMessage])[0])
      );
    },
    [applyReadStatus, setMessages]
  );

  const removeMessage = useCallback(
    (messageId: string) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    },
    [setMessages]
  );

  const handleNewMessage = useCallback(
    (message: Message) => {
      const messageWithStatus = applyReadStatus([message])[0];
      setMessages(prev => {
        const exists = prev.find(m => m.id === message.id);
        if (exists) {
          return prev.map(m => (m.id === message.id ? { ...m, ...messageWithStatus } : m));
        }
        return mergeMessages(prev, [messageWithStatus]);
      });
    },
    [applyReadStatus, setMessages]
  );

  return {
    messages,
    conversation,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
    addOptimisticMessage,
    confirmMessage,
    removeMessage,
    handleNewMessage,
    markAsRead,
    refreshReadReceipts,
  };
}
