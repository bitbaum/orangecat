'use client';

/**
 * Handing one identity over (ADR-0014 D9), under its row in Settings.
 *
 * Three states, one at a time: nothing open (say what it does, offer to make
 * the link), a link just made (shown once, with Copy), a link already open
 * from before (it cannot be shown again, so the only act is to cancel it).
 */
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { IDENTITIES_COPY } from '@/config/identities';
import { readIdentityError } from '@/lib/identities/client';

export function IdentityHandover({
  identityId,
  open,
  onChanged,
}: {
  identityId: string;
  /** A link is already open for this identity. */
  open: boolean;
  /** The circle should be read again: an offer was made or withdrawn. */
  onChanged: () => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await fetch(API_ROUTES.IDENTITIES.HANDOVER(identityId), { method: 'POST' });
      if (!res.ok) {
        toast.error(await readIdentityError(res, IDENTITIES_COPY.handOverFailed));
        return;
      }
      const body = (await res.json()) as { data: { link: string } };
      setLink(body.data.link);
      onChanged();
    } catch {
      toast.error(IDENTITIES_COPY.handOverFailed);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await fetch(API_ROUTES.IDENTITIES.HANDOVER(identityId), { method: 'DELETE' });
      if (!res.ok) {
        toast.error(await readIdentityError(res, IDENTITIES_COPY.handOverCancelFailed));
        return;
      }
      setLink(null);
      onChanged();
    } catch {
      toast.error(IDENTITIES_COPY.handOverCancelFailed);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) {
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard permission: the field is selectable, which still works.
    }
  };

  return (
    <div className="flex w-full flex-col gap-4 rounded-md border border-default bg-surface-raised/30 p-4">
      {link ? (
        <>
          <label className="block text-sm font-medium text-fg-primary">
            {IDENTITIES_COPY.handOverLinkLabel}
            <input
              readOnly
              value={link}
              onFocus={e => e.currentTarget.select()}
              className="mt-1 block w-full min-w-0 rounded-md border border-default bg-surface-base px-3 py-2 font-mono text-fg-primary"
            />
          </label>
          <p className="mb-0 text-sm text-fg-secondary">{IDENTITIES_COPY.handOverLinkNote}</p>
        </>
      ) : (
        <p className="mb-0 text-sm text-fg-secondary">
          {open ? IDENTITIES_COPY.handOverOpen : IDENTITIES_COPY.handOverIntro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {link && (
          <Button type="button" size="sm" className="min-h-11" onClick={copy}>
            {copied ? IDENTITIES_COPY.handOverCopied : IDENTITIES_COPY.handOverCopy}
          </Button>
        )}
        {link || open ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            onClick={cancel}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : IDENTITIES_COPY.handOverCancel}
          </Button>
        ) : (
          <Button type="button" size="sm" className="min-h-11" onClick={create} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : IDENTITIES_COPY.handOverCreate}
          </Button>
        )}
      </div>
    </div>
  );
}
