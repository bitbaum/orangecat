'use client';

/**
 * An account-free Bitcoin payment, from request to settled.
 *
 * Every public pay surface (support, a guest's ticket) mints an intent that
 * comes back with a bearer status token, polls it until it settles, and — on a
 * bare Lightning address that cannot prove payment — lets the payer say "I've
 * paid" so the recipient can confirm. That loop lives here once.
 *
 * `resumeKey` keeps an unfinished payment on this device: a guest who closes
 * the tab before the invoice settles comes back to the same QR, not a new one.
 */

import { useCallback, useEffect, useState } from 'react';
import { PUBLIC_API_BASE } from '@/config/public-api';
import type { InitiatePublicSupportResult, PaymentIntentStatus } from '@/domain/payments';

export type PublicPaymentPhase =
  'choose' | 'creating' | 'awaiting' | 'recipient_confirmation' | 'paid' | 'expired' | 'error';

export type PublicIntent = InitiatePublicSupportResult;

const POLL_MS = 5000;

const FAILED_MESSAGE =
  'This payment didn’t go through. If your wallet shows it as sent, check its history before trying again.';

export async function readApiError(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message || fallback;
}

function readSaved(key: string | undefined): PublicIntent | null {
  if (!key) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as PublicIntent) : null;
  } catch {
    return null;
  }
}

function writeSaved(key: string | undefined, intent: PublicIntent | null) {
  if (!key) {
    return;
  }
  try {
    if (intent) {
      window.localStorage.setItem(key, JSON.stringify(intent));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked: the payment still works, it just cannot be resumed here.
  }
}

interface UsePublicPaymentOptions {
  resumeKey?: string;
  /** Called once when the payment settles, with whatever the poll returned. */
  onPaid?: (status: { guest_ticket_path?: string }) => void;
}

export function usePublicPayment({ resumeKey, onPaid }: UsePublicPaymentOptions = {}) {
  const [phase, setPhase] = useState<PublicPaymentPhase>('choose');
  const [intent, setIntent] = useState<PublicIntent | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = readSaved(resumeKey);
    if (saved) {
      setIntent(saved);
      setPhase('awaiting');
    }
  }, [resumeKey]);

  useEffect(() => {
    if (!intent || (phase !== 'awaiting' && phase !== 'recipient_confirmation')) {
      return;
    }

    let stopped = false;
    const check = async () => {
      const response = await fetch(
        `${PUBLIC_API_BASE}/payments/public/${intent.payment_intent.id}`,
        { headers: { 'x-payment-token': intent.status_token }, cache: 'no-store' }
      );
      if (stopped) {
        return;
      }
      if (response.status === 404) {
        // The saved payment is gone (or never was ours): start over.
        writeSaved(resumeKey, null);
        setIntent(null);
        setPhase('choose');
        return;
      }
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as {
        data: {
          status: PaymentIntentStatus;
          requires_recipient_confirmation: boolean;
          guest_ticket_path?: string;
        };
      };
      if (body.data.status === 'paid') {
        writeSaved(resumeKey, null);
        setPhase('paid');
        onPaid?.(body.data);
      } else if (body.data.status === 'expired') {
        writeSaved(resumeKey, null);
        setPhase('expired');
      } else if (body.data.status === 'failed') {
        // Not "expired": a failed payment is a different thing to be told.
        writeSaved(resumeKey, null);
        setError(FAILED_MESSAGE);
        setPhase('error');
      } else if (body.data.requires_recipient_confirmation) {
        setPhase('recipient_confirmation');
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [intent, phase, resumeKey, onPaid]);

  /** Mint the intent: `create` performs the POST that returns `{ data: PublicIntent }`. */
  const start = useCallback(
    async (create: () => Promise<Response>) => {
      setPhase('creating');
      setError('');
      try {
        const response = await create();
        if (!response.ok) {
          throw new Error(await readApiError(response, 'Could not create the payment request.'));
        }
        const body = (await response.json()) as { data: PublicIntent };
        writeSaved(resumeKey, body.data);
        setIntent(body.data);
        setPhase('awaiting');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not create the payment request.');
        setPhase('error');
      }
    },
    [resumeKey]
  );

  const acknowledge = useCallback(async () => {
    if (!intent) {
      return;
    }
    const response = await fetch(`${PUBLIC_API_BASE}/payments/public/${intent.payment_intent.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-payment-token': intent.status_token },
      body: JSON.stringify({ action: 'acknowledge' }),
    });
    if (response.ok) {
      setPhase('recipient_confirmation');
    } else {
      setError(await readApiError(response, 'Could not record that you paid.'));
      setPhase('error');
    }
  }, [intent]);

  const reset = useCallback(() => {
    writeSaved(resumeKey, null);
    setIntent(null);
    setError('');
    setPhase('choose');
  }, [resumeKey]);

  return { phase, intent, error, start, acknowledge, reset };
}
