'use client';

/**
 * FoundingSupporterDonation — back OrangeCat in Bitcoin.
 *
 * Shows OrangeCat's OWN receiving addresses (Lightning + on-chain) as QR codes
 * with copy, read from NEXT_PUBLIC_LIGHTNING_ADDRESS / NEXT_PUBLIC_BITCOIN_ADDRESS.
 * This is a DONATION (no spendable balance, no metering) — the honest path while
 * OC has no fiat rails. Static address, so it works with zero NWC infra.
 *
 * When no real address is configured (env still placeholder), it degrades to a
 * graceful "coming soon" state rather than showing a fake address. Bitcoin Orange
 * is used per the Bitcoin-only rule.
 */

import { useState } from 'react';
import { ScanCode } from '@/components/ui/ScanCode';
import { Bitcoin, Zap, Copy, Check, Clock } from 'lucide-react';
import { toast } from 'sonner';

/** A placeholder/unset address shouldn't be presented as real. */
function isConfigured(addr?: string): boolean {
  if (!addr) {
    return false;
  }
  const a = addr.trim();
  return a.length > 0 && !/your-username|bc1q\.\.\.|example\.com|<.+>/i.test(a);
}

/** Strip the bitcoin: URI scheme + query for a readable on-chain address. */
function displayOnchain(raw: string): string {
  return raw
    .replace(/^bitcoin:/i, '')
    .split('?')[0]
    .trim();
}

interface TileProps {
  kind: 'lightning' | 'onchain';
  /** Value encoded in the QR (a wallet-openable URI). */
  qrValue: string;
  /** Value copied + shown to the user. */
  display: string;
  label: string;
  sub: string;
}

function AddressTile({ kind, qrValue, display, label, sub }: TileProps) {
  const [copied, setCopied] = useState(false);
  const Icon = kind === 'lightning' ? Zap : Bitcoin;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      toast.success(`${label} address copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy — select the address manually');
    }
  };

  return (
    <div className="flex flex-col items-center rounded-lg border border-default bg-surface-base p-6">
      <div className="mb-4 flex items-center gap-2 self-start">
        <Icon className="h-5 w-5 text-bitcoinOrange" />
        <div>
          <p className="text-sm font-semibold text-fg-primary">{label}</p>
          <p className="text-xs text-fg-secondary">{sub}</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-default bg-white p-3">
        <ScanCode value={qrValue} size={196} />
      </div>

      <button
        type="button"
        onClick={copy}
        title="Click to copy"
        className="flex w-full items-center justify-center gap-2 rounded-md border border-subtle bg-surface-raised/40 px-3 py-2 text-xs font-mono text-fg-primary hover:bg-surface-raised"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 flex-shrink-0 text-status-positive" />
        ) : (
          <Copy className="h-3.5 w-3.5 flex-shrink-0 text-fg-tertiary" />
        )}
        <span className="truncate">{display}</span>
      </button>
    </div>
  );
}

export function FoundingSupporterDonation() {
  const lightning = process.env.NEXT_PUBLIC_LIGHTNING_ADDRESS;
  const bitcoin = process.env.NEXT_PUBLIC_BITCOIN_ADDRESS;
  const lnOk = isConfigured(lightning);
  const onOk = isConfigured(bitcoin);

  if (!lnOk && !onOk) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-default bg-surface-base p-10 text-center">
        <div className="mb-4 rounded-full bg-surface-raised p-3">
          <Clock className="h-6 w-6 text-bitcoinOrange" />
        </div>
        <h3 className="font-heading text-xl font-bold tracking-display text-fg-primary">
          Founding support opens shortly
        </h3>
        <p className="mt-2 max-w-md text-sm text-fg-secondary">
          We&apos;re finalizing OrangeCat&apos;s receiving wallet. Check back soon to back the
          platform in Bitcoin — or start using Cat with your own key today.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {lnOk && (
        <AddressTile
          kind="lightning"
          qrValue={`lightning:${lightning!.trim()}`}
          display={lightning!.trim()}
          label="Lightning"
          sub="Instant · lowest fees · recommended"
        />
      )}
      {onOk && (
        <AddressTile
          kind="onchain"
          qrValue={
            bitcoin!.trim().startsWith('bitcoin:') ? bitcoin!.trim() : `bitcoin:${bitcoin!.trim()}`
          }
          display={displayOnchain(bitcoin!)}
          label="Bitcoin"
          sub="On-chain · for larger amounts"
        />
      )}
    </div>
  );
}

export default FoundingSupporterDonation;
