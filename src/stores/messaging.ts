'use client';

/**
 * CENTRALIZED MESSAGING STORE - Zustand
 *
 * Single source of truth for all messaging state:
 * - Conversations
 * - Messages
 * - Unread counts
 * - Connection status
 * - Read receipts
 *
 * Replaces: MessagesUnreadContext + scattered state
 * Improves: Performance, consistency, real-time updates
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Conversation, Message } from '@/features/messaging/types';
import { debugLog } from '@/features/messaging/lib/constants';
import type { ConnectionStatus } from '@/hooks/useRealtimeConnection';

interface MessagingState {
  // DATA
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Map<string, Message[]>; // conversationId -> messages
  unreadCount: number;

  // STATUS
  isLoading: boolean;
  connectionStatus: ConnectionStatus;
  lastError: string | null;

  // ACTIONS
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  setCurrentConversation: (conversationId: string | null) => void;

  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;

  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // UTILITIES
  getConversation: (id: string) => Conversation | undefined;
  getMessages: (conversationId: string) => Message[];
  getUnreadCount: () => number;
  clearAll: () => void;
}

const initialState = {
  conversations: [],
  currentConversationId: null,
  messages: new Map(),
  unreadCount: 0,
  isLoading: false,
  connectionStatus: 'disconnected' as ConnectionStatus,
  lastError: null,
};

export const useMessagingStore = create<MessagingState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setConversations: conversations => {
      // Ensure conversations is always an array to prevent runtime errors
      const safeConversations = Array.isArray(conversations) ? conversations : [];
      set({ conversations: safeConversations });
      debugLog('[MessagingStore] Conversations updated:', safeConversations.length);
    },

    addConversation: conversation => {
      set(state => ({
        conversations: [conversation, ...state.conversations],
      }));
      debugLog('[MessagingStore] Conversation added:', conversation.id);
    },

    updateConversation: (conversationId, updates) => {
      set(state => ({
        conversations: state.conversations.map(conv =>
          conv.id === conversationId ? { ...conv, ...updates } : conv
        ),
      }));
      debugLog('[MessagingStore] Conversation updated:', conversationId, updates);
    },

    setCurrentConversation: conversationId => {
      set({ currentConversationId: conversationId });
      debugLog('[MessagingStore] Current conversation set:', conversationId);
    },

    setMessages: (conversationId, messages) => {
      set(state => {
        const newMessages = new Map(state.messages);
        newMessages.set(conversationId, messages);
        return { messages: newMessages };
      });
      debugLog('[MessagingStore] Messages set for conversation:', conversationId, messages.length);
    },

    addMessage: (conversationId, message) => {
      set(state => {
        const newMessages = new Map(state.messages);
        const conversationMessages = newMessages.get(conversationId) || [];
        newMessages.set(conversationId, [...conversationMessages, message]);
        return { messages: newMessages };
      });
      debugLog('[MessagingStore] Message added:', conversationId, message.id);
    },

    updateMessage: (conversationId, messageId, updates) => {
      set(state => {
        const newMessages = new Map(state.messages);
        const conversationMessages = newMessages.get(conversationId) || [];
        const updatedMessages = conversationMessages.map(msg =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        );
        newMessages.set(conversationId, updatedMessages);
        return { messages: newMessages };
      });
      debugLog('[MessagingStore] Message updated:', conversationId, messageId, updates);
    },

    setUnreadCount: count => {
      set({ unreadCount: Math.max(0, count) });
      debugLog('[MessagingStore] Unread count set:', count);
    },

    incrementUnreadCount: () => {
      set(state => ({ unreadCount: state.unreadCount + 1 }));
    },

    decrementUnreadCount: () => {
      set(state => ({ unreadCount: Math.max(0, state.unreadCount - 1) }));
    },

    setConnectionStatus: status => {
      set({ connectionStatus: status });
      debugLog('[MessagingStore] Connection status:', status);
    },

    setLoading: loading => {
      set({ isLoading: loading });
    },

    setError: error => {
      set({ lastError: error });
      debugLog('[MessagingStore] Error set:', error);
    },

    // UTILITIES
    getConversation: id => {
      return get().conversations.find(conv => conv.id === id);
    },

    getMessages: conversationId => {
      return get().messages.get(conversationId) || [];
    },

    getUnreadCount: () => {
      return get().unreadCount;
    },

    clearAll: () => {
      set(initialState);
      debugLog('[MessagingStore] All data cleared');
    },
  }))
);

// Selectors for performance — only those actually consumed
export const useUnreadCount = () => useMessagingStore(state => state.unreadCount);
export const useConnectionStatus = () => useMessagingStore(state => state.connectionStatus);

// Actions
export const messagingActions = {
  setConversations: useMessagingStore.getState().setConversations,
  addConversation: useMessagingStore.getState().addConversation,
  updateConversation: useMessagingStore.getState().updateConversation,
  setCurrentConversation: useMessagingStore.getState().setCurrentConversation,
  setMessages: useMessagingStore.getState().setMessages,
  addMessage: useMessagingStore.getState().addMessage,
  updateMessage: useMessagingStore.getState().updateMessage,
  setUnreadCount: useMessagingStore.getState().setUnreadCount,
  incrementUnreadCount: useMessagingStore.getState().incrementUnreadCount,
  decrementUnreadCount: useMessagingStore.getState().decrementUnreadCount,
  setConnectionStatus: useMessagingStore.getState().setConnectionStatus,
  setLoading: useMessagingStore.getState().setLoading,
  setError: useMessagingStore.getState().setError,
  clearAll: useMessagingStore.getState().clearAll,
};
