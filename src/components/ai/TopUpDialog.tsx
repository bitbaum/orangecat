'use client';

/**
 * TopUpDialog — buy Cat Credits over Lightning.
 *
 * Pick an amount → POST issues a platform invoice → show the bolt11 as a QR +
 * copy → poll settlement → on payment, credit lands and the panel refreshes.
 *
 * Amounts lead with BTC, the canonical unit, and carry the user's display
 * currency as an approximation. Leading with fiat (as this did) meant the three
 * presets read "CHF 5.23 / 26.15 / 52.31" — values nobody would choose, which
 * silently changed every day with the exchange rate. The amount actually being
 * invoiced is the BTC one, so that is the number shown.
 *
 * Can also RESUME an invoice issued earlier (`initialInvoice`): a top-up whose
 * dialog was closed is still payable until it expires, and settlement no longer
 * depends on this component being mounted (services/cat/topup-reconcile).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanCode } from '@/components/ui/ScanCode';
import { Loader2, Copy, Check, X, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { displayBTC } from '@/services/currency';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';

/** Preset top-up amounts in BTC. */
import { TOPUP_PRESETS_BTC as PRESETS_BTC } from '@/config/cat-plans';
const POLL_MS = 3000;

export interface TopUpInvoiceView {
  topupId: string;
  bolt11: string;
  amountBtc: number;
  expiresAt: string;
}

interface TopUpDialogProps {
  onClose: () => void;
  onSuccess: () => void;
  /** Resume an invoice issued earlier instead of asking for an amount. */
  initialInvoice?: TopUpInvoiceView | null;
}

/** mm:ss left, or null once the window has passed. */
function timeLeft(expiresAt: string): string | null {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!isFinite(ms) || ms <= 0) {
    return null;
  }
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function TopUpDialog({ onClose, onSuccess, initialInvoice }: TopUpDialogProps) {
  const { formatAmountBtc, prefersFiat } = useDisplayCurrency();
  const [invoice, setInvoice] = useState<TopUpInvoiceView | null>(initialInvoice ?? null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /**
   * BTC leads; fiat is the approximation. A user who prefers BTC/SATS as their
   * display currency would otherwise see the same number twice.
   */
  const fiatHint = useCallback(
    (btc: number): string | null => (prefersFiat ? `≈ ${formatAmountBtc(btc)}` : null),
    [prefersFiat, formatAmountBtc]
  );

  const create = useCallback(async (amountBtc: number) => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.CAT.CREDITS_TOPUP, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountBtc }),
      });
      const json = await res.json();
      if (!res.ok || !json?.data?.bolt11) {
        throw new Error(json?.error?.message || 'Could not create invoice');
      }
      setInvoice({
        topupId: json.data.topupId,
        bolt11: json.data.bolt11,
        amountBtc: json.data.amountBtc,
        expiresAt: json.data.expiresAt,
      });
    } catch (err) {
      logger.error('Top-up create failed', err, 'CatCredits');
      setError(err instanceof Error ? err.message : 'Could not create invoice');
    } finally {
      setCreating(false);
    }
  }, []);

  // Poll settlement once an invoice exists.
  useEffect(() => {
    if (!invoice) {
      return;
    }
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${API_ROUTES.CAT.CREDITS_TOPUP}?id=${encodeURIComponent(invoice.topupId)}`
        );
        const json = await res.json();
        const status = json?.data?.status;
        if (status === 'paid') {
          stopPolling();
          toast.success('Credits added — thanks!');
          onSuccess();
        } else if (status === 'expired') {
          stopPolling();
          setExpired(true);
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);
    return stopPolling;
  }, [invoice, onSuccess, stopPolling]);

  // Count the window down. "Waiting for payment…" with no deadline gave no clue
  // that the invoice dies in an hour.
  useEffect(() => {
    if (!invoice || expired) {
      return;
    }
    setRemaining(timeLeft(invoice.expiresAt));
    const tick = setInterval(() => setRemaining(timeLeft(invoice.expiresAt)), 1000);
    return () => clearInterval(tick);
  }, [invoice, expired]);

  const copy = async () => {
    if (!invoice) {
      return;
    }
    try {
      await navigator.clipboard.writeText(invoice.bolt11);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — user can select manually
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-default bg-surface-base p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fg-primary">Top up Cat Credits</h3>
          <button
            type="button"
            onClick={() => {
              stopPolling();
              onClose();
            }}
            aria-label="Close"
            className="rounded p-1 text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!invoice ? (
          <>
            <p className="mb-3 text-sm text-fg-secondary">
              Choose an amount to add. You&apos;ll pay a Lightning invoice from any wallet.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PRESETS_BTC.map(amt => (
                <button
                  key={amt}
                  type="button"
                  disabled={creating}
                  onClick={() => create(amt)}
                  className="flex flex-col items-center gap-0.5 rounded-md border border-subtle bg-surface-raised/30 px-3 py-3 text-sm font-medium text-fg-primary hover:border-strong hover:bg-surface-raised disabled:opacity-50"
                >
                  <span>{displayBTC(amt)}</span>
                  {fiatHint(amt) && (
                    <span className="text-xs font-normal text-fg-tertiary">{fiatHint(amt)}</span>
                  )}
                </button>
              ))}
            </div>
            {creating && (
              <div className="mt-3 flex items-center gap-2 text-sm text-fg-secondary">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating invoice…
              </div>
            )}
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-status-negative">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
          </>
        ) : expired ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 text-status-warning" />
            <p className="text-sm text-fg-secondary">
              This invoice expired before payment. Start a new top-up.
            </p>
            <Button
              onClick={() => {
                setInvoice(null);
                setExpired(false);
              }}
            >
              New invoice
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-fg-secondary">
              Pay{' '}
              <span className="font-medium text-fg-primary">{displayBTC(invoice.amountBtc)}</span>
              {fiatHint(invoice.amountBtc) && (
                <span className="text-fg-tertiary"> ({fiatHint(invoice.amountBtc)})</span>
              )}{' '}
              with any Lightning wallet:
            </p>
            <div className="rounded-md bg-white p-3">
              {/*
                The `LIGHTNING:` scheme is what makes a phone camera or a desktop
                wallet handler offer to pay this. A bare bolt11 (what was here)
                scans as meaningless text unless the user is already inside a
                wallet app. Uppercase keeps the QR in bech32 alphanumeric mode,
                and `:` is in that charset, so the prefix costs no density.
              */}
              <ScanCode value={`LIGHTNING:${invoice.bolt11.toUpperCase()}`} size={200} />
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`lightning:${invoice.bolt11}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-subtle px-3 py-1.5 text-sm text-fg-secondary hover:bg-surface-raised"
              >
                <ExternalLink className="h-4 w-4" />
                Open in wallet
              </a>
              <button
                type="button"
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-md border border-subtle px-3 py-1.5 text-sm text-fg-secondary hover:bg-surface-raised"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-status-positive" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? 'Copied' : 'Copy invoice'}
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-fg-tertiary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {remaining ? `Waiting for payment — ${remaining} left` : 'Waiting for payment…'}
            </div>
            <p className="flex items-center gap-1 text-center text-xs text-fg-tertiary">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              Credits land automatically once paid — you can close this.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default TopUpDialog;
