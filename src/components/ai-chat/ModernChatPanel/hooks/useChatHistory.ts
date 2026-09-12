import { useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';
import type { Message, ToolCallEvent } from '../types';

/**
 * Loads chat history for the active conversation.
 *
 * - `conversationId` set → load that conversation (and reload on switch),
 *   clearing the view immediately so the previous thread doesn't linger.
 * - `conversationId` null → fresh new-chat draft: no fetch, no loading state.
 *   (The old behaviour — loading the default conversation — is what made the
 *   page flash "Loading conversation…" and then open an old thread.)
 * - `justCreatedIdRef` guard: when the panel lazily creates a conversation on
 *   first send and adopts it, the id flips null → new id while the live
 *   stream is already in state. Fetching then would wipe the thread (the
 *   server saves messages after the exchange), so that one transition is
 *   skipped. The guard is consumed on match, so revisiting the conversation
 *   later refetches normally.
 */
export function useChatHistory(
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  conversationId?: string | null,
  justCreatedIdRef?: React.MutableRefObject<string | null>
) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(!!conversationId);

  useEffect(() => {
    if (!conversationId) {
      // Fresh new chat: nothing to load.
      setMessages([]);
      setIsLoadingHistory(false);
      return;
    }

    if (justCreatedIdRef?.current === conversationId) {
      justCreatedIdRef.current = null;
      setIsLoadingHistory(false);
      return;
    }

    let cancelled = false;
    setIsLoadingHistory(true);
    // Switching conversations: drop the old thread right away.
    setMessages([]);

    fetch(API_ROUTES.CAT.CONVERSATION(conversationId))
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (cancelled || !data?.data?.length) {
          return;
        }
        const historicMessages: Message[] = data.data.map(
          (m: {
            id: string;
            role: 'user' | 'assistant';
            content: string;
            created_at: string;
            model_used?: string;
            tool_calls?: ToolCallEvent[] | null;
          }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.created_at),
            modelUsed: m.model_used ?? undefined,
            // What Cat did, back on screen. Rows written before the column
            // existed carry null and render exactly as they do today.
            toolCalls: m.tool_calls ?? undefined,
          })
        );
        setMessages(historicMessages);
      })
      .catch((err: unknown) => {
        logger.warn('Chat history load failed', { err }, 'useChatMessages');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setMessages, conversationId, justCreatedIdRef]);

  return { isLoadingHistory };
}
