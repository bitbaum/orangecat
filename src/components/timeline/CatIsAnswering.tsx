'use client';

/**
 * The Cat, visibly thinking.
 *
 * Tagging the Cat and getting nothing for 10–17 seconds reads as nothing
 * happening — and the natural response to nothing happening is to ask again.
 * A row that says the answer is coming turns an unexplained silence into a
 * wait, which is the difference between the feature working and the feature
 * feeling broken.
 *
 * Shaped like the reply it will be replaced by — same avatar column, same
 * indentation — so the thread does not jump when the real answer lands.
 */

import React from 'react';
import { CatAvatar } from '@/components/cat/CatAvatar';
import { CAT_DISPLAY_NAME, CAT_USERNAME } from '@/config/cat-identity';

export default function CatIsAnswering() {
  return (
    <div
      className="flex gap-3 px-4 py-3 border-b border-subtle"
      // Announced politely: it is progress information, not something that
      // should interrupt whatever a screen reader is currently saying.
      role="status"
      aria-live="polite"
    >
      <CatAvatar size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-fg-primary">{CAT_DISPLAY_NAME}</span>
          <span className="flex-shrink-0 rounded-sm bg-surface-raised px-1.5 py-0.5 text-2xs font-medium uppercase tracking-caps text-fg-secondary">
            AI
          </span>
          <span className="text-sm text-fg-secondary">@{CAT_USERNAME}</span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-secondary">
          is answering
          {/* Three dots rather than a spinner: a spinner reads as loading a
              page, this is someone composing a reply. */}
          <span className="inline-flex gap-0.5" aria-hidden="true">
            <span className="h-1 w-1 animate-pulse rounded-full bg-fg-tertiary [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-fg-tertiary [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-pulse rounded-full bg-fg-tertiary [animation-delay:300ms]" />
          </span>
        </p>
      </div>
    </div>
  );
}
