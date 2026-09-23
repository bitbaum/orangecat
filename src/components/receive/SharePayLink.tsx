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
import { Check, Copy, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';
import { buildPayUrl, payLinkOrigin, PAY_COPY } from '@/config/pay';
import { RECEIVE_COPY, RECEIVE_SHARE_COPY, walletAppUrl } from '@/config/receive';

interface SharePayLinkProps {
  username: string;
  /** The same door, typed into a wallet app. Not a second way to get paid. */
  walletAddress?: string | null;
  /** The wallet the coins actually settle in, named for the owner. */
  arrivesAt?: string | null;
  /** When set, offers a link that pre-fills this amount for the payer. */
  amountBtc?: number;
  className?: string;
}

export function SharePayLink({
  username,
  walletAddress,
  arrivesAt,
  amountBtc,
  className,
}: SharePayLinkProps) {
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

  const home = arrivesAt ? walletAppUrl(arrivesAt) : null;

  return (
    <section
      className={cn('overflow-hidden rounded-lg border border-subtle bg-surface-raised', className)}
    >
      <div className="px-5 pb-6 pt-7 text-center">
        <h2 className="sr-only">{RECEIVE_SHARE_COPY.heading}</h2>
        <p className="break-all font-mono text-lg leading-snug text-fg-primary">{url}</p>
      </div>

      <div className="space-y-2 border-t border-subtle p-4">
        {amountBtc !== undefined && amountBtc > 0 && (
          <label className="flex min-h-11 items-center gap-2 text-sm text-fg-secondary">
            <input
              type="checkbox"
              checked={includeAmount}
              onChange={e => setIncludeAmount(e.target.checked)}
              className="h-4 w-4 rounded border-default accent-accent-primary"
            />
            {RECEIVE_SHARE_COPY.withAmount}
          </label>
        )}
        <Button variant="accent" className="w-full" onClick={() => void copy(url)}>
          {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
          {copied ? RECEIVE_SHARE_COPY.copied : RECEIVE_SHARE_COPY.copy}
        </Button>
        <Button variant="outline" className="w-full" onClick={handleShare}>
          <Share2 className="mr-2 h-4 w-4" />
          {RECEIVE_SHARE_COPY.share}
        </Button>
      </div>

      {(walletAddress || arrivesAt) && (
        <details className="border-t border-subtle">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center text-sm text-fg-secondary [&::-webkit-details-marker]:hidden">
            Where this goes
          </summary>
          <div className="space-y-3 px-5 pb-5 text-center text-sm leading-relaxed text-fg-secondary">
            {walletAddress && (
              <p>
                <span className="font-mono text-fg-primary">{walletAddress}</span>
                <span className="mt-1 block text-fg-tertiary">{RECEIVE_COPY.addressHint}</span>
              </p>
            )}
            {arrivesAt && (
              <p>
                The money arrives at{' '}
                {home ? (
                  <a
                    href={home}
                    className="font-medium text-fg-primary underline"
                    rel="noopener noreferrer"
                  >
                    {arrivesAt}
                  </a>
                ) : (
                  <span className="font-medium text-fg-primary">{arrivesAt}</span>
                )}
                . Open that wallet to see the balance.
              </p>
            )}
          </div>
        </details>
      )}
    </section>
  );
}
