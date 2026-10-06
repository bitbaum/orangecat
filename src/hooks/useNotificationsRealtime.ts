'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/browser';
import type { RealtimePostgresDeletePayload, User } from '@supabase/supabase-js';
import type { Notification } from './useNotifications';
import { DATABASE_TABLES } from '@/config/database-tables';

interface Props {
  user: User | null;
  enabled: boolean;
  onInsert: (notification: Notification) => void;
  onUpdate: (updated: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

export function useNotificationsRealtime({ user, enabled, onInsert, onUpdate, onDelete }: Props) {
  // Keep the handlers in refs so subscribing only depends on identity
  // (userId + enabled). Otherwise Supabase auth-refresh emits a new
  // User object hourly → channel tear-down + resubscribe; and any
  // parent re-render that doesn't memoize the handler props would
  // also tear down the channel.
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onDeleteRef = useRef(onDelete);
  onInsertRef.current = onInsert;
  onUpdateRef.current = onUpdate;
  onDeleteRef.current = onDelete;

  const userId = user?.id;

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    const channel = supabase
      // Channel name includes userId so simultaneous mounts in different
      // components don't collide.
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: DATABASE_TABLES.NOTIFICATIONS,
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          onInsertRef.current(payload.new as unknown as Notification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: DATABASE_TABLES.NOTIFICATIONS,
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          onUpdateRef.current(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: DATABASE_TABLES.NOTIFICATIONS,
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresDeletePayload<{ id: string }>) => {
          onDeleteRef.current(payload.old.id as string);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled]);
}
