'use client';

/**
 * Receive — anyone can pay you.
 *
 * The pay link is the standing way. The address code is that same offer, in
 * person, and only when the address can actually be paid. A code for one
 * amount sits below it. Asking a named account is the Request page.
 *
 * Non-custodial: every code pays straight into the owner's wallet.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ReceiveSetup } from '@/components/receive/ReceiveSetup';
import { ReceiveAddress } from '@/components/receive/ReceiveAddress';
import { ReceiveExactAmount } from '@/components/receive/ReceiveExactAmount';
import { SharePayLink } from '@/components/receive/SharePayLink';
import { MoneyLoading, MoneyPage } from '@/components/money/MoneyPage';
import { useRequireAuth } from '@/hooks/useAuth';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import {
  fetchReceiveOverview,
  fetchReceiveWallets,
  createReceiveRequest,
  fetchReceiveStatus,
  type OwnerReceiveOverview,
  type ReceiveWalletOption,
  type ReceiveRequest,
} from '@/services/receive/receive-client';
import { RECEIVE_COPY, RECEIVE_POLL_INTERVAL_MS } from '@/config/receive';
import { DEFAULT_TIP_BTC } from '@/config/tips';

type SettleState = 'pending' | 'paid' | 'expired';

export function ReceiveScreen() {
  const { user, profile, isLoading: authLoading } = useRequireAuth();
  const { copied, copy } = useCopyToClipboard();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OwnerReceiveOverview | null>(null);
  const [wallets, setWallets] = useState<ReceiveWalletOption[]>([]);

  const [amount, setAmount] = useState(DEFAULT_TIP_BTC);
  const [walletId, setWalletId] = useState<string | undefined>(undefined);
  const [request, setRequest] = useState<ReceiveRequest | null>(null);
  const [settleState, setSettleState] = useState<SettleState>('pending');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const [ov, ws] = await Promise.all([
      fetchReceiveOverview(),
      fetchReceiveWallets(user.id).catch(() => []),
    ]);
    setOverview(ov);
    setWallets(ws);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let active = true;
    reload()
      .catch(() => {
        if (active) {
          setOverview(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id, reload]);

  const requestRef = useRef(request);
  requestRef.current = request;
  useEffect(() => {
    if (!request || settleState !== 'pending') {
      return;
    }
    let active = true;
    const id = setInterval(async () => {
      const current = requestRef.current;
      if (!current) {
        return;
      }
      try {
        const { status } = await fetchReceiveStatus(current.intentId, current.statusToken);
        if (!active) {
          return;
        }
        if (status === 'paid') {
          setSettleState('paid');
        } else if (status === 'expired' || status === 'failed') {
          setSettleState('expired');
        }
      } catch {
        // Transient — keep polling; interval clears on settle/reset.
      }
    }, RECEIVE_POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [request, settleState]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      setRequest(await createReceiveRequest(amount, walletId));
      setSettleState('pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a payment request.');
    } finally {
      setGenerating(false);
    }
  }, [amount, walletId]);

  const address = overview?.lightningAddressActive ? overview.lightningAddress : null;

  const handleShare = useCallback(async () => {
    if (!address) {
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Pay me with Bitcoin', text: address });
        return;
      } catch {
        // User cancelled or share failed — fall through to copy.
      }
    }
    void copy(address);
  }, [address, copy]);

  if (authLoading || loading) {
    return <MoneyLoading />;
  }

  if (!overview?.rail) {
    return (
      <ReceiveSetup
        profileId={profile?.id ?? user?.id}
        onConnected={() => {
          void reload().catch(() => setOverview(null));
        }}
      />
    );
  }

  return (
    <MoneyPage title={RECEIVE_COPY.title} subtitle={RECEIVE_COPY.subtitle}>
      <div className="space-y-6">
        {overview.rail === 'onchain' && (
          <p className="text-xs text-fg-tertiary">{RECEIVE_COPY.onchainNote}</p>
        )}
        {overview.arrivesAt ? (
          <p className="text-sm text-fg-secondary">{RECEIVE_COPY.arrivesAt(overview.arrivesAt)}</p>
        ) : (
          overview.rail &&
          overview.rail !== 'onchain' && (
            <p className="text-sm text-fg-secondary">{RECEIVE_COPY.arrivesInApp}</p>
          )
        )}
        {overview.username && <SharePayLink username={overview.username} />}
        {address && (
          <ReceiveAddress
            address={address}
            copied={copied}
            onCopy={() => void copy(address)}
            onShare={() => void handleShare()}
          />
        )}
        <ReceiveExactAmount
          amount={amount}
          onAmount={setAmount}
          wallets={wallets}
          walletId={walletId}
          onWallet={setWalletId}
          generating={generating}
          error={error}
          onGenerate={() => void handleGenerate()}
          request={request}
          settleState={settleState}
          onReset={() => {
            setRequest(null);
            setSettleState('pending');
          }}
        />
      </div>
    </MoneyPage>
  );
}
