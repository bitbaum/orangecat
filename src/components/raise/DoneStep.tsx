'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ExternalLink, Share2 } from 'lucide-react';
import { SellerWalletBanner } from '@/components/payment/SellerWalletBanner';
import { useSellerPaymentMethods } from '@/hooks/useSellerPaymentMethods';
import type { RaiseFlow } from '@/hooks/useRaiseFlow';

/**
 * Step three: it is live — here is the link. Copy, share, or show the QR to
 * someone across the table. If money has nowhere to land yet, say so here,
 * at the moment it matters, with the one tap that fixes it.
 */
export function DoneStep({ flow }: { flow: RaiseFlow }) {
  const published = flow.published!;
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === 'undefined' ? published.url : `${window.location.origin}${published.url}`;
  // A loan settles between people off-platform; the other two land in a wallet.
  const wallet = useSellerPaymentMethods(published.rail === 'lend' ? null : flow.userId);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard refused — the link is visible to select by hand */
    }
  };

  return (
    <div className="mx-auto max-w-xl text-center">
      <div className="oc-raise-done mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-warm text-on-accent">
        <Check className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="mt-6 text-4xl font-semibold tracking-display text-fg-primary">
        {published.live ? 'It’s live.' : 'Saved — one step left.'}
      </h1>
      <p className="mt-3 text-lg text-fg-secondary">
        {published.live
          ? `“${published.title}” is ready to share. Send the link to the people who would want to help.`
          : 'The page is saved as a draft, but going live did not go through. Open it and publish from there.'}
      </p>

      {published.rail !== 'lend' && !wallet.loading && !wallet.hasWallet && (
        <div className="mt-6 text-left">
          <SellerWalletBanner isOwner hasWallet={false} />
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-default bg-surface-base p-5">
        <div className="mx-auto w-fit rounded-2xl bg-white p-3">
          <QRCodeSVG value={url} size={168} />
        </div>
        <p className="mt-4 select-all break-all text-sm text-fg-secondary">{url}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent-warm px-5 text-sm font-medium text-on-accent"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={() => void navigator.share({ title: published.title, url }).catch(() => {})}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-default px-5 text-sm font-medium text-fg-primary hover:bg-surface-raised"
            >
              <Share2 className="h-4 w-4" aria-hidden /> Share
            </button>
          ) : (
            <Link
              href={published.url}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-default px-5 text-sm font-medium text-fg-primary hover:bg-surface-raised"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Open the page
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        {canShare && (
          <Link
            href={published.url}
            className="min-h-11 py-3 text-fg-secondary hover:text-fg-primary"
          >
            Open the page
          </Link>
        )}
        <button
          type="button"
          onClick={flow.startOver}
          className="min-h-11 py-3 text-fg-secondary hover:text-fg-primary"
        >
          Raise for something else
        </button>
      </div>
    </div>
  );
}
