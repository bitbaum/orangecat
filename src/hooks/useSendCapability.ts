'use client';

/**
 * Can this visitor pay from their own OrangeCat wallet? — for screens that are
 * public (the pay page) and must offer the one-tap path only to someone who
 * can actually take it.
 *
 * Signed out answers false without asking: the capability check is for an
 * account. While the answer is unknown it is false too, so the first paint
 * offers only what every visitor can do and the wallet button arrives after.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { fetchSendCapability } from '@/services/send/send-client';

export function useSendCapability(): boolean {
  const { user } = useAuth();
  const userId = user?.id;
  const [canSend, setCanSend] = useState(false);

  useEffect(() => {
    if (!userId) {
      setCanSend(false);
      return;
    }
    let live = true;
    void fetchSendCapability().then(c => live && setCanSend(c.canSend === true));
    return () => {
      live = false;
    };
  }, [userId]);

  return canSend;
}
