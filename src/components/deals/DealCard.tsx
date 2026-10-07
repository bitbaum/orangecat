'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ReviewAnswers } from '@/components/reputation/ReviewAnswers';
import { DEAL_ROLE_LABEL, DEAL_STATUS_LABEL } from '@/config/reputation';
import { ROUTES } from '@/config/routes';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { useDisplayDate } from '@/hooks/useDisplayDate';
import type { MyDeal } from '@/domain/reputation/service';
import { DealReviewForm } from './DealReviewForm';

/** One deal, and where its two reviews stand. */
export function DealCard({ deal }: { deal: MyDeal }) {
  const { formatPrice } = useDisplayCurrency();
  const { formatDate } = useDisplayDate();
  const [reviewing, setReviewing] = useState(false);
  const who = deal.counterparty.name || deal.counterparty.username || 'Someone';
  const windowOpen = new Date(deal.review_closes_at) > new Date();

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div className="min-w-0">
            <p className="truncate font-medium text-fg-primary">{deal.title}</p>
            <p className="text-sm text-fg-secondary">
              {DEAL_ROLE_LABEL[deal.role]} {deal.role === 'customer' ? 'from' : 'to'}{' '}
              {deal.counterparty.username ? (
                <Link
                  href={ROUTES.PROFILES.VIEW(deal.counterparty.username)}
                  className="underline underline-offset-2"
                >
                  {who}
                </Link>
              ) : (
                who
              )}{' '}
              · {formatDate(deal.settled_at)}
            </p>
          </div>
          <p className="shrink-0 text-sm text-fg-secondary">
            {deal.amount !== null && deal.currency && (
              <span className="font-medium text-fg-primary">
                {formatPrice(deal.amount, deal.currency)}
              </span>
            )}{' '}
            · {DEAL_STATUS_LABEL[deal.status]}
          </p>
        </div>

        {deal.myReview && (
          <section aria-label="Your review" className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-label text-fg-muted">
              Your review
            </p>
            <ReviewAnswers answers={deal.myReview.answers} body={deal.myReview.body} />
          </section>
        )}

        {deal.theirReview && (
          <section aria-label={`${who}'s review`} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-label text-fg-muted">
              {who}&apos;s review of you
            </p>
            <ReviewAnswers answers={deal.theirReview.answers} body={deal.theirReview.body} />
          </section>
        )}

        {deal.myReview && !deal.theirReview && windowOpen && (
          <p className="text-sm text-fg-secondary">
            Your review is hidden until {who} reviews too, or until{' '}
            {formatDate(deal.review_closes_at)}, whichever comes first.
          </p>
        )}

        {deal.canReview &&
          (reviewing ? (
            <DealReviewForm
              dealId={deal.id}
              role={deal.role}
              counterpartyName={who}
              onCancel={() => setReviewing(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={() => setReviewing(true)}>
                Review {who}
              </Button>
              <span className="text-sm text-fg-muted">
                Open until {formatDate(deal.review_closes_at)}
              </span>
            </div>
          ))}

        {!deal.myReview && !windowOpen && (
          <p className="text-sm text-fg-muted">
            The review window closed on {formatDate(deal.review_closes_at)}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
