import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { leavesTemporary } from '@/lib/chat/temporary-chat';
import { logger } from '@/utils/logger';

export interface ConversationSummary {
  id: string;
  title: string | null;
  is_default: boolean;
  updated_at: string;
}

/**
 * Manages the user's Cat conversation list for the rail: load, switch, start a
 * new chat, and delete.
 *
 * `activeId === null` means "fresh new chat" — the draft state the page lands
 * on and the state after "New chat". No conversation row exists yet; the chat
 * panel creates one lazily on the first send (see useChatMessages) and adopts
 * it via `adoptConversation`. This is deliberate: eagerly POSTing on load or on
 * "New chat" litters the rail (and the DB) with empty untitled conversations.
 */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // A temporary chat (src/lib/chat/temporary-chat.ts): `temporaryArmed` means
  // the next conversation the panel creates is one; `temporaryId` is the one
  // the person is in. Leaving it — any other activeId, or the page going
  // away — deletes it; the server never lists it.
  const [temporaryArmed, setTemporaryArmed] = useState(false);
  const [temporaryId, setTemporaryId] = useState<string | null>(null);
  const temporaryIdRef = useRef<string | null>(null);
  const prevActiveRef = useRef<string | null>(null);

  const discardTemporary = useCallback((id: string) => {
    temporaryIdRef.current = null;
    setTemporaryId(null);
    // keepalive: a closed tab still gets it out; the daily sweep is the net.
    void fetch(API_ROUTES.CAT.CONVERSATION(id), { method: 'DELETE', keepalive: true }).catch(
      () => undefined
    );
  }, []);

  useEffect(() => {
    const prev = prevActiveRef.current;
    prevActiveRef.current = activeId;
    if (leavesTemporary(prev, activeId, temporaryIdRef.current)) {
      discardTemporary(temporaryIdRef.current as string);
    }
  }, [activeId, discardTemporary]);

  useEffect(() => {
    const onHide = () => {
      if (temporaryIdRef.current) {
        discardTemporary(temporaryIdRef.current);
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      if (temporaryIdRef.current) {
        discardTemporary(temporaryIdRef.current);
      }
    };
  }, [discardTemporary]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.CAT.CONVERSATIONS);
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      const list: ConversationSummary[] = data?.data?.conversations ?? [];
      setConversations(list);
    } catch (err) {
      logger.warn('Failed to load conversations', { err }, 'useConversations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectConversation = useCallback((id: string) => {
    setTemporaryArmed(false);
    setActiveId(id);
  }, []);

  /** "New chat": back to the draft state. The row is created on first send. */
  const newConversation = useCallback(() => {
    setTemporaryArmed(false);
    setActiveId(null);
  }, []);

  /** "Temporary chat": the draft state, and the row the first send creates
   *  is never listed and gone when the person leaves it. */
  const newTemporaryConversation = useCallback(() => {
    setTemporaryArmed(true);
    setActiveId(null);
  }, []);

  /** Adopt a conversation the chat panel just created on first send. */
  const adoptConversation = useCallback(
    (id: string) => {
      if (temporaryArmed) {
        temporaryIdRef.current = id;
        setTemporaryId(id);
        setTemporaryArmed(false);
        setActiveId(id);
        return;
      }
      setActiveId(id);
      void refresh();
    },
    [refresh, temporaryArmed]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      // Optimistic: drop it from the list immediately; if it was active,
      // fall back to a fresh new chat.
      setConversations(prev => prev.filter(c => c.id !== id));
      setActiveId(prev => (prev === id ? null : prev));
      try {
        await fetch(API_ROUTES.CAT.CONVERSATION(id), { method: 'DELETE' });
      } catch (err) {
        logger.warn('Failed to delete conversation', { err }, 'useConversations');
      }
      await refresh();
    },
    [refresh]
  );

  return {
    conversations,
    activeId,
    isLoading,
    refresh,
    selectConversation,
    newConversation,
    newTemporaryConversation,
    /** The next first send creates a temporary chat. */
    temporaryArmed,
    /** The open conversation is a temporary chat. */
    temporaryActive: activeId !== null && activeId === temporaryId,
    adoptConversation,
    deleteConversation,
  };
}
