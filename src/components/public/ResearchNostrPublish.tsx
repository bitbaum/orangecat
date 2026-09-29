'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import { getNip07Extension, publishEvent } from '@/lib/nostr';
import { buildResearchNostrEvent, type ResearchForNostr } from '@/domain/research/nostr';

interface ResearchNostrPublishProps {
  research: ResearchForNostr;
  pageUrl: string;
  alreadyPublished: boolean;
}

/**
 * The researcher signs with their own key and the browser publishes to relays;
 * the server only verifies and records. With no extension installed the button
 * says what to install instead of failing.
 */
export default function ResearchNostrPublish({
  research,
  pageUrl,
  alreadyPublished,
}: ResearchNostrPublishProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function publish() {
    const nostr = getNip07Extension();
    if (!nostr) {
      toast.error(
        'Signing needs a Nostr extension such as Alby or nos2x. Install one, then try again — your key never leaves it.'
      );
      return;
    }
    setBusy(true);
    try {
      const signed = await nostr.signEvent(buildResearchNostrEvent(research, pageUrl));
      const { successes } = await publishEvent(signed);
      if (successes.length === 0) {
        toast.error('No relay accepted the event. Check your connection and try again.');
        return;
      }
      const res = await fetch(API_ROUTES.RESEARCH_NOSTR(research.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: signed }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Published, but it could not be linked here.');
        return;
      }
      toast.success(`Published to ${successes.length} relay${successes.length === 1 ? '' : 's'}`);
      router.refresh();
    } catch {
      toast.error('Signing was cancelled or failed. Nothing was published.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" onClick={publish} disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {alreadyPublished ? 'Republish to Nostr' : 'Publish to Nostr'}
      </Button>
      <p className="text-xs text-fg-tertiary">
        Signed with your own Nostr key, so this record outlives OrangeCat. Republishing replaces the
        previous version.
      </p>
    </div>
  );
}
