'use client';

/**
 * Fetches the server's answer to "can I actually be paid right now" so the
 * wallets page states verified facts instead of client-side guesses. Refetches
 * whenever the wallet set changes, so adding/removing a wallet updates the
 * claim immediately.
 */

import { useCallback, useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';

export interface ReceiveStatus {
  username: string | null;
  lightningAddress: string | null;
  rail: 'nwc' | 'lightning_address' | 'onchain' | null;
  lightningAddressActive: boolean;
  unusableConnectionWalletIds: string[];
  arrivesAt: string | null;
}

export function useReceiveStatus(walletsSignature: string, enabled: boolean) {
  const [status, setStatus] = useState<ReceiveStatus | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    try {
      const res = await fetch(API_ROUTES.WALLETS.RECEIVE_STATUS);
      if (!res.ok) {
        throw new Error(`status ${res.status}`);
      }
      const body = (await res.json()) as { data?: ReceiveStatus };
      setStatus(body.data ?? null);
    } catch (error) {
      // Fail closed: no status means the card claims nothing.
      logger.warn('Could not load receive status', { error }, 'Wallets');
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh, walletsSignature]);

  return { status, isLoading, refresh };
}
