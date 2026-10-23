'use client';

/**
 * The state of paying someone, off the screen: check they can receive, mint an
 * invoice against their own wallet, watch it settle — and, for a payer who is
 * signed in with a wallet connected, pay that same invoice from it in one tap.
 *
 * The wallet path is deliberately a way of paying the SAME invoice, not a
 * second payment system: settlement, the recipient's note and a request's
 * "paid" all keep running through the one intent. Three rules keep it honest:
 *  - a wallet that says no leaves the invoice on screen to pay from elsewhere
 *    (no dead end);
 *  - a timeout is not a "no" — the wallet may still be paying, so the same
 *    invoice stays watched and nothing offers a second payment until it
 *    expires (a retry would mint a NEW invoice, a second real payment);
 *  - the amount paid is the invoice's, read on the server.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTipInvoice,
  fetchTipReceiveInfo,
  fetchTipStatus,
  type TipInvoice,
} from '@/services/tips/tip-client';
import { payIntentFromWallet, SendError } from '@/services/send/send-client';
import { DEFAULT_TIP_BTC, TIP_POLL_INTERVAL_MS } from '@/config/tips';

export type PayFlowState = 'pending' | 'paid' | 'expired';

interface Options {
  username: string;
  active: boolean;
  initialCanReceive?: boolean;
  initialAmountBtc?: number;
  requestId?: string;
  onAmountChange?: (btc: number) => void;
}

export function usePayFlow({
  username,
  active,
  initialCanReceive,
  initialAmountBtc,
  requestId,
  onAmountChange,
}: Options) {
  const knownUpFront = initialCanReceive !== undefined;
  const [amount, setAmount] = useState(initialAmountBtc ?? DEFAULT_TIP_BTC);
  const [checkingWallet, setCheckingWallet] = useState(!knownUpFront);
  const [canReceive, setCanReceive] = useState<boolean | null>(initialCanReceive ?? null);
  const [invoice, setInvoice] = useState<TipInvoice | null>(null);
  const [settleState, setSettleState] = useState<PayFlowState>('pending');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The wallet path.
  const [paying, setPaying] = useState(false);
  const [paidFromWallet, setPaidFromWallet] = useState(false);
  const [walletNote, setWalletNote] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);

  const clearWalletState = useCallback(() => {
    setPaying(false);
    setPaidFromWallet(false);
    setWalletNote(null);
    setUnconfirmed(null);
  }, []);

  // Asking again for what the server already told us would put the spinner back
  // on screen for the length of a round trip — the exact flash this prop exists
  // to remove. Only the first pass is skipped; reopening a modal still rechecks,
  // because a wallet can be connected between visits.
  const skipFirstCheck = useRef(knownUpFront);
  useEffect(() => {
    if (!active) {
      return;
    }
    if (skipFirstCheck.current) {
      skipFirstCheck.current = false;
      return;
    }
    let live = true;
    setInvoice(null);
    setSettleState('pending');
    setError(null);
    clearWalletState();
    setAmount(initialAmountBtc ?? DEFAULT_TIP_BTC);
    setCheckingWallet(true);
    setCanReceive(null);
    fetchTipReceiveInfo(username)
      .then(info => live && setCanReceive(info.canReceive))
      .catch(() => live && setCanReceive(false))
      .finally(() => live && setCheckingWallet(false));
    return () => {
      live = false;
    };
  }, [active, username, initialAmountBtc, clearWalletState]);

  // Poll while an unpaid invoice is on screen — Lightning settles in seconds,
  // so the payer should see confirmation without refreshing anything.
  const invoiceRef = useRef(invoice);
  invoiceRef.current = invoice;
  useEffect(() => {
    if (!invoice || settleState !== 'pending') {
      return;
    }
    let live = true;
    const id = setInterval(async () => {
      const current = invoiceRef.current;
      if (!current) {
        return;
      }
      try {
        const { status } = await fetchTipStatus(current.intentId, current.statusToken);
        if (!live) {
          return;
        }
        if (status === 'paid') {
          setSettleState('paid');
        } else if (status === 'expired' || status === 'failed') {
          setSettleState('expired');
        }
      } catch {
        // Transient — keep polling; the interval clears on settle or unmount.
      }
    }, TIP_POLL_INTERVAL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [invoice, settleState]);

  const reset = useCallback(() => {
    setInvoice(null);
    setSettleState('pending');
    clearWalletState();
  }, [clearWalletState]);

  const changeAmount = useCallback(
    (next: number) => {
      setAmount(next);
      onAmountChange?.(next);
    },
    [onAmountChange]
  );

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      setInvoice(await fetchTipInvoice(username, amount, requestId));
      setSettleState('pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a payment request.');
    } finally {
      setGenerating(false);
    }
  }, [username, amount, requestId]);

  const payFromWallet = useCallback(async () => {
    setError(null);
    clearWalletState();
    setPaying(true);
    let minted: TipInvoice;
    try {
      minted = await fetchTipInvoice(username, amount, requestId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a payment request.');
      setPaying(false);
      return;
    }
    setInvoice(minted);
    setSettleState('pending');
    try {
      await payIntentFromWallet(minted.intentId, minted.statusToken);
      setPaidFromWallet(true);
      // Ask once now rather than wait out a poll interval.
      const { status } = await fetchTipStatus(minted.intentId, minted.statusToken).catch(() => ({
        status: 'pending',
      }));
      if (status === 'paid') {
        setSettleState('paid');
      }
    } catch (e) {
      if (e instanceof SendError && e.reason === 'payment_unconfirmed') {
        setUnconfirmed(e.message);
      } else {
        setWalletNote(e instanceof Error ? e.message : 'The payment did not go through.');
      }
    } finally {
      setPaying(false);
    }
  }, [username, amount, requestId, clearWalletState]);

  return {
    amount,
    changeAmount,
    checkingWallet,
    canReceive,
    invoice,
    settleState,
    generating,
    error,
    paying,
    paidFromWallet,
    walletNote,
    unconfirmed,
    reset,
    generate,
    payFromWallet,
  };
}
