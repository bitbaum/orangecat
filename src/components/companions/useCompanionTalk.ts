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

  const send = useCallback(
    async (content: string) => {
      setError(null);
      setCreditsNeeded(null);
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
        const res = await fetch(
          API_ROUTES.AI_ASSISTANTS.CONVERSATION_MESSAGES(assistantId, threadId),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
          }
        );
        const json = (await res.json()) as ApiEnvelope<{
          userMessage: TalkMessage;
          assistantMessage: TalkMessage;
        }>;
        if (res.status === 402) {
          const d = (json.error?.details ?? {}) as {
            currentBalance?: number;
            requiredAmount?: number;
          };
          setCreditsNeeded({ balance: d.currentBalance ?? 0, required: d.requiredAmount ?? 0 });
          setMessages(prev => prev.filter(m => m.id !== optimistic.id));
          return;
        }
        if (!res.ok || !json.data) {
          throw new Error(json.error?.message || 'Failed to send message');
        }
        setMessages(prev => [
          ...prev.filter(m => m.id !== optimistic.id),
          json.data!.userMessage,
          json.data!.assistantMessage,
        ]);
      } catch (err) {
        logger.error('Companion send failed', err, 'useCompanionTalk');
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setSending(false);
      }
    },
    [assistantId, ensureThread]
  );

  const startNewThread = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setCreditsNeeded(null);
  }, []);

  return {
    threads,
    activeId,
    messages,
    loading,
    sending,
    error,
    creditsNeeded,
    send,
    loadThread,
    startNewThread,
  };
}
