'use client';

/**
 * The host's one job after setting an event up: get the link into the group
 * chat. On a phone that is the share sheet (WhatsApp, Signal, Telegram…); on a
 * computer, the clipboard. One button either way.
 */

import { Check, Share2 } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface InviteLinkButtonProps {
  url: string;
  title: string;
}

export default function InviteLinkButton({ url, title }: InviteLinkButtonProps) {
  const { copied, copy } = useCopyToClipboard();

  const send = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Closing the sheet is a choice, not a failure — and not a reason to copy.
        if ((error as Error)?.name === 'AbortError') {
          return;
        }
      }
    }
    await copy(url);
  };

  return (
    <button
      type="button"
      onClick={send}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-fg-primary px-4 text-sm font-semibold text-fg-inverted transition-colors hover:bg-fg-primary/90"
    >
      {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {copied ? 'Link copied — paste it in your group chat' : 'Send the invite link'}
    </button>
  );
}
