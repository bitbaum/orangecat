'use client';

/**
 * The next payment to arrive for you, while you are looking at the screen that
 * asks for it.
 *
 * Someone scans your code at a counter and pays; you should not have to check
 * a bell to learn it worked. Settlement already writes a notification the
 * moment the payment is observed, so this only listens for that row — on a
 * channel of its own, because the bell's channel is named for the user and a
 * second subscriber under the same name would collide with it.
 *
 * Only payments that arrive AFTER the screen opened are reported: an INSERT
 * stream starts at subscription, so history never replays as news.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { incomingPaymentFrom, type IncomingPayment } from '@/domain/payments/incomingPayment';

export function useIncomingPayment(enabled: boolean = true): {
  payment: IncomingPayment | null;
  dismiss: () => void;
} {
  const { user } = useAuth();
  const userId = user?.id;
  const [payment, setPayment] = useState<IncomingPayment | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }
    const channel = supabase
      .channel(`incoming-payment:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: DATABASE_TABLES.NOTIFICATIONS,
          filter: `user_id=eq.${userId}`,
        },
        (event: { new: Record<string, unknown> }) => {
          const arrived = incomingPaymentFrom(
            event.new as { id: string; type: string; metadata?: Record<string, unknown> }
          );
          if (arrived) {
            setPayment(arrived);
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, enabled]);

  const dismiss = useCallback(() => setPayment(null), []);
  return { payment, dismiss };
}
