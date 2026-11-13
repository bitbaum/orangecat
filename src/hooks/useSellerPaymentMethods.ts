/**
 * useSellerPaymentMethods — can this seller be paid?
 *
 * Used to show/disable the PaymentButton on entity pages. Asks the server
 * (GET /api/payments/can-receive), which answers via the SAME wallet
 * resolution the payment flow runs — the UI can never claim a capability the
 * payment path doesn't have. Never reads wallet rows from the browser:
 * wallet rows are owner-readable only, and another user's wallet details
 * (xpub, addresses) must not reach the client.
 */

'use client';

import { API_ROUTES } from '@/config/api-routes';
import { useState, useEffect } from 'react';

interface SellerPaymentInfo {
  hasWallet: boolean;
  loading: boolean;
}

export function useSellerPaymentMethods(sellerProfileId: string | null): SellerPaymentInfo {
  const [info, setInfo] = useState<SellerPaymentInfo>({ hasWallet: false, loading: true });

  useEffect(() => {
    if (!sellerProfileId) {
      setInfo({ hasWallet: false, loading: false });
      return;
    }

    let cancelled = false;
    // A new profile is unknown until asked: never answer for it with the
    // previous one's verdict (or the "no wallet" given while there was none).
    setInfo({ hasWallet: false, loading: true });

    async function check() {
      try {
        const res = await fetch(
          `${API_ROUTES.PAYMENTS.CAN_RECEIVE}?profile_id=${encodeURIComponent(sellerProfileId!)}`
        );
        const body = res.ok ? await res.json() : null;
        if (!cancelled) {
          setInfo({ hasWallet: !!body?.data?.canReceive, loading: false });
        }
      } catch {
        // Conservative default: claiming a working payment rail we could not
        // verify is the failure mode to avoid.
        if (!cancelled) {
          setInfo({ hasWallet: false, loading: false });
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [sellerProfileId]);

  return info;
}
