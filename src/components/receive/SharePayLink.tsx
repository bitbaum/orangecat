'use client';

/**
 * The remote half of getting paid.
 *
 * A QR is the wrong artifact to put in a chat — the person reading it is on the
 * phone that would have to scan it. This shares a link instead, and the link is
 * alias-backed so it still works tomorrow, unlike an invoice.
 *
 * The link, the copy button and the share sheet all emit the SAME string from
 * buildPayUrl, so what someone pastes and what someone scans can never drift.
 */

import { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Link2, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';
import { buildPayUrl, payLinkOrigin, PAY_COPY } from '@/config/pay';
import { RECEIVE_COPY, RECEIVE_SHARE_COPY } from '@/config/receive';

interface SharePayLinkProps {
  username: string;
  /** The same door, typed into a wallet app. Not a second way to get paid. */
  walletAddress?: string | null;
  /** When set, offers a link that pre-fills this amount for the payer. */
  amountBtc?: number;
  className?: string;
}

export function SharePayLink({ username, walletAddress, amountBtc, className }: SharePayLinkProps) {
  const { copied, copy } = useCopyToClipboard();
  const [includeAmount, setIncludeAmount] = useState(false);

  const origin = payLinkOrigin();
  const url = useMemo(
    () =>
      buildPayUrl(origin, username, {
        amountBtc: includeAmount ? amountBtc : undefined,
      }),
    [origin, username, includeAmount, amountBtc]
  );

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: PAY_COPY.shareTitle, text: PAY_COPY.shareHint, url });
        return;
      } catch {
        // Cancelled or unsupported — fall through to the clipboard.
      }
    }
    void copy(url);
  }, [url, copy]);

  return (
    <section className={cn('rounded-lg border border-subtle bg-surface-raised/40 p-4', className)}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg-primary">
        <Link2 className="h-4 w-4 text-fg-secondary" />
        {RECEIVE_SHARE_COPY.heading}
      </h2>
      <p className="mt-1 text-xs text-fg-tertiary">{RECEIVE_SHARE_COPY.hint}</p>

      <p className="mt-3 break-all rounded-md bg-surface-base px-3 py-2 font-mono text-xs text-fg-secondary">
        {url}
      </p>

      {walletAddress && (
        <p className="mt-3 text-sm text-fg-secondary">
          In a wallet app, <span className="font-mono text-fg-primary">{walletAddress}</span>.{' '}
          {RECEIVE_COPY.addressHint}
        </p>
      )}

      {amountBtc !== undefined && amountBtc > 0 && (
        <label className="mt-3 flex items-center gap-2 text-sm text-fg-secondary">
          <input
            type="checkbox"
            checked={includeAmount}
            onChange={e => setIncludeAmount(e.target.checked)}
            className="h-4 w-4 rounded border-default accent-accent-primary"
          />
          {RECEIVE_SHARE_COPY.withAmount}
        </label>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => void copy(url)}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? RECEIVE_SHARE_COPY.copied : RECEIVE_SHARE_COPY.copy}
        </Button>
        <Button variant="accent" className="w-full sm:w-auto" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          {RECEIVE_SHARE_COPY.share}
        </Button>
      </div>
    </section>
  );
}
