'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ReviewAnswers } from '@/components/reputation/ReviewAnswers';
import { API_ROUTES } from '@/config/api-routes';
import { DEAL_REVIEW_LIMITS } from '@/config/reputation';
import { useDisplayDate } from '@/hooks/useDisplayDate';
import type { PublicDealReview } from '@/domain/reputation/track-record';

type Open = 'none' | 'reply' | 'report';

/**
 * One public review on a seller's profile: who wrote it (or "a verified
 * buyer"), the answers, the seller's reply. The seller can reply once; anyone
 * else signed in can report it.
 */
export function PublicReviewItem({
  review,
  canReply,
  canReport,
}: {
  review: PublicDealReview;
  canReply: boolean;
  canReport: boolean;
}) {
  const router = useRouter();
  const { formatDate } = useDisplayDate();
  const [open, setOpen] = useState<Open>('none');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const reviewer = review.reviewer?.name || review.reviewer?.username || 'A verified buyer';

  const send = async () => {
    const replying = open === 'reply';
    setSending(true);
    try {
      const res = await fetch(
        replying
          ? API_ROUTES.DEALS.REVIEW_REPLY(review.id)
          : API_ROUTES.DEALS.REVIEW_REPORT(review.id),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(replying ? { body: text.trim() } : { reason: text.trim() }),
        }
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message || 'That did not go through. Try again.');
        return;
      }
      toast.success(replying ? 'Reply posted.' : 'Reported. Thank you — someone will look at it.');
      setOpen('none');
      setText('');
      if (replying) {
        router.refresh();
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <li className="space-y-2">
      <p className="text-xs text-fg-muted">
        {reviewer} · {formatDate(review.created_at)}
      </p>
      <ReviewAnswers answers={review.answers} body={review.body} />
      {review.textHidden && (
        <p className="text-xs italic text-fg-muted">
          The text of this review was removed after a report.
        </p>
      )}
      {review.reply && (
        <div className="ml-4 border-l border-default pl-3">
          <p className="text-xs text-fg-muted">
            Their reply · {formatDate(review.reply.created_at)}
          </p>
          {review.reply.hidden ? (
            <p className="text-xs italic text-fg-muted">This reply was removed after a report.</p>
          ) : (
            <p className="whitespace-pre-line text-sm text-fg-primary">{review.reply.body}</p>
          )}
        </div>
      )}

      {open === 'none' && (
        <div className="flex gap-3">
          {canReply && !review.reply && (
            <button
              type="button"
              className="text-xs text-fg-secondary underline"
              onClick={() => setOpen('reply')}
            >
              Reply
            </button>
          )}
          {canReport && (
            <button
              type="button"
              className="text-xs text-fg-muted underline"
              onClick={() => setOpen('report')}
            >
              Report
            </button>
          )}
        </div>
      )}

      {open !== 'none' && (
        <div className="space-y-2">
          <Textarea
            label={
              open === 'reply'
                ? 'Your reply (public, cannot be changed)'
                : 'What is wrong with this review?'
            }
            value={text}
            rows={3}
            maxLength={
              open === 'reply'
                ? DEAL_REVIEW_LIMITS.MAX_REPLY_LENGTH
                : DEAL_REVIEW_LIMITS.MAX_REPORT_REASON_LENGTH
            }
            onChange={e => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={send} isLoading={sending} disabled={!text.trim() || sending}>
              {open === 'reply' ? 'Post reply' : 'Send report'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen('none')} disabled={sending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
