'use client';

/**
 * The last screen before money moves.
 *
 * Deliberately plain, and deliberately a separate step rather than a line of
 * fine print: the only job here is to let someone read back what they typed and
 * notice if it is wrong, while there is still something to be done about it.
 * Lightning has no chargeback, so this screen is the entire safety net.
 */

import { Button } from '@/components/ui/Button';
import { MoneyDetailList } from '@/components/money/MoneyDetailList';
import { SEND_COPY } from '@/config/send';

interface SendReviewStepProps {
  recipientName: string;
  amountLabel: string;
  note: string;
  sending: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
}

export function SendReviewStep({
  recipientName,
  amountLabel,
  note,
  sending,
  error,
  onBack,
  onConfirm,
}: SendReviewStepProps) {
  return (
    <div className="mt-6 space-y-4">
      <div className="text-center">
        <h2 className="font-heading tracking-display text-lg font-semibold text-fg-primary">
          {SEND_COPY.reviewTitle}
        </h2>
        <p className="mt-1 text-sm text-fg-secondary">{SEND_COPY.reviewIntro}</p>
      </div>

      <MoneyDetailList
        rows={[
          { label: SEND_COPY.reviewTo, value: recipientName },
          { label: SEND_COPY.reviewAmount, value: amountLabel },
          { label: SEND_COPY.reviewNote, value: note },
        ]}
      />

      {error && <p className="text-sm text-status-negative">{error}</p>}
      <p className="text-center text-xs text-fg-tertiary">{SEND_COPY.disclaimer}</p>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onBack} disabled={sending}>
          {SEND_COPY.back}
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={sending} isLoading={sending}>
          {sending ? SEND_COPY.sending : SEND_COPY.confirm}
        </Button>
      </div>
    </div>
  );
}
