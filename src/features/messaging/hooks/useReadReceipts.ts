'use client';

import { fromTable } from '@/lib/supabase/untyped';
import { useCallback, useEffect, useRef, useState } from 'react';
import supabase from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { isCatUsername } from '@/config/usernames';
import type { Message } from '../types';
import { TIMING, debugLog } from '../lib/constants';
import { applyStatusToMessages } from '../lib/message-utils';
import { useRealtimeSubscription } from './useRealtimeSubscription';

/** A participant as read for receipts: how far they have read, and who they are. */
interface ParticipantReadRow {
  user_id: string;
  last_read_at: string | null;
  profiles: { username: string | null } | null;
}

interface UseReadReceiptsReturn {
  participantReadTimes: Map<string, Date | null>;
  refreshReadReceipts: () => Promise<void>;
  /** Apply read status to an array of messages using current participant read times */
  applyReadStatus: (messages: Message[]) => Message[];
}

export function useReadReceipts(
  conversationId: string | null,
  enabled: boolean,
  userId: string | undefined
): UseReadReceiptsReturn {
  const [participantReadTimes, setParticipantReadTimes] = useState<Map<string, Date | null>>(
    new Map()
  );
  const participantReadTimesRef = useRef<Map<string, Date | null>>(participantReadTimes);
  // The Cat's seat, so a read mark that moves only when the Cat writes does not
  // decide whether a person has read your message.
  const agentIdsRef = useRef<ReadonlySet<string>>(new Set());
  const [readReceiptsError, setReadReceiptsError] = useState(false);

  useEffect(() => {
    participantReadTimesRef.current = participantReadTimes;
  }, [participantReadTimes]);

  const fetchParticipantReadTimes = useCallback(async () => {
    if (!conversationId || !enabled || readReceiptsError) {
      return;
    }

    try {
      const { data: participants, error } = await fromTable(
        supabase,
        DATABASE_TABLES.CONVERSATION_PARTICIPANTS
      )
        .select('user_id, last_read_at, profiles:user_id (username)')
        .eq('conversation_id', conversationId)
        .eq('is_active', true);

      if (error) {
        debugLog('Error fetching participant read times:', error);
        if (
          error.message &&
          (error.message.includes('participant_read_times') ||
            error.message.includes('does not exist') ||
            error.code === '42P17')
        ) {
          debugLog('Database schema error detected, disabling read receipts for this session');
          setReadReceiptsError(true);
          setParticipantReadTimes(new Map());
          return;
        }
        return;
      }

      const newMap = new Map<string, Date | null>();
      const agents = new Set<string>();
      (participants || []).forEach((p: ParticipantReadRow) => {
        newMap.set(p.user_id, p.last_read_at ? new Date(p.last_read_at) : null);
        if (isCatUsername(p.profiles?.username)) {
          agents.add(p.user_id);
        }
      });
      // Set before the map, so the statuses recomputed for the new read times
      // already know which seat is the Cat's.
      agentIdsRef.current = agents;
      setParticipantReadTimes(newMap);
    } catch (err) {
      debugLog('Error in fetchParticipantReadTimes:', err);
      setParticipantReadTimes(new Map());
    }
  }, [conversationId, enabled, readReceiptsError]);

  const refreshReadReceipts = useCallback(async () => {
    await fetchParticipantReadTimes();
  }, [fetchParticipantReadTimes]);

  // Stable wrapper: reads from ref so callers don't need to re-subscribe on every receipt change
  const applyReadStatus = useCallback(
    (messages: Message[]): Message[] =>
      applyStatusToMessages(messages, userId, participantReadTimesRef.current, agentIdsRef.current),
    [userId]
  );

  // Initial fetch
  useEffect(() => {
    if (conversationId && enabled) {
      fetchParticipantReadTimes();
    }
  }, [conversationId, enabled, fetchParticipantReadTimes]);

  // Real-time read receipt updates
  useRealtimeSubscription({
    channelName: `read-receipts:${conversationId || 'none'}`,
    table: 'conversation_participants',
    events: ['UPDATE'],
    filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
    onEvent: useCallback(
      ({ new: newRecord }) => {
        if (newRecord && typeof newRecord === 'object') {
          const { user_id, last_read_at } = newRecord as {
            user_id?: string;
            last_read_at?: string | null;
          };
          if (user_id) {
            debugLog('[useReadReceipts] Read receipt updated via real-time', {
              userId: user_id,
              lastReadAt: last_read_at,
              conversationId,
            });
            setParticipantReadTimes(prev => {
              const newMap = new Map(prev);
              newMap.set(user_id, last_read_at ? new Date(last_read_at) : null);
              return newMap;
            });
          }
        }
      },
      [conversationId]
    ),
    enabled: !!conversationId && enabled && !!userId,
    debounceMs: TIMING.READ_RECEIPT_RECALC_DELAY_MS,
  });

  return { participantReadTimes, refreshReadReceipts, applyReadStatus };
}
