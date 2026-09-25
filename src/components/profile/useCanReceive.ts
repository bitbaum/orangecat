'use client';

import { useEffect, useState } from 'react';
import { fetchTipReceiveInfo } from '@/services/tips/tip-client';

/**
 * Whether money sent to `username` can actually arrive — asked of
 * `/api/tips/receive-info`, which runs the same resolution a real payment
 * runs. `null` while unknown. Every "Pay" affordance on the profile reads this
 * rather than guessing from which columns are filled in.
 */
export function useCanReceive(username: string | null | undefined): boolean | null {
  const [canReceive, setCanReceive] = useState<boolean | null>(null);

  useEffect(() => {
    if (!username) {
      setCanReceive(false);
      return;
    }
    let live = true;
    fetchTipReceiveInfo(username)
      .then(info => live && setCanReceive(info.canReceive))
      .catch(() => live && setCanReceive(false));
    return () => {
      live = false;
    };
  }, [username]);

  return canReceive;
}
