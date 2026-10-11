/**
 * OwnerCollectPanel — owner-facing "Collect Bitcoin" view on an entity page.
 *
 * Shown when the logged-in user owns the entity AND has a wallet connected.
 * Confirms which address the entity collects to (resolved server-side via the
 * same path buyers pay through), the price, and a share link + QR so the owner
 * can get paid. The "connect a wallet" prompt is handled upstream when no
 * wallet is set.
 */

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, QrCode, Wallet, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import type { EntityType } from '@/config/entity-registry';

interface OwnerCollectPanelProps {
  entityType: EntityType;
  entityId: string;
  entityTitle: string;
  /** Price amount in the entity's own currency (for fixed_price entities) */
  priceAmount?: number;
  /** Currency the price is denominated in (e.g. 'CHF'); 'BTC'/omitted → BTC */
  priceCurrency?: string;
}

interface ReceiveInfo {
  hasWallet: boolean;
  method: 'nwc' | 'lightning_address' | 'onchain' | null;
  address: string | null;
}

interface RecipientConfirmation {
  id: string;
  amount_btc: number;
  description: string | null;
  created_at: string;
}

const METHOD_LABELS: Record<string, string> = {
  nwc: 'Connected Lightning wallet',
  lightning_address: 'Lightning address',
  onchain: 'On-chain Bitcoin address',
};

function truncateMiddle(value: string, head = 10, tail = 8): string {
  return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function OwnerCollectPanel({
  entityType,
  entityId,
  priceAmount,
  priceCurrency,
}: OwnerCollectPanelProps) {
  const { formatPrice, formatAmountBtc } = useDisplayCurrency();
  const { copied: linkCopied, copy: copyLink } = useCopyToClipboard();
  const { copied: addrCopied, copy: copyAddr } = useCopyToClipboard();
  const [shareUrl, setShareUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [info, setInfo] = useState<ReceiveInfo | null>(null);
  const [infoFailed, setInfoFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmations, setConfirmations] = useState<RecipientConfirmation[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // The owner is on the entity's public page — that URL is the share link.
  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `${API_ROUTES.PAYMENTS.RECEIVE_INFO}?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`
    )
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (!cancelled) {
          setInfo((body?.data as ReceiveInfo) ?? null);
          setInfoFailed(body === null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInfo(null);
          setInfoFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  useEffect(() => {
    fetch(
      `${API_ROUTES.PAYMENTS.RECIPIENT_CONFIRMATIONS}?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`
    )
      .then(res => (res.ok ? res.json() : null))
      .then(body => setConfirmations((body?.data as RecipientConfirmation[]) ?? []))
      .catch(() => setConfirmations([]));
  }, [entityType, entityId]);

  const confirmReceipt = async (id: string) => {
    setConfirmingId(id);
    const response = await fetch(API_ROUTES.PAYMENTS.BY_ID(id), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'seller_confirm' }),
    });
    if (response.ok) {
      setConfirmations(current => current.filter(item => item.id !== id));
    } else {
      // It used to fail without a word: the row stayed and nothing said why.
      toast.error('Couldn’t record that payment as received. Try again.');
    }
    setConfirmingId(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Wallet className="h-5 w-5 text-bitcoinOrange" />
          Collect Bitcoin
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {priceAmount && priceAmount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-fg-secondary">Price</span>
            <span className="text-lg font-bold text-fg-primary">
              {formatPrice(priceAmount, priceCurrency)}
            </span>
          </div>
        )}

        <div className="space-y-1">
          <span className="text-sm text-fg-secondary">Receiving to</span>
          {loading ? (
            <div className="flex items-center gap-2 text-fg-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Resolving…</span>
            </div>
          ) : info?.address ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-default bg-surface-raised/40 px-3 py-2">
              <span className="min-w-0 truncate font-mono text-sm text-fg-primary">
                {truncateMiddle(info.address)}
              </span>
              <button
                type="button"
                onClick={() => copyAddr(info.address!)}
                className="shrink-0 text-fg-secondary hover:text-fg-primary"
                aria-label="Copy receiving address"
              >
                {addrCopied ? (
                  <Check className="h-4 w-4 text-status-positive" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : (
            <p className="text-sm font-medium text-fg-primary">
              {info?.method
                ? METHOD_LABELS[info.method]
                : infoFailed
                  ? 'Couldn’t check your receiving wallet — reload to try again.'
                  : 'Connected wallet'}
            </p>
          )}
        </div>

        {/* Share link to get paid */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 min-h-11 gap-2"
              onClick={() => shareUrl && copyLink(shareUrl)}
            >
              {linkCopied ? (
                <Check className="h-4 w-4 text-status-positive" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {linkCopied ? 'Copied' : 'Copy link'}
            </Button>
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              onClick={() => setShowQr(v => !v)}
              aria-expanded={showQr}
            >
              <QrCode className="h-4 w-4" />
              QR
            </Button>
          </div>
          {showQr && shareUrl && (
            <div className="flex justify-center rounded-lg border border-default bg-surface-base p-4">
              <QRCodeSVG value={shareUrl} size={192} />
            </div>
          )}
          <p className="text-xs text-fg-secondary">
            Share this link so others can pay you in Bitcoin.
          </p>
        </div>

        <Button variant="ghost" size="sm" href={ROUTES.DASHBOARD.WALLETS} className="w-full">
          Manage wallets
        </Button>

        {confirmations.length > 0 && (
          <div className="border-t border-default pt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-status-warning" aria-hidden />
              <h3 className="text-sm font-medium text-fg-primary">Confirm received payments</h3>
            </div>
            <p className="mt-1 text-xs text-fg-secondary">
              These Lightning Address payments could not be verified automatically. Check your
              wallet before confirming.
            </p>
            <ul className="mt-3 space-y-2">
              {confirmations.map(item => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-default p-3"
                >
                  <span className="font-mono text-sm text-fg-primary">
                    {formatAmountBtc(Number(item.amount_btc))}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={confirmingId === item.id}
                    onClick={() => confirmReceipt(item.id)}
                  >
                    Received
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
