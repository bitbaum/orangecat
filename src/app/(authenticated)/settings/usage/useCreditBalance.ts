'use client';

/**
 * Data + formatting helpers for Settings → Usage.
 *
 * Split out of page.tsx so the page component stays a composition of
 * sections (and under the size gate); no behaviour change.
 */

import { useEffect, useState } from 'react';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';

export function useCreditBalance(): {
  balanceBtc: number | null;
  isLoading: boolean;
  error: boolean;
  retry: () => void;
} {
  const [balanceBtc, setBalanceBtc] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(false);
    (async () => {
      try {
        const res = await fetch(API_ROUTES.CAT.CREDITS, { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setError(true);
          }
          return;
        }
        const body = (await res.json()) as { success: boolean; data?: { balanceBtc: number } };
        if (!cancelled && body.success && body.data) {
          setBalanceBtc(body.data.balanceBtc);
        }
      } catch (fetchError) {
        logger.warn('Usage page: credit balance fetch failed', { error: fetchError }, 'Usage');
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  return { balanceBtc, isLoading, error, retry: () => setAttempt(a => a + 1) };
}
