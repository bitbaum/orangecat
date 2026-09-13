'use client';

import { useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import Button from '@/components/ui/Button';
import { STUDIO_MEDIA, STUDIO_REVISION_LIMITS, type StudioMedium } from '@/config/studio';

/**
 * "Say what to change."
 *
 * This is the Studio's whole argument. Not everyone can name a tempo or a lens,
 * but everyone can say the middle drags or the light is too cold — and that has
 * to be enough to get a different version.
 */
export default function StudioReviseBar({
  medium,
  onRevise,
  busy,
}: {
  medium: StudioMedium;
  onRevise: (note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');
  const meta = STUDIO_MEDIA[medium];
  const ready = note.trim().length >= STUDIO_REVISION_LIMITS.min;

  function submit() {
    if (!ready || busy) {
      return;
    }
    onRevise(note.trim());
    setNote('');
  }

  return (
    <section className="oc-surface p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-fg-tertiary" aria-hidden />
        <h3 className="text-sm font-semibold text-fg-primary">Change something</h3>
      </div>
      <label htmlFor="studio-note" className="sr-only">
        What should be different?
      </label>
      <textarea
        id="studio-note"
        value={note}
        onChange={event => setNote(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            submit();
          }
        }}
        maxLength={STUDIO_REVISION_LIMITS.max}
        rows={2}
        placeholder={meta.revisePlaceholder}
        disabled={busy}
        className="mt-3 w-full rounded-lg border border-default bg-surface-page px-3 py-2.5 text-sm text-fg-primary placeholder:text-fg-tertiary focus:border-interactive focus:outline-none disabled:opacity-60"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-fg-tertiary">
          Plain words are fine. You don&rsquo;t need the vocabulary — that&rsquo;s the point.
        </span>
        <Button variant="outline" onClick={submit} disabled={busy || !ready}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Make that change
        </Button>
      </div>
    </section>
  );
}
