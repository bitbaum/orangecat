'use client';

/**
 * "Add extra support" — the support panel, closed until wanted, on a priced listing.
 *
 * A fixed-price listing's one action is paying the price. Appending the open
 * support form under it put a second amount field and a second Bitcoin button
 * on the same goal, so a buyer met two ways to pay and could not tell which one
 * bought the thing. Closed behind a text button that says what it does — the
 * same shape as "Add a note" (OptionalNoteField) — it stays available to anyone
 * who wants to give more, without competing with the purchase.
 */

import { useState, type ComponentProps } from 'react';
import { Plus } from 'lucide-react';
import { PublicSupportPanel } from './PublicSupportPanel';

export function OptionalSupportPanel(props: ComponentProps<typeof PublicSupportPanel>) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-1.5 text-sm text-fg-secondary hover:text-fg-primary"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add extra support
      </button>
    );
  }

  return <PublicSupportPanel {...props} />;
}
