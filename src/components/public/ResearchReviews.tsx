/**
 * Open peer review on a research page — the list, and the form for anyone
 * signed in who is not the researcher.
 *
 * Async server component: reads through the caller's client, so RLS decides
 * what is visible. Every review shows its SHA-256 so anyone can check the words
 * are the ones that were posted; reviews are append-only, so a reviewer who
 * changes their mind appears twice, in order.
 */

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { createServerClient } from '@/lib/supabase/server';
import { REVIEW_VERDICTS } from '@/config/open-science';
import { ROUTES } from '@/config/routes';
import { listResearchReviews } from '@/domain/research/reviews';
import { logger } from '@/utils/logger';
import ResearchReviewForm from './ResearchReviewForm';

const VERDICTS = Object.fromEntries(REVIEW_VERDICTS.map(v => [v.value, v]));

const TONE_DOT: Record<string, string> = {
  positive: 'bg-status-positive',
  warning: 'bg-status-warning',
  negative: 'bg-status-negative',
  neutral: 'bg-status-neutral',
};

interface ResearchReviewsProps {
  researchId: string;
  outputLinks: string[];
  canReview: boolean;
  signedIn: boolean;
}

export default async function ResearchReviews({
  researchId,
  outputLinks,
  canReview,
  signedIn,
}: ResearchReviewsProps) {
  const supabase = await createServerClient();
  let result: Awaited<ReturnType<typeof listResearchReviews>> = { reviews: [], total: 0 };
  try {
    result = await listResearchReviews(supabase, researchId);
  } catch (error) {
    logger.error('Research reviews failed to load', { error, researchId }, 'ResearchReviews');
  }
  const { reviews, total } = result;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Peer review{total > 0 ? ` · ${total}` : ''}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews.length === 0 ? (
          <p className="text-sm text-fg-tertiary">
            No one has reviewed this yet. Reviews are public, permanent, and may be written under a
            pseudonym.
          </p>
        ) : (
          <ol className="space-y-4">
            {reviews.map(review => {
              const verdict = VERDICTS[review.verdict];
              const who = review.reviewer.name || review.reviewer.username || 'A reviewer';
              return (
                <li key={review.id} className="space-y-2 border-b border-subtle pb-4 last:border-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span
                      className={`h-2 w-2 rounded-full ${TONE_DOT[verdict?.tone ?? 'neutral']}`}
                      aria-hidden
                    />
                    <span className="font-medium">{verdict?.label ?? review.verdict}</span>
                    <span className="text-fg-tertiary">·</span>
                    {review.reviewer.username ? (
                      <Link
                        href={ROUTES.PROFILES.VIEW(review.reviewer.username)}
                        className="text-fg-secondary hover:underline"
                      >
                        {who}
                      </Link>
                    ) : (
                      <span className="text-fg-secondary">{who}</span>
                    )}
                    <time dateTime={review.created_at} className="text-fg-tertiary">
                      {review.created_at.slice(0, 10)}
                    </time>
                  </div>
                  {review.output_link && (
                    <Badge variant="outline" className="max-w-full truncate font-normal">
                      on {review.output_link}
                    </Badge>
                  )}
                  <p className="whitespace-pre-wrap text-sm text-fg-primary wrap-anywhere">
                    {review.body}
                  </p>
                  <p className="text-xs text-fg-tertiary wrap-anywhere">
                    SHA-256 <code className="font-mono">{review.body_sha256}</code>
                  </p>
                </li>
              );
            })}
          </ol>
        )}

        {canReview ? (
          <ResearchReviewForm researchId={researchId} outputLinks={outputLinks} />
        ) : !signedIn ? (
          <p className="text-sm text-fg-secondary">
            <Link href={ROUTES.AUTH} className="underline">
              Sign in
            </Link>{' '}
            to review this research. A pseudonym is enough.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
