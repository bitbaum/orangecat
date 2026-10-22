'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Conversation } from '../types';
import { useAuth } from '@/hooks/useAuth';
import { useMessagingStore } from '@/stores/messaging';
import { CHANNELS, TIMING, debugLog } from '../lib/constants';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { useConversationsFetcher } from './useConversationsFetcher';
import { API_ROUTES } from '@/config/api-routes';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createConversationSearch } from '../lib/conversation-search';

export function useConversations(searchQuery: string, selectedConversationId?: string | null) {
  const { user, hydrated, isLoading: authLoading, isAuthenticated } = useAuth();
  const isAuthReady = hydrated && !authLoading;

  const {
    conversations,
    setConversations,
    setLoading: _setStoreLoading,
    setError: _setStoreError,
  } = useMessagingStore();

  debugLog('[useConversations] state', {
    user: !!user,
    hydrated,
    authLoading,
    isAuthenticated,
    isAuthReady,
    userId: user?.id,
    conversationsCount: Array.isArray(conversations) ? conversations.length : 'NOT_ARRAY',
    conversationsType: typeof conversations,
  });

  const { loading, error, refreshing, lastFetch, refresh } = useConversationsFetcher({
    isAuthReady,
    user,
    setConversations,
  });

  const hasInitialFetch = useRef(false);
  useEffect(() => {
    if (!hasInitialFetch.current) {
      hasInitialFetch.current = true;
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const ensureSelected = async () => {
      if (!selectedConversationId) {
        return;
      }
      if (
        Array.isArray(conversations) &&
        conversations.some(c => c.id === selectedConversationId)
      ) {
        return;
      }
      try {
        const res = await fetch(API_ROUTES.MESSAGES.CONVERSATION_SUMMARY(selectedConversationId), {
          credentials: 'same-origin',
        });
        if (!res.ok) {
          return;
        }
        const responseData = await res.json().catch(() => ({ success: false }));
        const data = responseData.success === true ? responseData.data : responseData;
        if (data?.conversation) {
          const safeConversations = Array.isArray(conversations) ? conversations : [];
          setConversations([data.conversation as Conversation, ...safeConversations]);
        }
      } catch {
        // ignore
      }
    };
    ensureSelected();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversationId]);

  useRealtimeSubscription({
    channelName: CHANNELS.CONVERSATIONS_LIST,
    table: DATABASE_TABLES.CONVERSATIONS,
    events: ['*'],
    onEvent: useCallback(() => {
      const elapsed = Date.now() - lastFetch;
      if (elapsed >= TIMING.REFRESH_DEBOUNCE_MS && !refreshing) {
        refresh();
      }
    }, [refresh, lastFetch, refreshing]),
    enabled: isAuthReady && !!user,
  });

  useRealtimeSubscription({
    channelName: `${CHANNELS.CONVERSATIONS_LIST}-messages`,
    table: DATABASE_TABLES.MESSAGES,
    events: ['INSERT'],
    onEvent: useCallback(() => {
      if (!refreshing) {
        refresh();
      }
    }, [refresh, refreshing]),
    enabled: isAuthReady && !!user,
  });

  useRealtimeSubscription({
    channelName: `${CHANNELS.CONVERSATIONS_LIST}-participants`,
    table: DATABASE_TABLES.CONVERSATION_PARTICIPANTS,
    events: ['UPDATE'],
    onEvent: useCallback(() => {
      if (!refreshing) {
        refresh();
      }
    }, [refresh, refreshing]),
    enabled: isAuthReady && !!user,
  });

  const searcher = useMemo(
    () => createConversationSearch(Array.isArray(conversations) ? conversations : [], user?.id),
    [conversations, user?.id]
  );
  const filtered = useMemo(() => {
    if (!searchQuery?.trim()) {
      return Array.isArray(conversations) ? conversations : [];
    }
    return searcher.search(searchQuery, { relax: false }).map(hit => hit.item);
  }, [conversations, searchQuery, searcher]);

  const removeLocal = useCallback(
    (ids: string[]) => {
      if (!Array.isArray(ids) || ids.length === 0) {
        return;
      }
      const safeConversations = Array.isArray(conversations) ? conversations : [];
      setConversations(safeConversations.filter(c => !ids.includes(c.id)));
    },
    [conversations, setConversations]
  );

  return { conversations: filtered, loading, error, refresh, removeLocal };
}
