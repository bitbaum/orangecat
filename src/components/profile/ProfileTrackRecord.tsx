'use client';

/**
 * ProfileTrackRecord — what OrangeCat observed about this person's deals,
 * then what the other side said (ADR-0010). Facts first: the counts come from
 * settled payments nobody typed in. Hidden when they have no deals at all.
 */
import { Handshake } from 'lucide-react';
import { ReviewAnswers } from '@/components/reputation/ReviewAnswers';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useDisplayDate } from '@/hooks/useDisplayDate';
import type { TrackRecord } from '@/domain/reputation/service';

/** How the reviewer stood toward the person whose profile this is. */
const REVIEWER_STANCE = { customer: 'bought from them', provider: 'sold to them' } as const;

export default function ProfileTrackRecord({ record }: { record?: TrackRecord | null }) {
  const { formatAmountBtc } = useDisplayCurrency();
  const { formatDate } = useDisplayDate();
  if (!record) {
    return null;
  }
  const { yes, of } = record.wouldDealAgain;
  const facts = [
    record.dealsProvided > 0 &&
      `${record.dealsProvided} sold to ${record.distinctCustomers} ${record.distinctCustomers === 1 ? 'person' : 'different people'}`,
    record.btcProvided > 0 && `${formatAmountBtc(record.btcProvided)} in settled sales`,
    record.refunded > 0 && `${record.refunded} refunded`,
    record.dealsAsCustomer > 0 && `${record.dealsAsCustomer} bought`,
    record.firstDealAt && `since ${formatDate(record.firstDealAt)}`,
  ].filter((f): f is string => Boolean(f));

  return (
    <section
      aria-labelledby="profile-track-record"
      className="rounded-lg border border-default bg-surface-base p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <Handshake className="h-4 w-4 text-fg-secondary" aria-hidden="true" />
        <h2 id="profile-track-record" className="font-heading text-base text-fg-primary">
          Track record
        </h2>
      </div>
      <p className="mt-2 text-sm text-fg-secondary">{facts.join(' · ')}</p>
      <p className="mt-3 text-sm text-fg-primary">
        {of > 0 ? (
          <>
            <span className="font-heading text-lg tabular-nums">
              {Math.round((yes / of) * 100)}%
            </span>{' '}
            would deal with them again{' '}
            <span className="text-fg-muted">
              ({yes} of {of})
            </span>
          </>
        ) : (
          <span className="text-fg-muted">No reviews public yet.</span>
        )}
      </p>
      {record.recentReviews.length > 0 && (
        <ul className="mt-4 space-y-4 border-t border-default pt-4">
          {record.recentReviews.map(review => (
            <li key={`${review.reviewer.actor_id}-${review.created_at}`} className="space-y-2">
              <p className="text-xs text-fg-muted">
                {review.reviewer.name || review.reviewer.username || 'Someone'}{' '}
                {REVIEWER_STANCE[review.role]} · {formatDate(review.created_at)}
              </p>
              <ReviewAnswers answers={review.answers} body={review.body} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-fg-muted">
        Only people who had a paid deal with them can review. Each side&apos;s review stays hidden
        until both have written or the review window closes.
      </p>
    </section>
  );
}
