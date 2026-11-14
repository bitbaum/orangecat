'use client';

import { useSearchParams } from 'next/navigation';
import { sentenceFromReturnPath } from '@/config/cat-door';

/**
 * "Your Cat will start with: …": the sentence a visitor typed before they
 * were asked for an account, shown on the account screen.
 *
 * It was already carried in `from=` and asked for them after sign-up, but
 * nothing on this screen said so, and the form read as if the words were gone
 * (2026-11-13 review, funnel#4).
 */
export function KeptSentence() {
  const sentence = sentenceFromReturnPath(useSearchParams()?.get('from'));
  if (!sentence) {
    return null;
  }
  return (
    <p className="mb-6 break-words rounded-lg border border-default bg-surface-base px-4 py-3 text-sm text-fg-secondary max-[359px]:mb-3">
      Your Cat will start with: <span className="text-fg-primary">“{sentence}”</span>
    </p>
  );
}
