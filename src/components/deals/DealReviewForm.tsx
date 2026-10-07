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
  // Only a customer's review of a seller is ever public; there, being named is opt-in.
  const isPublic = role === 'customer';
  const [showName, setShowName] = useState(false);
  const missing = questions.filter(q => q.required && answers[q.id] === undefined);

  const submit = async () => {
    setSending(true);
    try {
      const trimmed = body.trim();
      const res = await fetch(API_ROUTES.DEALS.REVIEWS(dealId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers,
          ...(trimmed ? { body: trimmed } : {}),
          ...(isPublic && showName ? { show_name: true } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message || 'Could not send your review. Try again.');
        return;
      }
      toast.success(
        json.data?.revealed
          ? `Review sent. You and ${counterpartyName} can now see each other's review.`
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
        description={
          isPublic
            ? 'Shown on their profile once revealed. It cannot be edited after you send it.'
            : 'Only the two of you will see this. It cannot be edited after you send it.'
        }
        value={body}
        maxLength={DEAL_REVIEW_LIMITS.MAX_BODY_LENGTH}
        rows={3}
        onChange={e => setBody(e.target.value)}
      />
      {isPublic && (
        <label className="flex items-start gap-2 text-sm text-fg-secondary">
          <input
            type="checkbox"
            className="mt-1"
            checked={showName}
            onChange={e => setShowName(e.target.checked)}
          />
          <span>
            Show my name with this review. Leave it off and you appear as &ldquo;a verified
            buyer&rdquo;.
          </span>
        </label>
      )}
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
