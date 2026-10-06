'use client';

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { debugLog } from './constants';
import { fetchFullMessage } from './message-utils';
import type { Message } from '../types';

type CallbacksRef = React.MutableRefObject<{
  onNewMessage?: (message: Message) => void;
  onOwnMessage?: (messageId: string) => void;
  onReadReceiptUpdate?: (conversationId: string) => void;
}>;

export async function handleMessageInsert(
  payload: { new: Record<string, unknown> },
  userId: string,
  callbacksRef: CallbacksRef
) {
  debugLog('[useMessageSubscription] insert', { messageId: payload.new.id });
  const { onNewMessage, onOwnMessage } = callbacksRef.current;

  if (payload.new.sender_id === userId) {
    debugLog('[useMessageSubscription] own message; onOwnMessage');
    if (onOwnMessage) {
      onOwnMessage(payload.new.id as string);
    }
    return;
  }

  try {
    const newMessage = await fetchFullMessage(supabase, payload.new.id as string, payload.new);
    if (newMessage) {
      if (onNewMessage) {
        onNewMessage(newMessage);
      } else {
        logger.warn('onNewMessage callback not provided', undefined, 'Messaging');
      }
    } else {
      logger.error('Failed to create message object from payload', undefined, 'Messaging');
    }
  } catch (error) {
    logger.error('Error processing real-time message', error, 'Messaging');
  }
}

export async function handleMessageUpdate(
  payload: { new: Record<string, unknown> | null },
  callbacksRef: CallbacksRef
) {
  const { onNewMessage } = callbacksRef.current;
  debugLog('[useMessageSubscription] update', payload.new?.id);
  if (onNewMessage && payload.new) {
    try {
      const updated = await fetchFullMessage(supabase, payload.new.id as string, payload.new);
      if (updated) {
        onNewMessage(updated);
      }
    } catch (error) {
      logger.error('Error processing message update', error, 'Messaging');
    }
  }
}

export function handleReadReceiptUpdate(
  conversationId: string,
  payload: { new: Record<string, unknown> | null },
  callbacksRef: CallbacksRef
) {
  debugLog('[useMessageSubscription] read receipt update', {
    conversationId,
    userId: payload.new?.user_id,
  });
  const { onReadReceiptUpdate } = callbacksRef.current;
  if (onReadReceiptUpdate && payload.new) {
    onReadReceiptUpdate(conversationId);
  }
}

export function makeMessageSubscribeHandler(
  conversationId: string,
  deps: {
    isMountedRef: React.MutableRefObject<boolean>;
    setupInProgressRef: React.MutableRefObject<boolean>;
    hasSubscribedRef: React.MutableRefObject<boolean>;
    reconnectAttemptsRef: React.MutableRefObject<number>;
    enabled: boolean;
    onSubscriptionStatusChange: ((status: string, err?: Error) => void) | undefined;
    attemptReconnectRef: React.MutableRefObject<(() => void) | null>;
  }
) {
  return (status: string, err?: Error) => {
    const {
      isMountedRef,
      setupInProgressRef,
      hasSubscribedRef,
      reconnectAttemptsRef,
      enabled,
      onSubscriptionStatusChange,
      attemptReconnectRef,
    } = deps;

    if (!isMountedRef.current) {
      return;
    }

    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      const error = err || new Error(`Subscription error: ${status}`);
      logger.error(`Channel error for ${conversationId}`, error, 'Messaging');
      setupInProgressRef.current = false;
      if (onSubscriptionStatusChange) {
        onSubscriptionStatusChange(status, error);
      }
      if (attemptReconnectRef.current) {
        attemptReconnectRef.current();
      }
    } else if (status === 'SUBSCRIBED') {
      reconnectAttemptsRef.current = 0;
      setupInProgressRef.current = false;
      hasSubscribedRef.current = true;
      debugLog(`[useMessageSubscription] ✅ Successfully subscribed to ${conversationId}`);
      if (onSubscriptionStatusChange) {
        onSubscriptionStatusChange(status);
      }
    } else if (status === 'CLOSED') {
      debugLog(`[useMessageSubscription] ⚠️ Channel closed for ${conversationId}`);
      setupInProgressRef.current = false;
      if (onSubscriptionStatusChange) {
        onSubscriptionStatusChange(status);
      }
      if (
        hasSubscribedRef.current &&
        isMountedRef.current &&
        enabled &&
        attemptReconnectRef.current
      ) {
        attemptReconnectRef.current();
      }
    } else {
      debugLog(`[useMessageSubscription] status ${status} for ${conversationId}`);
      if (onSubscriptionStatusChange) {
        onSubscriptionStatusChange(status);
      }
    }
  };
}
