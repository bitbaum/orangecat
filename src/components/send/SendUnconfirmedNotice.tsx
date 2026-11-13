'use client';

import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SEND_COPY } from '@/config/send';

/**
 * A send that timed out. Not an error to retry from the primed form: the
 * wallet may still be paying, and a second tap would be a second payment.
 */
export function SendUnconfirmedNotice({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <Clock className="h-14 w-14 text-status-warning" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-heading tracking-display text-2xl font-bold text-fg-primary">
          {SEND_COPY.unconfirmedTitle}
        </p>
        <p className="mx-auto max-w-xs text-sm text-fg-secondary">{SEND_COPY.unconfirmedBody}</p>
      </div>
      <Button variant="primary" onClick={onDone}>
        {SEND_COPY.unconfirmedDone}
      </Button>
    </div>
  );
}
