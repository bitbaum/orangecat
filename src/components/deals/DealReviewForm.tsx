'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { API_ROUTES } from '@/config/api-routes';
import { DEAL_REVIEW_LIMITS, REVIEW_QUESTIONS, type ReviewerRole } from '@/config/reputation';

/**
 * Yes/no questions, no stars. A question left unanswered is "does not apply";
 * only the ones the config marks required must be answered to send.
 */
export function DealReviewForm({
  dealId,
  role,
  counterpartyName,
  onCancel,
}: {
  dealId: string;
  role: ReviewerRole;
  counterpartyName: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const questions = REVIEW_QUESTIONS[role];
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const missing = questions.filter(q => q.required && answers[q.id] === undefined);

  const submit = async () => {
    setSending(true);
    try {
      const trimmed = body.trim();
      const res = await fetch(API_ROUTES.DEALS.REVIEWS(dealId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers, ...(trimmed ? { body: trimmed } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message || 'Could not send your review. Try again.');
        return;
      }
      toast.success(
        json.data?.revealed
          ? 'Review sent. Both reviews are now public.'
          : `Review sent. It stays hidden until ${counterpartyName} reviews too, or the window closes.`
      );
      router.refresh();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {questions.map(q => (
        <fieldset key={q.id} className="space-y-2">
          <legend className="text-sm font-medium text-fg-primary">
            {q.label}
            {!q.required && <span className="ml-1 font-normal text-fg-muted">(optional)</span>}
          </legend>
          <div className="flex gap-2">
            {[true, false].map(value => (
              <Button
                key={String(value)}
                type="button"
                size="sm"
                variant={answers[q.id] === value ? 'primary' : 'outline'}
                aria-pressed={answers[q.id] === value}
                onClick={() =>
                  setAnswers(prev => {
                    // Tapping the chosen answer again clears it — "does not apply".
                    const next = { ...prev };
                    if (next[q.id] === value && !q.required) {
                      delete next[q.id];
                    } else {
                      next[q.id] = value;
                    }
                    return next;
                  })
                }
              >
                {value ? 'Yes' : 'No'}
              </Button>
            ))}
          </div>
        </fieldset>
      ))}
      <Textarea
        label="Anything to add? (optional)"
        description="Public once revealed. It cannot be edited after you send it."
        value={body}
        maxLength={DEAL_REVIEW_LIMITS.MAX_BODY_LENGTH}
        rows={3}
        onChange={e => setBody(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={submit} isLoading={sending} disabled={missing.length > 0 || sending}>
          Send review
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={sending}>
          Not now
        </Button>
      </div>
    </div>
  );
}
