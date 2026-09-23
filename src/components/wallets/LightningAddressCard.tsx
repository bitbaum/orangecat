'use client';

/**
 * Lightning Address Card — the user's `<username>@orangecat.ch` (LUD-16, served
 * by /.well-known/lnurlp/<username>).
 *
 * Truth rules, learned the hard way:
 *  1. Whether the address works is decided by the SERVER's payment resolution,
 *     not by which fields happen to be filled in on a wallet row. This card only
 *     renders what /api/wallets/receive-status reports.
 *  2. Resolution succeeding still only proves we can *reach* a rail. So the card
 *     offers a one-click self-test that mints a real invoice through the exact
 *     public path a payer uses — turning the claim into a verified fact. It only
 *     requests an invoice; no payment is made and the invoice simply expires.
 */

import { useState } from 'react';
import { Zap, Copy, Check, AlertTriangle } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { RECEIVE_COPY } from '@/config/receive';
import type { ReceiveStatus } from '@/app/(authenticated)/dashboard/wallets/hooks/useReceiveStatus';

interface LightningAddressCardProps {
  status: ReceiveStatus | null;
  isLoading: boolean;
}

type TestResult = { ok: true } | { ok: false; reason: string } | null;

const TEST_AMOUNT_MSAT = 1000; // 1 sat — the minimum a payer could send.

export function LightningAddressCard({ status, isLoading }: LightningAddressCardProps) {
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  if (isLoading) {
    return (
      <div className="bg-surface-base rounded-lg border border-default p-4 sm:p-6">
        <div className="h-5 w-48 animate-pulse rounded bg-surface-raised" />
        <div className="mt-3 h-9 w-72 max-w-full animate-pulse rounded bg-surface-raised" />
      </div>
    );
  }

  // No status (request failed) or no username yet: claim nothing at all.
  if (!status?.lightningAddress) {
    return null;
  }

  const { lightningAddress, lightningAddressActive, rail, unusableConnectionWalletIds } = status;
  const hasUnusableConnection = unusableConnectionWalletIds.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(lightningAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permissions / insecure context) — nothing to do.
    }
  };

  /** Mint a real invoice through the public LNURL callback — no payment occurs. */
  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `${API_ROUTES.LNURLP.CALLBACK(status.username ?? '')}?amount=${TEST_AMOUNT_MSAT}`
      );
      const body = (await res.json()) as { pr?: string; status?: string; reason?: string };
      setTestResult(
        body.pr
          ? { ok: true }
          : { ok: false, reason: body.reason || 'Your wallet did not return an invoice.' }
      );
    } catch {
      setTestResult({ ok: false, reason: 'Could not reach your wallet just now.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-surface-base rounded-lg border border-default p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-surface-raised p-2">
          <Zap
            className={
              lightningAddressActive ? 'h-5 w-5 text-bitcoinOrange' : 'h-5 w-5 text-fg-secondary'
            }
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-fg-primary">Your Lightning address</h3>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code
              className={`truncate rounded bg-surface-raised px-2 py-1 font-mono text-sm ${
                lightningAddressActive ? 'text-fg-primary' : 'text-fg-secondary line-through'
              }`}
            >
              {lightningAddress}
            </code>
            {lightningAddressActive && (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label={copied ? 'Copied' : 'Copy Lightning address'}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-md border border-default text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-status-positive" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="flex min-h-11 items-center rounded-md border border-default px-3 text-sm text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary disabled:opacity-60"
                >
                  {testing ? 'Testing…' : 'Test it'}
                </button>
              </>
            )}
          </div>

          {lightningAddressActive ? (
            <p className="mt-2 text-xs text-fg-secondary">
              {status.arrivesAt
                ? RECEIVE_COPY.arrivesAt(status.arrivesAt)
                : RECEIVE_COPY.arrivesInApp}
            </p>
          ) : (
            <p className="mt-2 text-sm text-fg-secondary">
              {rail === 'onchain'
                ? 'Not active yet. Your active wallet only has an on-chain Bitcoin address, which can’t answer Lightning payments. Add a Lightning address or connect a Lightning wallet below to switch it on.'
                : 'Not active yet. Add a wallet below that can receive Lightning — a Lightning address or a wallet connection — and this address starts working.'}
            </p>
          )}

          {/* Verified fact, not a claim: the result of a real invoice request. */}
          {testResult?.ok === true && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-status-positive">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Verified just now — your wallet issued a real invoice. Nothing was paid.
            </p>
          )}
          {testResult?.ok === false && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-status-negative">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>Test failed: {testResult.reason}</span>
            </p>
          )}

          {hasUnusableConnection && (
            <p className="mt-3 flex items-start gap-1.5 rounded-md bg-surface-raised p-2 text-xs text-status-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              <span>
                A connected wallet below can’t be used by this deployment, so payments skip it.
                Reconnect it to use Lightning.
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
