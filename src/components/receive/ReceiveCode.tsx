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
import brandAssets from '@/config/brand-assets.json';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { buildPayUrl, payLinkOrigin, PAY_COPY } from '@/config/pay';
import { QR_RENDER } from '@/config/payment-qr';
import { RECEIVE_SHARE_COPY } from '@/config/receive';
import { getInitial } from '@/utils/string';
import { cn } from '@/lib/utils';

interface ReceiveCodeProps {
  username: string;
  /** Who the code pays, shown above it. Omit where the page already says. */
  name?: string | null;
  avatarUrl?: string | null;
  className?: string;
}

const QR_SIZE = 248;
/** The Cat's tile, a fifth of the code's width. Centred modules are the ones error correction can best spare. */
const QR_MARK_SIZE = Math.round(QR_SIZE * 0.2);

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
    <div className={cn('flex flex-col items-center text-center', className)}>
      <h2 className="sr-only">{RECEIVE_SHARE_COPY.heading}</h2>

      {/*
        No box around the whole thing: a card around a card around a code is
        three borders competing for one object. The person and the code sit on
        the page itself; the code is the only thing with a surface.
      */}
      {name && (
        <div className="flex flex-col items-center">
          <Avatar className="h-12 w-12">
            {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
            <AvatarFallback className="text-lg font-semibold text-fg-secondary">
              {getInitial(name)}
            </AvatarFallback>
          </Avatar>
          <p className="mb-0 mt-3 font-heading text-xl font-semibold leading-tight tracking-display text-fg-primary">
            {name}
          </p>
          <p className="mb-0 text-sm text-fg-secondary">@{username}</p>
        </div>
      )}

      {/* The Cat sits in the middle of the code: the symbol is recognisably ours
          before it is read, and it costs the scanner ~4% of the modules. */}
      <div className={cn('overflow-hidden rounded-2xl border border-subtle', name && 'mt-6')}>
        <QRCodeSVG
          value={url}
          size={QR_SIZE}
          level={QR_RENDER.level}
          includeMargin
          bgColor={QR_RENDER.bgColor}
          fgColor={QR_RENDER.fgColor}
          title={RECEIVE_SHARE_COPY.qrTitle(who)}
          imageSettings={{
            src: brandAssets.favicon,
            width: QR_MARK_SIZE,
            height: QR_MARK_SIZE,
            excavate: true,
          }}
        />
      </div>

      <p className="mb-0 mt-4 break-all font-mono text-sm text-fg-secondary">{shown}</p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2">
        <Button variant="primary" onClick={() => void copy(url)}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? RECEIVE_SHARE_COPY.copied : RECEIVE_SHARE_COPY.copy}
        </Button>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          {RECEIVE_SHARE_COPY.share}
        </Button>
      </div>
    </div>
  );
}
