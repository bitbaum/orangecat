/**
 * usePaymentFlow — Manages the full payment lifecycle
 *
 * 1. Initiate payment (POST /api/payments)
 * 2. Poll for status (GET /api/payments/[id])
 * 3. Handle success/expiry
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  InitiatePaymentResult,
  PaymentIntentStatus,
  PaymentMethod,
} from '@/domain/payments/types';
import type { EntityType } from '@/config/entity-registry';
import { API_ROUTES } from '@/config/api-routes';

// Poll intervals by payment method
const POLL_INTERVALS: Record<PaymentMethod, number> = {
  nwc: 3_000, // 3 seconds — NWC can detect quickly
  lightning_address: 5_000, // 5 seconds
  onchain: 30_000, // 30 seconds — blocks take time
};

type PaymentFlowState =
  | { phase: 'idle' }
  | { phase: 'initiating' }
  | { phase: 'awaiting_payment'; data: InitiatePaymentResult; notice?: string }
  | { phase: 'success'; data: InitiatePaymentResult }
  /** The buyer said "I've paid"; nothing has verified it. The seller confirms. */
  | { phase: 'claimed'; data: InitiatePaymentResult }
  | { phase: 'expired' }
  | { phase: 'error'; message: string };

export function usePaymentFlow() {
  const [state, setState] = useState<PaymentFlowState>({ phase: 'idle' });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (paymentIntentId: string, method: PaymentMethod, data: InitiatePaymentResult) => {
      stopPolling();

      const interval = POLL_INTERVALS[method];

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_ROUTES.PAYMENTS.BASE}/${paymentIntentId}`);
          if (!res.ok) {
            return;
          }

          const json = await res.json();
          const status = json.data?.status as PaymentIntentStatus;

          if (status === 'paid') {
            stopPolling();
            setState({ phase: 'success', data });
          } else if (status === 'expired') {
            stopPolling();
            setState({ phase: 'expired' });
          } else if (status === 'buyer_confirmed') {
            // A claim, not a verification: "Payment successful" here told the
            // buyer something the server does not know (audit 2026-10-07).
            stopPolling();
            setState({ phase: 'claimed', data });
          }
        } catch {
          // Silently ignore poll errors — will retry on next interval
        }
      }, interval);
    },
    [stopPolling]
  );

  const initiate = useCallback(
    async (params: {
      entity_type: EntityType;
      entity_id: string;
      amount_btc?: number;
      message?: string;
      is_anonymous?: boolean;
      shipping_address_id?: string;
      buyer_note?: string;
    }) => {
      setState({ phase: 'initiating' });

      try {
        const res = await fetch(API_ROUTES.PAYMENTS.BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        // An HTML error page (a 502) must not surface as "Unexpected token '<'".
        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.success) {
          setState({
            phase: 'error',
            message: json?.error?.message || 'Could not start the payment. Please try again.',
          });
          return;
        }

        const data = json.data as InitiatePaymentResult;
        setState({ phase: 'awaiting_payment', data });

        // Start polling for payment confirmation
        const method = data.payment_intent.payment_method as PaymentMethod;
        startPolling(data.payment_intent.id, method, data);
      } catch {
        setState({
          phase: 'error',
          message: 'Could not reach OrangeCat. Check your connection and try again.',
        });
      }
    },
    [startPolling]
  );

  const confirmPaid = useCallback(async () => {
    if (state.phase !== 'awaiting_payment') {
      return;
    }

    const piId = state.data.payment_intent.id;

    try {
      const res = await fetch(`${API_ROUTES.PAYMENTS.BASE}/${piId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buyer_confirm' }),
      });

      const json = await res.json().catch(() => null);

      if (res.ok && json?.success) {
        stopPolling();
        setState({ phase: 'claimed', data: state.data });
      } else {
        // Keep the invoice on screen. The error phase's "Try again" minted a
        // NEW invoice — an invitation to pay twice for someone who already had.
        setState({
          ...state,
          notice: json?.error?.message || 'Could not record that just now. Tap again in a moment.',
        });
      }
    } catch {
      setState({ ...state, notice: 'Could not reach OrangeCat. Tap again in a moment.' });
    }
  }, [state, stopPolling]);

  const reset = useCallback(() => {
    stopPolling();
    setState({ phase: 'idle' });
  }, [stopPolling]);

  return {
    state,
    initiate,
    confirmPaid,
    reset,
    isLoading: state.phase === 'initiating',
    isAwaitingPayment: state.phase === 'awaiting_payment',
    isSuccess: state.phase === 'success',
    isError: state.phase === 'error',
  };
}
