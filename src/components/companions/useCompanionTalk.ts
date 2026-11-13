'use client';

/**
 * State for one person's conversations with one companion.
 *
 * Resumes the most recent thread on open (the old widget started a fresh
 * conversation on every page load), starts a thread lazily on the first
 * message, and keeps the 402 case explicit so the room can offer a top-up.
 * Non-streaming by design in phase one: one JSON round trip per turn.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';
import type { PendingAction } from '@/components/ai-chat/usePendingActions';
import type { ChatImage } from '@/services/cat/chat-images';
import { readChosenModel } from './talk/chosen-model';

export interface TalkMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/**
 * What the API actually hands back. Threads created before the prompt was
 * composed per turn still hold a `system` row; the server filters them now,
 * and this narrows what an older deployment might still return.
 */
type StoredMessage = Omit<TalkMessage, 'role'> & { role: 'user' | 'assistant' | 'system' };

function conversationTurns(stored: StoredMessage[]): TalkMessage[] {
  return stored.filter((m): m is TalkMessage => m.role !== 'system');
}

export interface TalkThreadSummary {
  id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: unknown };
}

export interface CreditsNeeded {
  balance: number;
  required: number;
}

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url);
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as ApiEnvelope<T>;
  return json.data ?? null;
}

export function useCompanionTalk(assistantId: string) {
  const [threads, setThreads] = useState<TalkThreadSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsNeeded, setCreditsNeeded] = useState<CreditsNeeded | null>(null);
  /** The day's free messages are spent: the way forward is the person's own key. */
  const [limitReached, setLimitReached] = useState(false);
  const [poolDown, setPoolDown] = useState(false);
  /** What the companion proposed to set in motion, waiting for the person's tap. */
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const loadThread = useCallback(
    async (threadId: string) => {
      const detail = await getJson<{ messages: StoredMessage[] }>(
        API_ROUTES.AI_ASSISTANTS.CONVERSATION(assistantId, threadId)
      );
      setActiveId(threadId);
      setMessages(conversationTurns(detail?.messages ?? []));
    },
    [assistantId]
  );

  // Resume the latest thread on open.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list =
          (await getJson<TalkThreadSummary[]>(
            API_ROUTES.AI_ASSISTANTS.CONVERSATIONS(assistantId)
          )) ?? [];
        if (cancelled) {
          return;
        }
        setThreads(list);
        if (list.length > 0) {
          await loadThread(list[0].id);
        }
      } catch (err) {
        logger.error('Companion threads failed to load', err, 'useCompanionTalk');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assistantId, loadThread]);

  const ensureThread = useCallback(async (): Promise<string> => {
    if (activeId) {
      return activeId;
    }
    const res = await fetch(API_ROUTES.AI_ASSISTANTS.CONVERSATIONS(assistantId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const json = (await res.json()) as ApiEnvelope<TalkThreadSummary>;
    if (!res.ok || !json.data?.id) {
      throw new Error(json.error?.message || 'Could not start a conversation');
    }
    setActiveId(json.data.id);
    setThreads(prev => [json.data as TalkThreadSummary, ...prev]);
    return json.data.id;
  }, [assistantId, activeId]);

  /** True when the message was delivered; false leaves the words in the box. */
  const send = useCallback(
    async (content: string, images?: ChatImage[]): Promise<boolean> => {
      setError(null);
      setCreditsNeeded(null);
      setLimitReached(false);
      setPoolDown(false);
      const optimistic: TalkMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, optimistic]);
      setSending(true);
      try {
        const threadId = await ensureThread();
        const chosenModel = readChosenModel(assistantId);
        const res = await fetch(
          API_ROUTES.AI_ASSISTANTS.CONVERSATION_MESSAGES(assistantId, threadId),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              images,
              // The model chosen for this bot on this device, if any (ModelRow).
              ...(chosenModel ? { model: chosenModel } : {}),
            }),
          }
        );
        const json = (await res.json()) as ApiEnvelope<{
          userMessage: TalkMessage;
          assistantMessage: TalkMessage;
          pendingAction?: PendingAction;
          /** Hands the bot ran on its own this turn; their lines are in the thread. */
          steps?: number;
        }>;
        if (res.status === 402) {
          const d = (json.error?.details ?? {}) as {
            currentBalance?: number;
            requiredAmount?: number;
          };
          setCreditsNeeded({ balance: d.currentBalance ?? 0, required: d.requiredAmount ?? 0 });
          setMessages(prev => prev.filter(m => m.id !== optimistic.id));
          return false;
        }
        if (res.status === 429) {
          // Seen live (2026-10-31): the eleventh message of the day came back
          // as "That did not go through. Try again.", which is not true and
          // leads nowhere. The server says what happened; show that, and the
          // way out.
          setLimitReached(true);
        }
        // The shared pool could not answer (seen live 2026-11-12, for hours):
        // "Try again" leads nowhere then. The server's line names the way out.
        const pool = (json.error?.details ?? {}) as { sharedPool?: boolean; message?: string };
        if (res.status === 502 && pool.sharedPool && pool.message) {
          setPoolDown(true);
          throw new Error(pool.message);
        }
        if (!res.ok || !json.data) {
          throw new Error(json.error?.message || 'Failed to send message');
        }
        setMessages(prev => [
          ...prev.filter(m => m.id !== optimistic.id),
          json.data!.userMessage,
          json.data!.assistantMessage,
        ]);
        if (json.data.pendingAction) {
          setPendingAction(json.data.pendingAction);
        }
        if (json.data.steps) {
          // The bot worked through steps of its own: each is a stored line.
          // Re-read the thread so they show in order; if that fails, the
          // first and last lines above are still true.
          await loadThread(threadId).catch(err =>
            logger.error('Thread re-read after steps failed', err, 'useCompanionTalk')
          );
        }
        return true;
      } catch (err) {
        logger.error('Companion send failed', err, 'useCompanionTalk');
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        return false;
      } finally {
        setSending(false);
      }
    },
    [assistantId, ensureThread, loadThread]
  );

  /**
   * A card ran: the server wrote its outcome into the thread (outcomes.ts).
   * Re-read the thread so the line shows where it was asked for, and drop
   * the card. If the re-read fails the card's own outcome line stays.
   */
  const showOutcome = useCallback(async () => {
    if (!activeId) {
      return;
    }
    try {
      await loadThread(activeId);
      setPendingAction(null);
    } catch (err) {
      logger.warn('thread did not refresh after a card ran', err, 'useCompanionTalk');
    }
  }, [activeId, loadThread]);

  const startNewThread = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setCreditsNeeded(null);
    setLimitReached(false);
    setPoolDown(false);
    setPendingAction(null);
  }, []);

  return {
    threads,
    activeId,
    messages,
    loading,
    sending,
    error,
    creditsNeeded,
    limitReached,
    poolDown,
    pendingAction,
    /** The card is answered or dismissed; the chat shows no card. */
    clearPendingAction: () => setPendingAction(null),
    showOutcome,
    send,
    loadThread,
    startNewThread,
  };
}
