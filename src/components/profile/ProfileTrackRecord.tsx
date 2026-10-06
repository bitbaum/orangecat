'use client';

/**
 * ProfileTrackRecord — what OrangeCat observed about this person's SALES, then
 * what their customers chose to say publicly (ADR-0010). Counts come from
 * settled payments nobody typed in. Deliberately absent: how much they earned,
 * what they bought, and who reviewed them unless that person chose to be named.
 * Hidden when they have sold nothing.
 */
import { Handshake } from 'lucide-react';
import { PublicReviewItem } from '@/components/reputation/PublicReviewItem';
import { useDisplayDate } from '@/hooks/useDisplayDate';
import type { TrackRecord } from '@/domain/reputation/track-record';

export default function ProfileTrackRecord({
  record,
  isOwnProfile,
  isSignedIn,
}: {
  record?: TrackRecord | null;
  isOwnProfile: boolean;
  isSignedIn: boolean;
}) {
  const { formatDate } = useDisplayDate();
  if (!record) {
    return null;
  }
  const { yes, of } = record.wouldDealAgain;
  const facts = [
    `${record.dealsProvided} paid ${record.dealsProvided === 1 ? 'deal' : 'deals'} with ${record.distinctCustomers} ${record.distinctCustomers === 1 ? 'person' : 'different people'}`,
    record.refunded > 0 && `${record.refunded} refunded`,
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
            of customers would deal with them again{' '}
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
            <PublicReviewItem
              key={review.id}
              review={review}
              canReply={isOwnProfile}
              canReport={isSignedIn && !isOwnProfile}
            />
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-fg-muted">
        Only customers who paid can review, and each review stays hidden until both sides have
        written or the review window closes. Reviewers are anonymous unless they chose to be named.
      </p>
    </section>
  );
}
