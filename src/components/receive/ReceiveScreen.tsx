'use client';

/**
 * ReceiveScreen — the owner-side "get paid" surface (/receive).
 *
 * One tap from the sidebar to a scannable QR. Two modes:
 *  - "My address": static QR of <username>@orangecat.ch — never expires, any
 *    wallet, payer picks the amount. Rendered only when the server's payment
 *    resolution says the address actually works (never claim a dead rail).
 *  - "Request amount": exact-amount invoice / fresh on-chain address with live
 *    settlement feedback, optionally from a specific wallet.
 *
 * Non-custodial: every QR pays straight into the owner's wallet.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, Copy, Check, Loader2, Share2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ReceiveSetup } from '@/components/receive/ReceiveSetup';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PageHeading } from '@/components/layout/PageHeading';
import { PaymentQRCode } from '@/components/payment/PaymentQRCode';
import { SharePayLink } from '@/components/receive/SharePayLink';
import { MoneyTabs } from '@/components/money/MoneyTabs';
import { MoneyReceipt } from '@/components/money/MoneyReceipt';
import { AmountField } from '@/components/money/AmountField';
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
import {
  RECEIVE_COPY,
  RECEIVE_MIN_BTC,
  RECEIVE_MAX_BTC,
  RECEIVE_POLL_INTERVAL_MS,
} from '@/config/receive';
import { QR_RENDER } from '@/config/payment-qr';
import { DEFAULT_TIP_BTC } from '@/config/tips';
type Tab = 'address' | 'request';
type SettleState = 'pending' | 'paid' | 'expired';

export function ReceiveScreen() {
  const { user, profile, isLoading: authLoading } = useRequireAuth();
  const { copied, copy } = useCopyToClipboard();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OwnerReceiveOverview | null>(null);
  const [wallets, setWallets] = useState<ReceiveWalletOption[]>([]);
  const [tab, setTab] = useState<Tab>('address');

  const [amount, setAmount] = useState(DEFAULT_TIP_BTC);
  const [walletId, setWalletId] = useState<string | undefined>(undefined);
  const [request, setRequest] = useState<ReceiveRequest | null>(null);
  const [settleState, setSettleState] = useState<SettleState>('pending');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    let active = true;
    Promise.all([fetchReceiveOverview(), fetchReceiveWallets(user.id).catch(() => [])])
      .then(([ov, ws]) => {
        if (!active) {
          return;
        }
        setOverview(ov);
        setWallets(ws);
        if (!ov.lightningAddressActive) {
          setTab('request');
        }
      })
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
  }, [user?.id]);

  // Live settlement polling while an unpaid request is showing.
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

  const address = overview?.lightningAddress ?? null;

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
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-fg-tertiary" />
      </div>
    );
  }

  const canReceive = !!overview?.rail;
  if (!canReceive) {
    return (
      <ReceiveSetup
        profileId={profile?.id ?? user?.id}
        onConnected={() => {
          if (!user?.id) {
            return;
          }
          void Promise.all([fetchReceiveOverview(), fetchReceiveWallets(user.id).catch(() => [])])
            .then(([ov, ws]) => {
              setOverview(ov);
              setWallets(ws);
              if (!ov.lightningAddressActive) {
                setTab('request');
              }
            })
            .catch(() => {
              setOverview(null);
            });
        }}
      />
    );
  }

  const showAddressTab = !!overview?.lightningAddressActive && !!address;
  const activeTab: Tab = showAddressTab ? tab : 'request';

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <PageHeading>{RECEIVE_COPY.title}</PageHeading>
      <p className="mt-1 text-sm text-fg-secondary">{RECEIVE_COPY.subtitle}</p>
      {overview?.rail === 'onchain' && (
        <p className="mt-2 text-xs text-fg-tertiary">{RECEIVE_COPY.onchainNote}</p>
      )}

      <MoneyTabs className="mt-5" />

      {showAddressTab && (
        <SegmentedControl
          className="mt-3"
          label="Receive method"
          value={activeTab}
          onChange={setTab}
          items={[
            { value: 'address', label: RECEIVE_COPY.addressTab },
            { value: 'request', label: RECEIVE_COPY.requestTab },
          ]}
        />
      )}

      {activeTab === 'address' && address ? (
        <div className="mt-6 flex flex-col items-center gap-4">
          <div className="rounded-lg bg-surface-base p-4 shadow-sm">
            <QRCodeSVG
              value={`lightning:${address}`}
              size={QR_RENDER.defaultSize}
              level={QR_RENDER.level}
              includeMargin
              bgColor={QR_RENDER.bgColor}
              fgColor={QR_RENDER.fgColor}
            />
          </div>
          <p className="flex items-center gap-2 font-mono text-sm text-fg-primary">
            <Zap className="h-4 w-4 text-bitcoinOrange" />
            {address}
          </p>
          <p className="text-center text-xs text-fg-tertiary">{RECEIVE_COPY.addressHint}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => void copy(address)}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? RECEIVE_COPY.copied : RECEIVE_COPY.copy}
            </Button>
            <Button variant="accent" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              {RECEIVE_COPY.share}
            </Button>
          </div>
          {/* The QR above serves the person standing in front of you; this
              serves everyone else. Different artifact for a different job. */}
          {overview?.username && <SharePayLink username={overview.username} className="w-full" />}
        </div>
      ) : request && settleState === 'paid' ? (
        <MoneyReceipt
          title={RECEIVE_COPY.paidTitle}
          amountBtc={request.amountBtc}
          counterpartyLabel="Via"
          counterparty={request.methodLabel}
          fallbackBody={RECEIVE_COPY.paidBody}
        >
          <Button
            variant="accent"
            onClick={() => {
              setRequest(null);
              setSettleState('pending');
            }}
          >
            {RECEIVE_COPY.again}
          </Button>
        </MoneyReceipt>
      ) : request && settleState === 'expired' ? (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <Clock className="h-12 w-12 text-fg-tertiary" />
          <p className="text-lg font-semibold text-fg-primary">{RECEIVE_COPY.expiredTitle}</p>
          <p className="text-sm text-fg-secondary">{RECEIVE_COPY.expiredBody}</p>
          <Button
            variant="outline"
            className="mt-2"
            onClick={() => {
              setRequest(null);
              setSettleState('pending');
            }}
          >
            {RECEIVE_COPY.again}
          </Button>
        </div>
      ) : request ? (
        <div className="mt-6 space-y-4">
          <PaymentQRCode
            qrData={request.qrData}
            methodLabel={request.methodLabel}
            amountBtc={request.amountBtc}
            expiresInSeconds={request.expiresInSeconds ?? undefined}
          />
          <p className="flex items-center justify-center gap-2 text-center text-sm text-fg-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {RECEIVE_COPY.scan}
          </p>
          {request.paymentMethod === 'onchain' && (
            <p className="text-center text-xs text-fg-tertiary">{RECEIVE_COPY.onchainNote}</p>
          )}
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setRequest(null);
                setSettleState('pending');
              }}
            >
              {RECEIVE_COPY.again}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <AmountField
            value={amount}
            onChange={setAmount}
            minBtc={RECEIVE_MIN_BTC}
            maxBtc={RECEIVE_MAX_BTC}
          />
          {wallets.length > 1 && (
            <div>
              <p className="mb-2 text-sm font-medium text-fg-secondary">
                {RECEIVE_COPY.walletLabel}
              </p>
              {/* "Primary" is the same kind of choice as any named wallet, so
                  it is one more option in the same list rather than a
                  hand-written twin of the button beside it. */}
              <div className="flex flex-wrap gap-2">
                {[{ id: undefined, label: RECEIVE_COPY.primaryWallet }, ...wallets].map(w => (
                  <button
                    key={w.id ?? 'primary'}
                    type="button"
                    aria-pressed={walletId === w.id}
                    onClick={() => setWalletId(w.id)}
                    className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
                      walletId === w.id
                        ? 'border-accent-primary bg-accent-primary/10 text-fg-primary'
                        : 'border-default text-fg-secondary hover:text-fg-primary'
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {error && <p className="text-sm text-status-negative">{error}</p>}
          <p className="text-center text-xs text-fg-tertiary">{RECEIVE_COPY.requestHint}</p>
          <Button
            variant="accent"
            className="w-full"
            onClick={handleGenerate}
            disabled={generating || amount <= 0}
            isLoading={generating}
          >
            {generating ? RECEIVE_COPY.generating : RECEIVE_COPY.generate}
          </Button>
          {/* Not everyone you're asking is in the room. Same amount, sendable. */}
          {overview?.username && <SharePayLink username={overview.username} amountBtc={amount} />}
        </div>
      )}
    </div>
  );
}
