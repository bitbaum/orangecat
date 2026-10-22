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
 * three cannot disagree. The symbol stays black on white in both themes — a
 * camera reads it, not a person (config/payment-qr).
 *
 * No amount here. The code says who you are; the payer types what they owe
 * on the page it opens, or you ask a named person for a figure on Request.
 * "Add an amount" under the code made the owner ask what receiving had to do
 * with choosing a number (2026-10-22), and the link it produced wrapped a raw
 * BTC decimal across two lines.
 */

import { useCallback, useMemo } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { buildPayUrl, payLinkOrigin, PAY_COPY } from '@/config/pay';
import { QR_RENDER } from '@/config/payment-qr';
import { RECEIVE_SHARE_COPY } from '@/config/receive';
import { getInitial } from '@/utils/string';

interface ReceiveCodeProps {
  username: string;
  /** Who the code pays, shown above it. Omit where the page already says. */
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
}

const QR_SIZE = 200;

export function ReceiveCode({ username, name, avatarUrl, className }: ReceiveCodeProps) {
  const { copied, copy } = useCopyToClipboard();

  const origin = payLinkOrigin();
  const url = useMemo(() => buildPayUrl(origin, username), [origin, username]);
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
    </div>
  );
}
