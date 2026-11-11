'use client';

/**
 * A chat with one of the fleet's bots. The product on the far side keeps
 * nothing (Diplodoctor's /api/ask stores no question and no answer), and
 * neither does OrangeCat: the thread lives in this browser, so what a person
 * asks a health or legal bot stays on their own device.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessageData } from '@bitbaum/chatkit/react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import { logger } from '@/utils/logger';

const KEY = (slug: string) => `oc-fleet-talk:${slug}:v1`;
/** The lines sent along; the contract takes at most twenty. */
const CONTEXT = 20;

function read(slug: string): ChatMessageData[] {
  try {
    const raw = localStorage.getItem(KEY(slug));
    const list = raw ? (JSON.parse(raw) as ChatMessageData[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(slug: string, messages: ChatMessageData[]) {
  try {
    localStorage.setItem(KEY(slug), JSON.stringify(messages.slice(-200)));
  } catch {
    // Storage blocked or full: the thread lives for the page.
  }
}

export function useFleetTalk(slug: string | null) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sending, setSending] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    setMessages(slug ? read(slug) : []);
  }, [slug]);

  const persist = useCallback(
    (next: ChatMessageData[]) => {
      setMessages(next);
      if (slug) {
        write(slug, next);
      }
    },
    [slug]
  );

  const run = useCallback(
    async (history: ChatMessageData[]) => {
      if (!slug) {
        return;
      }
      persist(history);
      setSending(true);
      const controller = new AbortController();
      abort.current = controller;
      const id = `a${++counter.current}-${Date.now()}`;
      try {
        const res = await fetch(API_ROUTES.AI_ASSISTANTS.FLEET_ASK(slug), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: history.slice(-CONTEXT).map(m => ({ role: m.role, content: m.content })),
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { text: string; replies?: string[] };
          error?: { message?: string; details?: { message?: string } };
        };
        if (!res.ok || !json.data) {
          persist([
            ...history,
            {
              id,
              role: 'assistant',
              content: '',
              failed: true,
              failure: {
                message:
                  json.error?.details?.message ||
                  json.error?.message ||
                  COMPANION_COPY.room.sendFailed,
              },
            },
          ]);
          return;
        }
        persist([
          ...history,
          { id, role: 'assistant', content: json.data.text, replies: json.data.replies ?? [] },
        ]);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          logger.error('fleet ask failed', err, 'useFleetTalk');
          persist([...history, { id, role: 'assistant', content: '', failed: true }]);
        }
      } finally {
        setSending(false);
        abort.current = null;
      }
    },
    [slug, persist]
  );

  const send = useCallback(
    (text: string): boolean => {
      const clean = text.trim();
      if (!clean || sending) {
        return false;
      }
      const base = messages.filter(m => !m.failed);
      void run([
        ...base,
        { id: `u${++counter.current}-${Date.now()}`, role: 'user', content: clean },
      ]);
      return true;
    },
    [messages, sending, run]
  );

  const retry = useCallback(() => {
    const base = messages.filter(m => !m.failed);
    if (base.length && base[base.length - 1].role === 'user') {
      void run(base);
    }
  }, [messages, run]);

  const stop = useCallback(() => abort.current?.abort(), []);

  const clear = useCallback(() => persist([]), [persist]);

  return { messages, sending, send, retry, stop, clear };
}
