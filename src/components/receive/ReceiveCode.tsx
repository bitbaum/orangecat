'use client';

/**
 * The code you show, and the link you send — one artifact, two forms.
 *
 * The bottom bar's Receive slot is a QR icon, so the screen it opens shows a
 * QR. It encodes the pay link, not an invoice: any phone camera opens a link,
 * only a Lightning wallet opens an invoice, and the link is still valid
 * tomorrow. The pay page on the far side offers every way this person is paid.
 *
 * The QR, Copy and Share all render the SAME string from buildPayUrl, so the
 * three cannot disagree about the amount. The symbol stays black on white in
 * both themes — a camera reads it, not a person (config/payment-qr).
 */

import { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { AmountField } from '@/components/money/AmountField';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { buildPayUrl, payLinkOrigin, PAY_COPY, PAY_MAX_BTC, PAY_MIN_BTC } from '@/config/pay';
import { QR_RENDER } from '@/config/payment-qr';
import { RECEIVE_SHARE_COPY } from '@/config/receive';
import { getInitial } from '@/utils/string';
import { cn } from '@/lib/utils';

interface ReceiveCodeProps {
  username: string;
  /** Who the code pays, shown above it. Omit where the page already says. */
  name?: string | null;
  avatarUrl?: string | null;
  /** Offer "Add an amount"; the link and the code then carry it. */
  withAmount?: boolean;
  className?: string;
}

const QR_SIZE = 200;

export function ReceiveCode({
  username,
  name,
  avatarUrl,
  withAmount,
  className,
}: ReceiveCodeProps) {
  const { copied, copy } = useCopyToClipboard();
  const { formatAmountBtc } = useDisplayCurrency();
  const [amountOpen, setAmountOpen] = useState(false);
  const [amountBtc, setAmountBtc] = useState(0);

  const origin = payLinkOrigin();
  const url = useMemo(
    () => buildPayUrl(origin, username, { amountBtc: amountOpen ? amountBtc : undefined }),
    [origin, username, amountOpen, amountBtc]
  );
  const shown = url.replace(/^https?:\/\//, '');
  const who = name || username;

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
    <div className={className}>
      <section className="overflow-hidden rounded-lg border border-subtle bg-surface-base">
        <div className="flex flex-col items-center gap-4 px-5 pb-5 pt-6 text-center">
          <h2 className="sr-only">{RECEIVE_SHARE_COPY.heading}</h2>
          {name && (
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-14 w-14">
                {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
                <AvatarFallback className="text-lg font-semibold text-fg-secondary">
                  {getInitial(name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-heading text-lg font-semibold tracking-display text-fg-primary">
                  {name}
                </p>
                <p className="text-sm text-fg-secondary">@{username}</p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-subtle">
            <QRCodeSVG
              value={url}
              size={QR_SIZE}
              level={QR_RENDER.level}
              includeMargin
              bgColor={QR_RENDER.bgColor}
              fgColor={QR_RENDER.fgColor}
              title={RECEIVE_SHARE_COPY.qrTitle(who)}
            />
          </div>

          {amountOpen && amountBtc > 0 && (
            <p className="text-sm text-fg-secondary">
              {RECEIVE_SHARE_COPY.amountFor}{' '}
              <span className="font-medium text-fg-primary">{formatAmountBtc(amountBtc)}</span>
            </p>
          )}

          <p className="break-all font-mono text-sm text-fg-secondary">{shown}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-subtle p-4">
          <Button variant="primary" onClick={() => void copy(url)}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? RECEIVE_SHARE_COPY.copied : RECEIVE_SHARE_COPY.copy}
          </Button>
          <Button variant="outline" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
            {RECEIVE_SHARE_COPY.share}
          </Button>
        </div>
      </section>

      {withAmount && (
        <div className="mt-4">
          {amountOpen ? (
            <div className="space-y-3">
              <AmountField
                value={amountBtc}
                onChange={setAmountBtc}
                minBtc={PAY_MIN_BTC}
                maxBtc={PAY_MAX_BTC}
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setAmountOpen(false);
                  setAmountBtc(0);
                }}
                className={cn(
                  'flex min-h-11 w-full items-center justify-center text-sm text-fg-secondary hover:text-fg-primary'
                )}
              >
                {RECEIVE_SHARE_COPY.removeAmount}
              </button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setAmountOpen(true)}>
              {RECEIVE_SHARE_COPY.addAmount}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
