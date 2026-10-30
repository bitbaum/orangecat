'use client';

/**
 * One group chat, as the page sees it: the transcript, who is writing now,
 * and a round that keeps asking the server for the next member until the
 * queue is empty or the person stops it. Each bot line arrives as its own
 * request, so the thread fills in one voice at a time.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { COMPANION_COPY } from '@/config/companions';
import type { RoundState } from '@/services/companions/rooms/plan';
import type { NewRoomMember, RoomMessage, RoomView } from '@/services/companions/rooms/types';
import { logger } from '@/utils/logger';

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string; details?: { message?: string } };
}

interface TurnReply {
  messages: RoomMessage[];
  failed: { memberId: string; speaker: string; error: { code: string; message?: string } } | null;
  round: RoundState;
}

export interface RoomLine extends RoomMessage {
  failed?: boolean;
  failure?: string;
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await res.json().catch(() => ({}))) as Envelope<T>;
  if (!res.ok || !json.data) {
    throw new Error(json.error?.details?.message || json.error?.message || `HTTP ${res.status}`);
  }
  return json.data;
}

function describe(error: { code: string; message?: string }): string {
  switch (error.code) {
    case 'INSUFFICIENT_CREDITS':
      return COMPANION_COPY.room.notEnoughCredits;
    case 'SERVICE_UNAVAILABLE':
      return 'the AI service is not set up here';
    default:
      return error.message || 'something went wrong';
  }
}

export function useRoomTalk(roomId: string | null) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [lines, setLines] = useState<RoomLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [writing, setWriting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    if (!roomId) {
      return;
    }
    try {
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.ROOM(roomId));
      const json = (await res.json()) as Envelope<RoomView>;
      if (res.ok && json.data) {
        setRoom(json.data);
        setLines(json.data.messages);
      } else {
        setError(json.error?.message ?? 'Group chat not found');
      }
    } catch (err) {
      logger.error('room failed to load', err, 'useRoomTalk');
      setError('offline');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    setRoom(null);
    setLines([]);
    setError(null);
    setLoading(true);
    void reload();
  }, [reload]);

  /** Keep asking for the next voice until the round is spent or stopped. */
  const runRound = useCallback(
    async (first: TurnReply, controller: AbortController) => {
      let reply = first;
      for (;;) {
        if (reply.failed) {
          const f = reply.failed;
          setLines(prev => [
            ...prev,
            {
              id: `failed-${Date.now()}-${f.memberId}`,
              role: 'assistant',
              memberId: f.memberId,
              speaker: f.speaker,
              content: '',
              createdAt: new Date().toISOString(),
              failed: true,
              failure: COMPANION_COPY.talk.room.failedTurn(f.speaker, describe(f.error)),
            },
          ]);
        }
        const nextId = reply.round.queue[0];
        if (!nextId || controller.signal.aborted) {
          break;
        }
        const next = room?.members.find(m => m.id === nextId);
        setWriting(next?.name ?? null);
        reply = await post<TurnReply>(
          API_ROUTES.AI_ASSISTANTS.ROOM_TURN(roomId as string),
          { round: reply.round },
          controller.signal
        );
        if (reply.messages.length) {
          setLines(prev => [...prev, ...reply.messages]);
        }
      }
    },
    [room, roomId]
  );

  const send = useCallback(
    async (content: string): Promise<boolean> => {
      if (!roomId || writing !== null) {
        return false;
      }
      setError(null);
      const controller = new AbortController();
      abort.current = controller;
      const optimistic: RoomLine = {
        id: `temp-${Date.now()}`,
        role: 'user',
        memberId: null,
        speaker: null,
        content,
        createdAt: new Date().toISOString(),
      };
      setLines(prev => [...prev, optimistic]);
      setWriting(room?.members[0]?.name ?? '');
      try {
        const first = await post<TurnReply>(
          API_ROUTES.AI_ASSISTANTS.ROOM_MESSAGES(roomId),
          { content },
          controller.signal
        );
        setLines(prev => [...prev.filter(l => l.id !== optimistic.id), ...first.messages]);
        await runRound(first, controller);
        return true;
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return true;
        }
        logger.error('room send failed', err, 'useRoomTalk');
        setLines(prev => prev.filter(l => l.id !== optimistic.id));
        setError(err instanceof Error ? err.message : COMPANION_COPY.room.sendFailed);
        return false;
      } finally {
        setWriting(null);
        abort.current = null;
      }
    },
    [roomId, room, writing, runRound]
  );

  const stop = useCallback(() => {
    abort.current?.abort();
  }, []);

  const rename = useCallback(
    async (title: string) => {
      if (!roomId) {
        return;
      }
      const res = await fetch(API_ROUTES.AI_ASSISTANTS.ROOM(roomId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        setRoom(r => (r ? { ...r, title } : r));
      }
    },
    [roomId]
  );

  const remove = useCallback(async () => {
    if (!roomId) {
      return false;
    }
    const res = await fetch(API_ROUTES.AI_ASSISTANTS.ROOM(roomId), { method: 'DELETE' });
    return res.ok;
  }, [roomId]);

  const members = useCallback(async (method: 'POST' | 'DELETE', url: string, body?: unknown) => {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Envelope<{ members: RoomView['members'] }>;
    if (res.ok && json.data) {
      const next = json.data.members;
      setRoom(r => (r ? { ...r, members: next } : r));
    } else {
      setError(json.error?.message ?? COMPANION_COPY.room.sendFailed);
    }
  }, []);

  const addMember = useCallback(
    async (member: NewRoomMember) => {
      if (roomId) {
        await members('POST', API_ROUTES.AI_ASSISTANTS.ROOM_MEMBERS(roomId), member);
      }
    },
    [roomId, members]
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      if (roomId) {
        await members('DELETE', API_ROUTES.AI_ASSISTANTS.ROOM_MEMBER(roomId, memberId));
      }
    },
    [roomId, members]
  );

  return {
    room,
    lines,
    loading,
    writing,
    error,
    send,
    stop,
    rename,
    remove,
    reload,
    addMember,
    removeMember,
  };
}
