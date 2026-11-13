'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';
import { toast } from 'sonner';
import { useMessages } from '@/features/messaging/hooks/useMessages';
import { useMessageSubscription } from '@/hooks/useMessageSubscription';
import { TIMING } from '@/features/messaging/lib/constants';
import { DATABASE_TABLES } from '@/config/database-tables';
import supabase from '@/lib/supabase/browser';
import type { Message } from '@/features/messaging/types';
import { editMessageAction, deleteMessageAction } from './messageViewActions';
import { useMessagingStore } from '@/stores/messaging';
import { scrollBehavior } from '@/lib/scroll-behavior';

export function useMessageView(conversationId: string, currentUserId: string | undefined) {
  const { updateConversation } = useMessagingStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [menuState, setMenuState] = useState<{
    open: boolean;
    position: { x: number; y: number };
    message: Message | null;
  }>({ open: false, position: { x: 0, y: 0 }, message: null });
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  // Track read-receipt + mark-as-read delays so they don't fire after unmount or convo switch.
  const pendingTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimeoutsRef.current.delete(id);
      fn();
    }, ms);
    pendingTimeoutsRef.current.add(id);
    return id;
  }, []);

  useEffect(() => {
    // Capture the Set instance on entry so the cleanup runs against the
    // same instance scheduleTimeout was adding to — even if a re-render
    // points pendingTimeoutsRef at something else (it shouldn't, but the
    // exhaustive-deps rule can't see that and the capture is correct anyway).
    const timers = pendingTimeoutsRef.current;
    return () => {
      timers.forEach(id => clearTimeout(id));
      timers.clear();
    };
  }, [conversationId]);

  const {
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
  } = useMessages(conversationId, {
    enabled: !!conversationId && !!currentUserId,
    userId: currentUserId,
  });

  useMessageSubscription(conversationId, {
    enabled: !!conversationId && !!currentUserId,
    onReadReceiptUpdate: refreshReadReceipts,
    onOwnMessage: async messageId => {
      try {
        const { data: newMessage } = await supabase
          .from(DATABASE_TABLES.MESSAGE_DETAILS)
          .select('*')
          .eq('id', messageId)
          .single();

        if (newMessage) {
          const tempMessages = messages.filter((m: Message) => m.id.startsWith('temp-'));
          if (tempMessages.length > 0) {
            confirmMessage(tempMessages[tempMessages.length - 1].id, newMessage as Message);
          }
          setShouldAutoScroll(true);
          scheduleTimeout(() => refreshReadReceipts(), TIMING.READ_RECEIPT_RECALC_DELAY_MS);
        }
      } catch {
        // Realtime will handle it
      }
    },
    onNewMessage: async message => {
      logger.info('[MessageView] Received new message via real-time:', {
        id: message.id,
        senderId: message.sender_id,
        currentUserId,
        content: message.content?.substring(0, 50),
      });
      handleNewMessage(message);
      setShouldAutoScroll(true);

      if (message.sender_id !== currentUserId) {
        scheduleTimeout(() => markAsRead(), TIMING.MARK_READ_DEBOUNCE_MS);
      }
    },
  });

  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: scrollBehavior() });
      setShouldAutoScroll(false);
    }
  }, [messages, shouldAutoScroll]);

  useEffect(() => {
    if (!isLoading && messages.length > 0 && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [isLoading, messages.length]);

  const handleMessageSent = useCallback(
    (message: Message) => {
      addOptimisticMessage(message);
      setShouldAutoScroll(true);
      updateConversation(conversationId, {
        last_message_preview: message.content,
        last_message_at: message.created_at || new Date().toISOString(),
      });
    },
    [addOptimisticMessage, updateConversation, conversationId]
  );

  const handleMessageConfirmed = useCallback(
    (tempId: string, realMessage: Message) => {
      confirmMessage(tempId, realMessage);
      setShouldAutoScroll(true);
      scheduleTimeout(() => refreshReadReceipts(), TIMING.READ_RECEIPT_RECALC_DELAY_MS);
    },
    [confirmMessage, refreshReadReceipts, scheduleTimeout]
  );

  const handleMessageFailed = useCallback(
    (tempId: string, errorMessage?: string) => {
      removeMessage(tempId);
      if (errorMessage) {
        toast.error('Failed to send message', { description: errorMessage });
      }
    },
    [removeMessage]
  );

  const handleMessageLongPress = useCallback(
    (message: Message, position?: { x: number; y: number }) => {
      setMenuState({
        open: true,
        position: position || { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        message,
      });
    },
    []
  );

  const closeMenu = useCallback(() => setMenuState(s => ({ ...s, open: false })), []);

  const handleEdit = useCallback(() => {
    const msg = menuState.message;
    if (!msg) {
      return;
    }
    closeMenu();
    setEditingMessageId(msg.id);
  }, [menuState.message, closeMenu]);

  const handleEditSave = useCallback(
    async (messageId: string, newContent: string) => {
      setEditingMessageId(null);
      await editMessageAction(messageId, newContent, handleNewMessage);
    },
    [handleNewMessage]
  );

  const handleEditCancel = useCallback(() => setEditingMessageId(null), []);

  const handleDelete = useCallback(async () => {
    await deleteMessageAction(menuState.message, conversationId, removeMessage, closeMenu);
  }, [menuState.message, conversationId, removeMessage, closeMenu]);

  return {
    messages,
    conversation,
    pagination,
    isLoading,
    isLoadingMore,
    error,
    loadMore,
    retry,
    menuState,
    editingMessageId,
    messagesEndRef,
    handleMessageSent,
    handleMessageConfirmed,
    handleMessageFailed,
    handleMessageLongPress,
    closeMenu,
    handleEdit,
    handleEditSave,
    handleEditCancel,
    handleDelete,
  };
}
