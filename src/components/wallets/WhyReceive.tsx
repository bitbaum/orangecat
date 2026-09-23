'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PAY_DESTINATION_COPY } from '@/config/pay-destination';

/** One sentence, in place. Protocol names stay off this control. */
export function WhyReceive() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-accent-warm underline hover:text-accent-warm-hover"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {PAY_DESTINATION_COPY.whyToggle}
      </button>
      {open && <p className="mt-1.5 text-xs text-fg-secondary">{PAY_DESTINATION_COPY.whyBody}</p>}
    </div>
  );
}
